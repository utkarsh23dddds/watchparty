import { useCallback, useEffect, useRef, useState } from "react";
import JoinRoom from "./components/JoinRoom.jsx";
import RoomView from "./components/RoomView.jsx";
import { ask, socket } from "./socket.js";

const emptyPlaybackState = {
  playState: "paused",
  currentTime: 0,
  videoId: "",
};

export default function App() {
  const [room, setRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [playbackState, setPlaybackState] = useState(emptyPlaybackState);
  const [requests, setRequests] = useState([]);
  const [online, setOnline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const currentRoom = useRef(null);

  // Save the joined room in React and in a ref for socket event handlers.
  const enterRoomState = useCallback((result, username) => {
    const nextRoom = {
      roomId: result.roomId,
      userId: result.userId,
      role: result.role,
      username,
    };

    currentRoom.current = nextRoom;
    setRoom(nextRoom);
    setParticipants(result.participants);
    setPlaybackState(result.state);
    setNotice("");
  }, []);
  const clearRoomState = useCallback(() => {
    currentRoom.current = null;
    setRoom(null);
    setParticipants([]);
    setRequests([]);
    setPlaybackState(emptyPlaybackState);
  }, []);

  useEffect(() => {
    function onConnect() {
      setOnline(true);
      setNotice("");
      // Rejoin the same room if the connection briefly drops.
      const previousRoom = currentRoom.current;
      if (!previousRoom) return;

      ask("join_room", {
        roomId: previousRoom.roomId,
        username: previousRoom.username,
      })
        .then((result) => enterRoomState(result, previousRoom.username))
        .catch(() => {
          clearRoomState();
          setNotice("The room ended while you were disconnected.");
        });
    }
    function onDisconnect() {
      setOnline(false);

      if (currentRoom.current) {
        const disconnectedRoom = { ...currentRoom.current, role: "" };
        currentRoom.current = disconnectedRoom;
        setRoom(disconnectedRoom);
      }
    }
    function onConnectionError(error) {
      setOnline(false);
      setNotice("Server connection failed: " + error.message);
    }
    function onParticipantsUpdate(message) {
      if (message.roomId !== currentRoom.current?.roomId) return;

      setParticipants(message.participants);
      const myParticipant = message.participants.find(
        (person) => person.userId === currentRoom.current.userId,
      );

      if (myParticipant) {
        const updatedRoom = { ...currentRoom.current, role: myParticipant.role };
        currentRoom.current = updatedRoom;
        setRoom(updatedRoom);
      }
    }
    function onPlaybackUpdate(message) {
      if (message.roomId === currentRoom.current?.roomId) {
        setPlaybackState(message.state);
      }
    }
    function onControlRequest(message) {
      setRequests((currentRequests) => [...currentRequests, message]);
    }
    function onControlRequestRemoved(requestId) {
      setRequests((currentRequests) =>
        currentRequests.filter((request) => request.requestId !== requestId),
      );
    }
    function onControlResult(message) {
      if (message.roomId !== currentRoom.current?.roomId) return;

      setNotice(message.approved ? "Request approved." : "Request declined.");
    }
    function onRemoved(message) {
      if (message.roomId !== currentRoom.current?.roomId) return;

      clearRoomState();
      setNotice("The host removed you from the room.");
    }
    // Listen for server updates while this screen is mounted.
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectionError);
    socket.on("participants_update", onParticipantsUpdate);
    socket.on("sync_state", onPlaybackUpdate);
    socket.on("control_requested", onControlRequest);
    socket.on("control_request_removed", onControlRequestRemoved);
    socket.on("control_result", onControlResult);
    socket.on("removed", onRemoved);
    socket.connect();
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectionError);
      socket.off("participants_update", onParticipantsUpdate);
      socket.off("sync_state", onPlaybackUpdate);
      socket.off("control_requested", onControlRequest);
      socket.off("control_request_removed", onControlRequestRemoved);
      socket.off("control_result", onControlResult);
      socket.off("removed", onRemoved);
      socket.disconnect();
    };
  }, [clearRoomState, enterRoomState]);
  async function handleRoomEntry(event, data) {
    setBusy(true);
    setNotice("");
    try {
      const result = await ask(event, data);
      enterRoomState(result, data.username.trim());
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function sendToServer(event, data) {
    try {
      const result = await ask(event, data);
      if (event === "answer_request") {
        setRequests((currentRequests) =>
          currentRequests.filter((request) => request.requestId !== data.requestId),
        );
      }
      setNotice("");
      return result;
    } catch (error) {
      setNotice(error.message);
      throw error;
    }
  }
  async function leaveRoom() {
    try {
      await sendToServer("leave_room");
      clearRoomState();
      setNotice("You left the room.");
    } catch {
      // The error message is already shown above the room.
    }
  }

  if (!room) {
    return (
      <JoinRoom
        online={online}
        busy={busy}
        notice={notice}
        onEnter={handleRoomEntry}
      />
    );
  }

  return (
    <RoomView
      room={room}
      state={playbackState}
      people={participants}
      requests={requests}
      notice={notice}
      send={sendToServer}
      leave={leaveRoom}
      setNotice={setNotice}
      online={online}
    />
  );
}
