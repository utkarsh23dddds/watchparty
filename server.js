import express from "express";
import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";
import { canControl, failure, isObject, listParticipants, liveState, success, validChange, validName } from "./server/helpers.js";
import { applyChange, clearRequest, removeUser, sendParticipants } from "./server/roomActions.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const defaultOrigins = "http://localhost:5173,http://127.0.0.1:5173";

export function createWatchPartyServer(origins = process.env.CLIENT_ORIGIN || defaultOrigins) {
  const originList = Array.isArray(origins) ? origins : origins.split(",");
  const allowedOrigins = new Set(originList.map((origin) => origin.trim()));
  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    serveClient: false,
    maxHttpBufferSize: 10_000,
    cors: { origin: [...allowedOrigins] },
    allowRequest: (request, done) => done(null, allowedOrigins.has(request.headers.origin)),
  });
  const rooms = new Map();

  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    next();
  });
  app.use(express.static(path.join(root, "dist"), { dotfiles: "deny" }));

  io.on("connection", (socket) => {
    if (io.engine.clientsCount > 500) return socket.disconnect(true);
    socket.data.roomId = null;
    socket.data.events = [];

    const roomFor = () => rooms.get(socket.data.roomId);
    const userFor = () => roomFor()?.users.get(socket.id);

    // Client events need an acknowledgement and are limited to 60 per 10 seconds.
    function on(event, handler) {
      socket.on(event, (data, ack) => {
        if (typeof ack !== "function") return;
        const now = Date.now();
        socket.data.events = socket.data.events.filter((time) => now - time < 10_000);
        if (socket.data.events.length >= 60) return failure(ack, "Too many requests; wait a few seconds.");
        socket.data.events.push(now);
        try { handler(isObject(data) ? data : {}, ack); }
        catch { failure(ack, "The request could not be completed."); }
      });
    }

    on("create_room", (data, ack) => {
      if (socket.data.roomId) return failure(ack, "Leave your current room first.");
      if (!validName(data.username) || Object.keys(data).some((key) => key !== "username")) return failure(ack, "Enter a name up to 32 characters.");
      if (rooms.size >= 200) return failure(ack, "The server is full; try again later.");
      let roomId;
      do { roomId = randomBytes(16).toString("base64url"); } while (rooms.has(roomId));
      const room = {
        roomId, users: new Map(), requests: new Map(),
        state: { playState: "paused", currentTime: 0, videoId: "", updatedAt: Date.now() },
      };
      const user = { username: data.username.trim(), role: "host" };
      room.users.set(socket.id, user);
      rooms.set(roomId, room);
      socket.data.roomId = roomId;
      socket.join(roomId);
      success(ack, { roomId, userId: socket.id, role: user.role, participants: listParticipants(room), state: liveState(room) });
      sendParticipants(io, room);
    });

    on("join_room", (data, ack) => {
      const currentRoom = roomFor();
      if (currentRoom) {
        if (currentRoom.roomId !== data.roomId) return failure(ack, "Leave your current room first.");
        return success(ack, { roomId: currentRoom.roomId, userId: socket.id, role: userFor().role,
          participants: listParticipants(currentRoom), state: liveState(currentRoom) });
      }
      if (typeof data.roomId !== "string" || !/^[\w-]{22}$/.test(data.roomId)) return failure(ack, "Invalid room code.");
      if (!validName(data.username)) return failure(ack, "Enter a name up to 32 characters.");
      const room = rooms.get(data.roomId);
      if (!room) return failure(ack, "Room not found or it has ended.");
      if (room.users.size >= 50) return failure(ack, "This room is full.");
      const user = { username: data.username.trim(), role: "participant" };
      room.users.set(socket.id, user);
      socket.data.roomId = room.roomId;
      socket.join(room.roomId);
      success(ack, { roomId: room.roomId, userId: socket.id, role: user.role,
        participants: listParticipants(room), state: liveState(room) });
      sendParticipants(io, room);
    });

    on("request_sync", (_data, ack) => {
      const room = roomFor();
      if (!userFor() || !room) return failure(ack, "Join a room first.");
      success(ack, { roomId: room.roomId, state: liveState(room) });
    });

    for (const action of ["play", "pause", "seek", "change_video"]) {
      on(action, (data, ack) => {
        const room = roomFor();
        if (!userFor() || !room) return failure(ack, "Join a room first.");
        if (!canControl(userFor())) return failure(ack, "Ask a host or moderator to approve this change.");
        if (!validChange(action, data)) return failure(ack, "Invalid playback value.");
        applyChange(io, room, action, data);
        success(ack);
      });
    }

    on("request_control", (data, ack) => {
      const room = roomFor();
      const user = userFor();
      if (!user || !room) return failure(ack, "Join a room first.");
      if (canControl(user)) return failure(ack, "Hosts and moderators can make changes directly.");
      if (!validChange(data.action, data)) return failure(ack, "Invalid playback request.");
      if (room.requests.size >= 20) return failure(ack, "There are already several pending requests.");
      const requestId = randomUUID();
      const request = { userId: socket.id, username: user.username, action: data.action,
        payload: data.action === "change_video" ? { videoId: data.videoId } : { time: data.time } };
      room.requests.set(requestId, request);
      for (const [id, roomUser] of room.users) {
        if (canControl(roomUser)) io.to(id).emit("control_requested", { requestId, ...request });
      }
      success(ack, { requestId });
    });

    on("answer_request", (data, ack) => {
      const room = roomFor();
      if (!userFor() || !room) return failure(ack, "Join a room first.");
      if (!canControl(userFor())) return failure(ack, "Only a host or moderator can approve requests.");
      const request = room.requests.get(data.requestId);
      if (!request || typeof data.approved !== "boolean") return failure(ack, "Request expired or invalid.");
      clearRequest(io, room, data.requestId);
      if (data.approved) applyChange(io, room, request.action, request.payload);
      io.to(request.userId).emit("control_result", { roomId: room.roomId, approved: data.approved });
      success(ack);
    });

    on("assign_role", (data, ack) => {
      const room = roomFor();
      if (userFor()?.role !== "host") return failure(ack, "Only the host can assign roles.");
      if (!room || !["moderator", "participant"].includes(data.role) || data.userId === socket.id) return failure(ack, "Invalid role change.");
      const target = room.users.get(data.userId);
      if (!target) return failure(ack, "Participant not found.");
      target.role = data.role;
      sendParticipants(io, room);
      success(ack);
    });

    on("remove_participant", (data, ack) => {
      const room = roomFor();
      if (userFor()?.role !== "host") return failure(ack, "Only the host can remove participants.");
      const target = io.sockets.sockets.get(data.userId);
      if (!room || !target || data.userId === socket.id || !room.users.has(data.userId)) return failure(ack, "Participant not found.");
      room.users.delete(data.userId);
      for (const [id, request] of room.requests) {
        if (request.userId === data.userId) clearRequest(io, room, id);
      }
      target.data.roomId = null;
      target.leave(room.roomId);
      target.emit("removed", { roomId: room.roomId });
      sendParticipants(io, room);
      success(ack);
    });

    on("leave_room", (_data, ack) => {
      if (!socket.data.roomId) return failure(ack, "You are not in a room.");
      const roomId = socket.data.roomId;
      removeUser(socket, rooms, io);
      socket.leave(roomId);
      success(ack);
    });
    socket.on("disconnect", () => removeUser(socket, rooms, io));
  });

  return { app, server, io, rooms, close: () => new Promise((resolve) => io.close(resolve)) };
}

export function startServer() {
  const port = Number(process.env.PORT || 3000);
  return createWatchPartyServer().server.listen(port, () => console.log("Watch Party server started on port " + port));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) startServer();
