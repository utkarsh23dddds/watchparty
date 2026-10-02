import { useState } from "react";

export default function JoinRoom({ online, busy, notice, onEnter }) {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState(
    () => new URLSearchParams(location.search).get("room") || "",
  );

  function createRoom() {
    onEnter("create_room", { username: name });
  }

  function joinRoom() {
    onEnter("join_room", {
      username: name,
      roomId: roomCode.trim(),
    });
  }

  return (
    <main className="center">
      <section className="card join">
        <div className="logo">▶</div>
        <h1>Watch Party</h1>
        <p className="sub">Create a room or join with an invitation code.</p>

        <label htmlFor="name">Your name</label>
        <input
          id="name"
          maxLength={32}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <label htmlFor="code">Room code</label>
        <input
          id="code"
          maxLength={22}
          value={roomCode}
          onChange={(event) => setRoomCode(event.target.value.trim())}
        />

        <div className="join-actions">
          <button
            className="primary"
            disabled={!online || busy || !name.trim()}
            onClick={createRoom}
          >
            Create room
          </button>
          <button
            disabled={!online || busy || !name.trim() || !roomCode.trim()}
            onClick={joinRoom}
          >
            Join room
          </button>
        </div>

        <p className="hint">Share the room code only with people you invite.</p>
        <p className="connection-status">
          {online ? "Connected" : "Connecting…"}
        </p>
        {notice && <p className="notice" role="alert">{notice}</p>}
      </section>
    </main>
  );
}
