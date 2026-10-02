# YouTube Watch Party

A small assignment project: React and YouTube on the frontend, Express and Socket.IO for shared rooms.

## What it does

- Create a room or join with an invite link/code.
- Sync video, play, pause, and seek between participants.
- Let the host assign moderators or remove participants.
- Require participant playback changes to be approved by a host/moderator.

## Where to look

- src/main.jsx starts the React app.
- src/App.jsx connects the screens and keeps the current room state.
- src/components/JoinRoom.jsx creates or joins a room.
- src/components/RoomView.jsx shows the room and playback controls.
- src/components/VideoFrame.jsx embeds the YouTube player.
- src/components/ControlRequests.jsx shows requests for host approval.
- src/components/Participants.jsx shows the roster and host role controls.
- src/socket.js sends events and reads server replies.
- server.js handles room events and broadcasts updates.
- server/helpers.js validates names and playback changes, and formats room data.
- server/roomActions.js updates playback, removes users, and sends room updates.

## Follow one playback change

1. A button in RoomView sends an event through src/socket.js.
2. server.js checks the user's room and role.
3. A host or moderator's change is broadcast immediately. A participant's change waits for approval.
4. App.jsx receives the update and gives the new state to RoomView.

## Run locally

Use Node.js 20.19 or newer:

1. Run npm ci.
2. Start the backend with npm start.
3. In another terminal, run npm run dev.
4. Open the Vite URL, create a room, then open its invite link in another browser window.

Run npm test for the Socket.IO checks. Use npm run lint and npm run build for code/build checks.

## Deploy

Build with npm ci && npm run build and start with npm start. Set CLIENT_ORIGIN to your exact public HTTPS origin, such as https://your-app.onrender.com.

Live URL: not deployed yet. Add the public URL here before submitting.

## Simple architecture

The browser sends an event such as play or seek. The server checks room membership and permissions, updates the room state, then sends sync_state to everyone in that room. Participant changes use request_control and only apply after a host or moderator approves them.

Rooms exist in server memory and disappear when everyone leaves or the server restarts. Names are display labels; the room code is the invitation.
