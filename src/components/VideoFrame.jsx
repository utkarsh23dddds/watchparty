import YouTube from "react-youtube";

export default function VideoFrame({ videoId, onReady }) {
  return (
    <div className="player">
      {videoId ? (
        <YouTube
          key={videoId}
          videoId={videoId}
          opts={{
            width: "100%",
            height: "100%",
            playerVars: { controls: 0, disablekb: 1, playsinline: 1 },
          }}
          onReady={onReady}
        />
      ) : (
        <p className="hint empty">The host can add a YouTube video below.</p>
      )}
    </div>
  );
}
