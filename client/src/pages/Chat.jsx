import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket";
import VideoGrid from "../components/VideoGrid";
import ChatBox from "../components/ChatBox";
import Controls from "../components/Controls";
import ReportModal from "../components/ReportModal";
import "./Chat.css";

const Chat = () => {
  const [status, setStatus] = useState("searching"); // 'searching', 'connected', 'disconnected'
  const [messages, setMessages] = useState([]);
  const [user, setUser] = useState(null);
  const [localCountryCode, setLocalCountryCode] = useState(null);
  const [remoteCountryCode, setRemoteCountryCode] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [currentCameraId, setCurrentCameraId] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const roomIdRef = useRef(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const navigate = useNavigate();

  // Watch localStream and localVideoRef to attach stream
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Handle keyboard shortcuts (Esc)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (status === "connected") {
          handleNext();
        } else {
          handleStop();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status, roomId]);

  const iceServers = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  useEffect(() => {
    socket.connect();
    const u = localStorage.getItem("auth_user");
    if (u) {
      try { setUser(JSON.parse(u)); } catch {}
    } else {
      const t = localStorage.getItem("auth_token");
      if (t) {
        fetch("/api/auth/me", { headers: { Authorization: `Bearer ${t}` } })
          .then(r => r.json().catch(() => ({}))).then(d => { if (d?.user) { localStorage.setItem("auth_user", JSON.stringify(d.user)); setUser(d.user); } });
      }
    }
    fetch("/api/geo/me")
      .then((r) => r.json().catch(() => ({})))
      .then((d) => {
        if (d?.countryCode) setLocalCountryCode(String(d.countryCode).toUpperCase());
      })
      .catch(() => {});

    // Check for multiple cameras
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setHasMultipleCameras(videoDevices.length > 1);
    });

    const startChat = async (deviceId = null) => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert("O teu navegador não suporta acesso à câmara.");
          navigate("/");
          return;
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        // Master Logic: Try to find a non-virtual camera if no deviceId is provided
        let targetDeviceId = deviceId;
        if (!targetDeviceId && videoDevices.length > 0) {
          const realCamera = videoDevices.find(d => 
            !d.label.toLowerCase().includes('virtual') && 
            !d.label.toLowerCase().includes('obs') &&
            !d.label.toLowerCase().includes('utility')
          );
          if (realCamera) {
            targetDeviceId = realCamera.deviceId;
          }
        }

        // Clean up previous stream if switching
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
        }

        const constraints = {
          video: targetDeviceId ? { deviceId: { exact: targetDeviceId } } : { facingMode: 'user' },
          audio: true,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = stream;
        setLocalStream(stream);

        // Save current device ID
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          setCurrentCameraId(videoTrack.getSettings().deviceId);
        }

        const filters = JSON.parse(
          sessionStorage.getItem("chat_filters") ||
            '{"gender":"Any", "country":"Any"}',
        );
        socket.emit("join_queue", filters);
      } catch (err) {
        console.error("Media error:", err);
        if (err.name === "NotAllowedError") {
          alert(
            "Permissão de câmara/microfone negada. Ativa nas permissões do browser e recarrega a página.",
          );
        } else if (err.name === "NotFoundError") {
          alert("Nenhuma câmara encontrada no dispositivo.");
        } else if (err.name === "NotReadableError") {
          alert(
            "A câmara não conseguiu iniciar (normalmente está a ser usada por outra app/tab). Fecha Zoom/Teams/Meet, outras tabs com câmara, e tenta novamente.",
          );
        } else {
          alert("Erro ao aceder à câmara: " + err.message);
        }
        navigate("/");
      }
    };

    startChat();

    socket.on("waiting", () => {
      setStatus("searching");
    });

    socket.on("matched", async (data) => {
      // Check for anonymous call limit
      const u = localStorage.getItem("auth_user");
      if (!u) {
        const callCount = parseInt(localStorage.getItem("anon_calls") || "0");
        if (callCount >= 4) {
          alert("Limite de chamadas anónimas atingido! Por favor, cria uma conta para continuares a usar o BAFLY.");
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
          }
          socket.disconnect();
          navigate("/auth?mode=register");
          return;
        }
        localStorage.setItem("anon_calls", (callCount + 1).toString());
      }

      const { role, roomId: matchedRoomId } = data;
      setRoomId(matchedRoomId);
      roomIdRef.current = matchedRoomId;
      setStatus("connected");
      setMessages([{ type: "system", text: "✓ Stranger connected" }]);
      if (data?.selfGeo?.countryCode) setLocalCountryCode(String(data.selfGeo.countryCode).toUpperCase());
      if (data?.partnerGeo?.countryCode) setRemoteCountryCode(String(data.partnerGeo.countryCode).toUpperCase());

      initPeerConnection(role, matchedRoomId);
    });

    socket.on("offer", async (data) => {
      if (!peerConnectionRef.current) return;
      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(data.sdp),
      );
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      socket.emit("answer", { roomId: roomIdRef.current, sdp: answer });
    });

    socket.on("answer", async (data) => {
      if (!peerConnectionRef.current) return;
      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(data.sdp),
      );
    });

    socket.on("ice_candidate", async (data) => {
      if (!peerConnectionRef.current) return;
      try {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(data.candidate),
        );
      } catch (e) {
        console.error("Error adding ice candidate", e);
      }
    });

    socket.on("message", (data) => {
      setMessages((prev) => [...prev, { type: "stranger", text: data.text }]);
    });

    socket.on("stranger_disconnected", () => {
      setStatus("disconnected");
      setMessages((prev) => [
        ...prev,
        { type: "system", text: "Stranger left 👋" },
      ]);
      setRemoteCountryCode(null);
      cleanupPeerConnection();
    });

    return () => {
      cleanupPeerConnection();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      socket.disconnect();
    };
  }, []);

  const initPeerConnection = async (role, rId) => {
    cleanupPeerConnection();

    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;

    localStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice_candidate", {
          roomId: rId,
          candidate: event.candidate,
        });
      }
    };

    if (role === "caller") {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { roomId: rId, sdp: offer });
    }
  };

  const cleanupPeerConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const handleNext = () => {
    socket.emit("next");
    cleanupPeerConnection();
    setStatus("searching");
    setMessages([]);
    setRoomId(null);
    roomIdRef.current = null;
    setRemoteCountryCode(null);
    const filters = JSON.parse(
      sessionStorage.getItem("chat_filters") ||
        '{"gender":"Any", "country":"Any"}',
    );
    socket.emit("join_queue", filters);
  };

  const handleStop = () => {
    navigate("/");
  };

  const sendMessage = (text) => {
    if (status === "connected" && roomIdRef.current) {
      socket.emit("message", { roomId: roomIdRef.current, text });
      setMessages((prev) => [...prev, { type: "me", text }]);
    }
  };

  const toggleMute = () => {
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const handleSwitchCamera = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length > 1) {
        // Find current index
        const currentIndex = videoDevices.findIndex(d => d.deviceId === currentCameraId);
        // Pick next one
        const nextIndex = (currentIndex + 1) % videoDevices.length;
        const nextDeviceId = videoDevices[nextIndex].deviceId;
        
        const constraints = {
          video: { deviceId: { exact: nextDeviceId } },
          audio: true
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Update local stream and UI
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = stream;
        setLocalStream(stream);
        setCurrentCameraId(nextDeviceId);

        // Replace tracks in existing RTCPeerConnection if active
        if (peerConnectionRef.current) {
          const videoTrack = stream.getVideoTracks()[0];
          const sender = peerConnectionRef.current.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        }
      }
    } catch (err) {
      console.error("Error switching camera:", err);
      alert("Não foi possível trocar a câmara: " + err.message);
    }
  };

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div className="logo small">
          <span className="logo-ba">BA</span>
          <span className="logo-fly">FLY</span>
        </div>
        <div className={`status-chip ${status}`}>
          {status === "searching" && "⏳ A procurar..."}
          {status === "connected" && "✓ Conectado"}
          {status === "disconnected" && "○ Desconectado"}
        </div>
        <div style={{marginLeft:'auto'}}>
          {user ? (
            <>
              <span style={{marginRight:10}}>{user.displayName || user.username}</span>
              <button
                onClick={() => { localStorage.removeItem("auth_token"); localStorage.removeItem("auth_user"); setUser(null); }}
                className="ctrl-btn stop"
              >
                Sair
              </button>
            </>
          ) : null}
        </div>
      </header>

      <div className="chat-content">
        <VideoGrid
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          status={status}
          localCountryCode={localCountryCode}
          remoteCountryCode={remoteCountryCode}
        />
        <ChatBox
          messages={messages}
          onSendMessage={sendMessage}
          disabled={status !== "connected"}
        />
      </div>

      <Controls
        onNext={handleNext}
        onStop={handleStop}
        onMute={toggleMute}
        onVideoOff={toggleVideo}
        onSwitchCamera={handleSwitchCamera}
        hasMultipleCameras={hasMultipleCameras}
        onReport={() => setShowReportModal(true)}
        isMuted={isMuted}
        isVideoOff={isVideoOff}
      />

      {showReportModal && (
        <ReportModal
          onClose={() => setShowReportModal(false)}
          reportedId={roomId} // Simplified
        />
      )}
    </div>
  );
};

export default Chat;
