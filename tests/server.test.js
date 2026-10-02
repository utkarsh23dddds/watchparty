import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { io as createClient } from "socket.io-client";
import { createWatchPartyServer } from "../server.js";

let app;
let serverUrl;
let clients;

beforeEach(async () => {
  app = createWatchPartyServer(["http://party.test"]);
  const address = await new Promise((resolve) => {
    app.server.listen(0, "127.0.0.1", () => resolve(app.server.address()));
  });
  serverUrl = "http://127.0.0.1:" + address.port;
  clients = [];
});

afterEach(async () => {
  clients.forEach((socket) => socket.disconnect());
  await app.close();
});

function connect(origin = "http://party.test") {
  const socket = createClient(serverUrl, {
    autoConnect: false,
    reconnection: false,
    transports: ["websocket"],
    extraHeaders: { Origin: origin },
  });
  clients.push(socket);

  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
    socket.connect();
  });
}

function ask(socket, event, data = {}) {
  return new Promise((resolve, reject) => {
    socket.timeout(2000).emit(event, data, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

test("participants need approval before their playback changes apply", async () => {
  const host = await connect();
  const guest = await connect();
  const room = await ask(host, "create_room", { username: "Host" });
  const joined = await ask(guest, "join_room", {
    roomId: room.roomId,
    username: "Guest",
  });

  assert.match(room.roomId, /^[A-Za-z0-9_-]{22}$/);
  assert.equal(joined.role, "participant");
  assert.equal((await ask(guest, "play", { time: 4 })).ok, false);
  assert.equal(
    (await ask(guest, "request_control", { action: "unknown", time: 4 })).ok,
    false,
  );

  const requestArrived = new Promise((resolve) => {
    host.once("control_requested", resolve);
  });
  await ask(guest, "request_control", { action: "play", time: 4 });
  const request = await requestArrived;
  await ask(host, "answer_request", {
    requestId: request.requestId,
    approved: true,
  });

  const state = await ask(guest, "request_sync");
  assert.equal(state.state.playState, "playing");
});

test("host can promote a moderator and remove participants", async () => {
  const host = await connect();
  const guest = await connect();
  const room = await ask(host, "create_room", { username: "Host" });
  const joined = await ask(guest, "join_room", {
    roomId: room.roomId,
    username: "Guest",
  });

  const assigned = await ask(host, "assign_role", {
    userId: joined.userId,
    role: "moderator",
  });
  assert.equal(assigned.ok, true);
  assert.equal((await ask(guest, "seek", { time: 9 })).ok, true);
  assert.equal(
    (await ask(host, "remove_participant", { userId: joined.userId })).ok,
    true,
  );
  assert.equal((await ask(guest, "request_sync")).ok, false);
});

test("invalid room codes, names, video IDs, and outside sync requests are rejected", async () => {
  const outsider = await connect();
  assert.equal(
    (await ask(outsider, "join_room", { roomId: "wrong", username: "A" })).ok,
    false,
  );
  assert.equal((await ask(outsider, "request_sync")).ok, false);

  const host = await connect();
  assert.equal((await ask(host, "create_room", { username: " " })).ok, false);
  const room = await ask(host, "create_room", { username: "Host" });
  assert.equal((await ask(host, "change_video", { videoId: "bad" })).ok, false);
  assert.equal(app.rooms.has(room.roomId), true);
});

test("a new host is chosen on disconnect and outside origins are rejected", async () => {
  const host = await connect();
  const guest = await connect();
  const room = await ask(host, "create_room", { username: "Host" });
  const joined = await ask(guest, "join_room", {
    roomId: room.roomId,
    username: "Guest",
  });

  const rosterUpdate = new Promise((resolve) => {
    guest.once("participants_update", resolve);
  });
  host.disconnect();
  const update = await rosterUpdate;
  const newHost = update.participants.find((person) => person.userId === joined.userId);
  assert.equal(newHost.role, "host");

  await assert.rejects(connect("https://attacker.test"));
});