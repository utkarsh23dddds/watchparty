import { useCallback, useEffect, useRef, useState } from "react";
import Participants from "./Participants.jsx";
import ControlRequests from "./ControlRequests.jsx";
import VideoFrame from "./VideoFrame.jsx";

function getVideoId(value) {
  const text = value.trim();
  if (/^[\w-]{11}$/.test(text)) return text;

  try {
    const url = new URL(text);
    if (url.protocol !== "https:") return null;

    const host = url.hostname.replace(/^www\./, "");
    const pathId = url.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})\/?$/)?.[1];
    const id = host === "youtu.be"
      ? url.pathname.split("/").filter(Boolean)[0]
      : ["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)
        ? url.searchParams.get("v") || pathId
        : null;
    return /^[\w-]{11}$/.test(id || "") ? id : null;
  } catch {
    return null;
  }
}

function formatClock(value) {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = String(seconds % 60).padStart(2, "0");

  return `${minutes}:${remainingSeconds}`;
}

export default function RoomView({
  room,
  state,
  people,
  requests,
  notice,
  send,
  leave,
  setNotice,
  online,
}) {
  const player = useRef(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [time, setTime] = useState(state.currentTime || 0);
  const [duration, setDuration] = useState(0);
  const canControl = online && ["host", "moderator"].includes(room.role);

  const syncPlayer = useCallback((nextState = state) => {
    try {
      player.current?.seekTo(nextState.currentTime, true);
      if (nextState.playState === "playing") {
        player.current?.playVideo();
      } else {
        player.current?.pauseVideo();
      }
    } catch {
      // The YouTube player may not be ready yet.
    }
  }, [state]);

  useEffect(() => {
    syncPlayer();
  }, [syncPlayer]);

  useEffect(() => {
    const timer = setInterval(() => {
      try {
        if (!player.current) return;
        setTime(player.current.getCurrentTime());
        setDuration(player.current.getDuration());
      } catch {
        // The player is still loading.
      }
    }, 500);

    return () => clearInterval(timer);
  }, []);

  function controlPlayback(action, payload = {}) {
    const event = canControl ? action : "request_control";
    const data = canControl ? payload : { action, ...payload };

    send(event, data).catch(() => {});
  }

  function changeVideo() {
    const videoId = getVideoId(videoUrl);
    if (!videoId) {
      setNotice("Enter a valid YouTube link or video ID.");
      return;
    }
    controlPlayback("change_video", { videoId });
    setVideoUrl("");
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/?room=${room.roomId}`);
    } catch {
      setNotice("Copy the room code from the top bar.");
    }
  }

  async function goLive() {
    try {
      const result = await send("request_sync");
      syncPlayer(result.state);
    } catch {
      // The app already displays the request error.
    }
  }

  return (
    <main className="app">
      <header className="topbar">
        <strong className="brand">Watch Party</strong>
        <span className="hint">Room: {room.roomId}</span>
        <span className="connection-status">
          {online ? "Connected" : "Reconnecting…"}
        </span>
        <button className="small" onClick={copyInviteLink}>Copy invite link</button>
        <span className={`badge ${room.role}`}>{room.role}</span>
        <button onClick={leave}>Leave</button>
      </header>

      {notice && <p className="notice" role="status">{notice}</p>}

      <div className="layout">
        <section>
          <VideoFrame
            videoId={state.videoId}
            onReady={(event) => {
              player.current = event.target;
              syncPlayer();
            }}
          />

          <div className="timeline">
            <span>{formatClock(time)}</span>
            <input
              aria-label="Seek video"
              type="range"
              min="0"
              max={duration || 1}
              value={Math.min(time, duration || 1)}
              disabled={!online || !duration}
              onChange={(event) => setTime(Number(event.target.value))}
              onPointerUp={(event) => controlPlayback("seek", {
                time: Number(event.currentTarget.value),
              })}
              onKeyUp={(event) => controlPlayback("seek", {
                time: Number(event.currentTarget.value),
              })}
            />
            <span>{formatClock(duration)}</span>
          </div>

          <div className="controls">
            <button disabled={!online} onClick={goLive}>Go live</button>
            <button
              disabled={!online}
              className="primary"
              onClick={() => controlPlayback("play", { time })}
            >
              Play
            </button>
            <button
              disabled={!online}
              onClick={() => controlPlayback("pause", { time })}
            >
              Pause
            </button>
            <input
              disabled={!online}
              aria-label="YouTube link"
              maxLength={2048}
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              placeholder="YouTube link"
            />
            <button disabled={!online} onClick={changeVideo}>Change video</button>
          </div>

          {!canControl && (
            <p className="hint">
              Your playback changes go to a host or moderator for approval.
            </p>
          )}
          {canControl && <ControlRequests requests={requests} send={send} />}
        </section>

        <Participants people={people} room={room} send={send} />
      </div>
    </main>
  );
}
