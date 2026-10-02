import { canControl, listParticipants, liveState } from "./helpers.js";

export function sendParticipants(io, room) {
  io.to(room.roomId).emit("participants_update", {
    roomId: room.roomId,
    participants: listParticipants(room),
  });
}

export function clearRequest(io, room, requestId) {
  room.requests.delete(requestId);
  for (const [userId, user] of room.users) {
    if (canControl(user)) io.to(userId).emit("control_request_removed", requestId);
  }
}

export function removeUser(socket, rooms, io) {
  const room = rooms.get(socket.data.roomId);
  if (!room) return;

  const leavingUser = room.users.get(socket.id);
  room.users.delete(socket.id);
  for (const [requestId, request] of room.requests) {
    if (request.userId === socket.id) clearRequest(io, room, requestId);
  }

  socket.data.roomId = null;
  if (!room.users.size) return rooms.delete(room.roomId);
  if (leavingUser?.role === "host") {
    const [nextHostId, nextHost] = room.users.entries().next().value;
    nextHost.role = "host";
    for (const [requestId, request] of room.requests) {
      io.to(nextHostId).emit("control_requested", { requestId, ...request });
    }
  }
  sendParticipants(io, room);
}

export function applyChange(io, room, action, data) {
  if (action === "change_video") {
    Object.assign(room.state, { videoId: data.videoId, currentTime: 0, playState: "paused" });
  } else {
    room.state.currentTime = data.time;
    if (action === "play" || action === "pause") {
      room.state.playState = action === "play" ? "playing" : "paused";
    }
  }

  room.state.updatedAt = Date.now();
  io.to(room.roomId).emit("sync_state", { roomId: room.roomId, state: liveState(room) });
}
