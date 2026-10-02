export default function ControlRequests({ requests, send }) {
  if (requests.length === 0) return null;

  function answerRequest(requestId, approved) {
    send("answer_request", { requestId, approved }).catch(() => {});
  }

  return (
    <section className="card requests">
      <h2>Playback requests</h2>
      {requests.map((request) => (
        <p key={request.requestId}>
          {request.username}: {request.action}
          {request.action === "change_video" && ` (${request.payload.videoId})`}
          <button
            className="small"
            onClick={() => answerRequest(request.requestId, true)}
          >
            Approve
          </button>
          <button
            className="small"
            onClick={() => answerRequest(request.requestId, false)}
          >
            Reject
          </button>
        </p>
      ))}
    </section>
  );
}
