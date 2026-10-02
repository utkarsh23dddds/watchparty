function ParticipantRow({ participant, room, send }) {
  const isCurrentUser = participant.userId === room.userId;
  const canManage = room.role === "host" && !isCurrentUser;

  function changeRole(event) {
    send("assign_role", {
      userId: participant.userId,
      role: event.target.value,
    }).catch(() => {});
  }

  function removeParticipant() {
    send("remove_participant", { userId: participant.userId }).catch(() => {});
  }

  return (
    <div className="person">
      <div className="person-top">
        <span className="avatar">{participant.username[0]?.toUpperCase()}</span>
        <span className="person-name">
          {participant.username} · {participant.role}
          {isCurrentUser && " · you"}
        </span>
      </div>

      {canManage && (
        <div className="person-actions">
          <select
            aria-label={`Role for ${participant.username}`}
            value={participant.role}
            onChange={changeRole}
          >
            <option value="participant">Participant</option>
            <option value="moderator">Moderator</option>
          </select>
          <button className="small" onClick={removeParticipant}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

export default function Participants({ people, room, send }) {
  return (
    <aside className="card participants">
      <h2>Participants ({people.length})</h2>
      {people.map((participant) => (
        <ParticipantRow
          key={participant.userId}
          participant={participant}
          room={room}
          send={send}
        />
      ))}
    </aside>
  );
}
