# YouTube Watch Party

A small web app for watching a YouTube video together. One person creates a room and shares its code. Everyone in that room sees the same video and playback position.

## Features

- Create a room or join one with its code.
- Play, pause, seek, or change the video together.
- Let the host assign moderators or remove people.
- Let participants ask the host or a moderator to approve playback changes.
- Make another participant the host automatically if the current host disconnects.

## Run it on your computer

You need Node.js 20.19 or newer.

1. Open PowerShell in the project folder and install the packages:

   ```powershell
   npm install
   ```

2. Start the server in one PowerShell window:

   ```powershell
   npm start
   ```

3. Open a second PowerShell window in the same folder and start the website:

   ```powershell
   npm run dev
   ```

4. Open the Vite address shown in the second window. It is usually `http://localhost:5173`.

To try the app with another person, open that address in another browser window. Create a room in one window, then join with its room code in the other.

## Run the checks

```powershell
npm test
npm run lint
npm run build
```

## Where the code lives

- `src/main.jsx` starts the React app.
- `src/App.jsx` keeps track of the room, participants, and connection.
- `src/components/JoinRoom.jsx` has the create-room and join-room form.
- `src/components/RoomView.jsx` puts the video, controls, and participant list together.
- `src/components/VideoFrame.jsx` shows the YouTube player.
- `src/components/ControlRequests.jsx` shows requests waiting for host or moderator approval.
- `src/components/Participants.jsx` shows who is in the room and their roles.
- `src/socket.js` sends messages between the website and server.
- `server.js` handles room events and checks permissions.
- `server/helpers.js` checks names and playback values.
- `server/roomActions.js` updates playback and participant lists, and handles people leaving.
- `tests/server.test.js` checks the main server actions.

## How a playback change works

1. The website sends a message to the server, such as `play` or `seek`.
2. The server checks that the person is in the room and has permission.
3. A host or moderator's change is applied right away. A participant's change waits for approval.
4. The server sends the new video state to everyone in the room.

## Room data

Rooms are kept in server memory. They end when everyone leaves or the server restarts. A name is only a display name; the room code is the invitation.

## Deployment

Deploy the project as a Node.js web service that supports WebSockets. The server serves the built website from `dist` and handles the Socket.IO connection.

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Set `CLIENT_ORIGIN` to the exact public website address: `https://watchparty-e0oo.onrender.com`.

After deployment, test room creation and joining, video sync, approvals, moderator controls, and host disconnect from the public address.

**Live app:** [https://watchparty-e0oo.onrender.com](https://watchparty-e0oo.onrender.com)
