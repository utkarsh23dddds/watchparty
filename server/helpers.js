// Small helpers shared by the Socket.IO event handlers.
export const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);
export const success = (ack, data = {}) => ack({ ok: true, ...data });
export const failure = (ack, message) => ack({ ok: false, message });
export const canControl = (user) => ["host", "moderator"].includes(user?.role);

export function validName(value) {
  if (typeof value !== "string") return false;
  const name = value.trim();
  // eslint-disable-next-line no-control-regex -- block control characters in names
  return name.length > 0 && [...name].length <= 32 && !/[\u0000-\u001f\u007f]/u.test(name);
}

export function validChange(action, data) {
  if (action === "change_video") return /^[\w-]{11}$/.test(data.videoId || "");
  return ["play", "pause", "seek"].includes(action)
    && Number.isFinite(data.time) && data.time >= 0 && data.time <= 86_400;
}

export function liveState(room) {
  const elapsed = room.state.playState === "playing"
    ? (Date.now() - room.state.updatedAt) / 1000 : 0;
  return { ...room.state, currentTime: Math.min(86_400, room.state.currentTime + elapsed) };
}

export function listParticipants(room) {
  return [...room.users].map(([userId, user]) => ({ userId, ...user }));
}
