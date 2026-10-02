import { io } from "socket.io-client";

// Reuse one WebSocket connection across the app.
export const socket = io({
  autoConnect: false,
  reconnection: true,
  transports: ["websocket"],
});

// Send an event and turn the server's acknowledgement into a Promise.
export function ask(event, data = {}) {
  return new Promise((resolve, reject) => {
    if (!socket.connected) {
      reject(new Error("Reconnecting…"));
      return;
    }

    socket.timeout(5000).emit(event, data, (timeout, result) => {
      if (timeout) {
        reject(new Error("Server timed out. Try again."));
        return;
      }

      if (!result?.ok) {
        reject(new Error(result?.message || "Request failed."));
        return;
      }

      resolve(result);
    });
  });
}
