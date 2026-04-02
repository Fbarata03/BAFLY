import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket";
import VideoGrid from "../components/VideoGrid";
import ChatBox from "../components/ChatBox";
import Controls from "../components/Controls";
import ReportModal from "../components/ReportModal";
import "./Chat.css";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const PROD_BACKEND = "https://bafly-server-production.up.railway.app";
const API_URL =
  window.location.hostname === "localhost"
    ? ""
    : window.location.hostname === "bafly.net" || window.location.hostname.endsWith(".netlify.app")
      ? PROD_BACKEND
      : import.meta.env.VITE_API_URL || PROD_BACKEND;

const Chat = () => {
  const [status, setStatus] = useState("searching"); // 'searching', 'connected', 'disconnected'
  const [onlineCount, setOnlineCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
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
  const [remoteVideoActive, setRemoteVideoActive] = useState(false);

  const peerConfigRef = useRef(ICE_SERVERS);
  const roomIdRef = useRef(null);
  const pendingMessagesRef = useRef([]);
  const pendingSignalingRef = useRef([]);
  const pendingHintShownRef = useRef(false);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const iceRestartedRef = useRef(false);
  const statusRef = useRef("searching");
  const startedRef = useRef(false);
  const navigate = useNavigate();

  // --- Helper Functions ---

  const processSignalingQueue = async () => {
    if (!peerConnectionRef.current) return;
    const queue = pendingSignalingRef.current;
    pendingSignalingRef.current = [];
    for (const msg of queue) {
      if (msg.type === "offer") {
        await handleOffer(msg.data);
      } else if (msg.type === "answer") {
        await handleAnswer(msg.data);
      } else if (msg.type === "ice_candidate") {
        await handleIceCandidate(msg.data);
      }
    }
  };

  const handleOffer = async (data) => {
    if (!peerConnectionRef.current) {
      pendingSignalingRef.current.push({ type: "offer", data });
      return;
    }
    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      socket.emit("answer", { roomId: roomIdRef.current, sdp: answer });
      processSignalingQueue();
    } catch (err) {
      console.error("Offer error:", err);
    }
  };

  const handleAnswer = async (data) => {
    if (!peerConnectionRef.current) {
      pendingSignalingRef.current.push({ type: "answer", data });
      return;
    }
    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
      processSignalingQueue();
    } catch (err) {
      console.error("Answer error:", err);
    }
  };

  const handleIceCandidate = async (data) => {
    if (!peerConnectionRef.current || !peerConnectionRef.current.remoteDescription) {
      pendingSignalingRef.current.push({ type: "ice_candidate", data });
      return;
    }
    try {
      await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (err) {
      console.error("ICE error:", err);
    }
  };

  const emitJoinQueue = useCallback(() => {
    const filters = JSON.parse(
      sessionStorage.getItem("chat_filters") || '{"gender":"Any", "country":"Any"}',
    );
    if (socket.connected) {
      socket.emit("join_queue", filters);
      return;
    }
    const onConnect = () => {
      socket.emit("join_queue", filters);
      socket.off("connect", onConnect);
    };
    socket.on("connect", onConnect);
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setRemoteVideoActive(false);
  }, []);

  const handleStop = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleNext = useCallback(() => {
    socket.emit("next");
    cleanupPeerConnection();
    setStatus("searching");
    setMessages([]);
    setRoomId(null);
    roomIdRef.current = null;
    setRemoteCountryCode(null);
    pendingSignalingRef.current = [];
    emitJoinQueue();
  }, [cleanupPeerConnection, emitJoinQueue]);

  const initPeerConnection = useCallback(async (role, rId) => {
    cleanupPeerConnection();
    iceRestartedRef.current = false;

    // Master Logic: Wait for local stream if not yet ready
    let attempts = 0;
    while (!localStreamRef.current && attempts < 50) { // Max 5 seconds
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }

    if (!localStreamRef.current) {
      console.error("Local stream still not ready after waiting.");
      return;
    }

    const pc = new RTCPeerConnection({
      ...(peerConfigRef.current || ICE_SERVERS),
      iceTransportPolicy: window.location.hostname === "localhost" ? "all" : "relay",
    });
    peerConnectionRef.current = pc;

    localStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setRemoteVideoActive(true);
        // Master touch: ensure video plays (bypass autoplay policy)
        remoteVideoRef.current.play().catch(e => console.warn("Autoplay blocked:", e));
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

    pc.oniceconnectionstatechange = async () => {
      if (!peerConnectionRef.current) return;
      const state = peerConnectionRef.current.iceConnectionState;
      if (state === "failed" && role === "caller" && !iceRestartedRef.current) {
        iceRestartedRef.current = true;
        try {
          const offer = await peerConnectionRef.current.createOffer({ iceRestart: true });
          await peerConnectionRef.current.setLocalDescription(offer);
          socket.emit("offer", { roomId: rId, sdp: offer });
        } catch {}
      }
    };

    if (role === "caller") {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { roomId: rId, sdp: offer });
    }

    processSignalingQueue();
  }, [cleanupPeerConnection]);

  // --- Effects ---

  // Attach local stream to video element
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.warn("Local video play error:", e));
    }
  }, [localStream]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Keyboard shortcuts
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
  }, [status, handleNext, handleStop]);

  // Socket and Camera Initialization
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    fetch(`${API_URL}/api/webrtc/ice`)
      .then((r) => r.json().catch(() => null))
      .then((d) => {
        if (d?.iceServers && Array.isArray(d.iceServers) && d.iceServers.length) {
          peerConfigRef.current = { iceServers: d.iceServers };
        }
      })
      .catch(() => {});

    socket.on("online_count", (count) => setOnlineCount(Number(count) || 0));
    socket.on("status", (s) => {
      if (s && typeof s.onlineCount === "number") setOnlineCount(Number(s.onlineCount) || 0);
      if (s && typeof s.queueSize === "number") setQueueCount(Number(s.queueSize) || 0);
    });
    const onConnect = () => {
      socket.emit("get_online_count");
      if (statusRef.current === "searching") emitJoinQueue();
    };
    socket.on("connect", onConnect);
    socket.connect();
    
    // User info
    const u = localStorage.getItem("auth_user");
    if (u) {
      try { setUser(JSON.parse(u)); } catch {}
    } else {
      const t = localStorage.getItem("auth_token");
      if (t) {
        fetch(`${API_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${t}` } })
          .then(r => r.json().catch(() => ({})))
          .then(d => { if (d?.user) { localStorage.setItem("auth_user", JSON.stringify(d.user)); setUser(d.user); } });
      }
    }

    // Geo info
    fetch(`${API_URL}/api/geo/me`)
      .then((r) => r.json().catch(() => ({})))
      .then((d) => {
        if (d?.countryCode) setLocalCountryCode(String(d.countryCode).toUpperCase());
      })
      .catch(() => {});

    // Camera check
    navigator.mediaDevices.enumerateDevices().then(devices => {
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setHasMultipleCameras(videoDevices.length > 1);
    });

    const startChat = async (deviceId = null) => {
      try {
        if (startedRef.current) return;
        startedRef.current = true;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          alert("O teu navegador não suporta acesso à câmara.");
          navigate("/");
          return;
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        let targetDeviceId = deviceId;
        if (!targetDeviceId && videoDevices.length > 0 && videoDevices[0].label !== '') {
          const realCamera = videoDevices.find(d => 
            d.label && 
            !d.label.toLowerCase().includes('virtual') && 
            !d.label.toLowerCase().includes('obs') &&
            !d.label.toLowerCase().includes('utility')
          );
          if (realCamera) {
            targetDeviceId = realCamera.deviceId;
          }
        }

        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
        }

        const constraints = {
          video: targetDeviceId ? { deviceId: { exact: targetDeviceId } } : { facingMode: 'user' },
          audio: true,
        };

        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (innerErr) {
          console.warn("Preferred constraints failed, trying generic:", innerErr);
          // Fallback: try generic video/audio without specific device or facingMode
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        }

        localStreamRef.current = stream;
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          setCurrentCameraId(videoTrack.getSettings().deviceId);
        }

        emitJoinQueue();
      } catch (err) {
        console.error("Media error:", err);
        alert("Erro ao aceder à câmara: " + err.message);
        navigate("/");
      }
    };

    startChat();

    // Socket listeners
    socket.on("waiting", () => setStatus("searching"));

    socket.on("matched", async (data) => {
      const { role, roomId: matchedRoomId } = data;
      iceRestartedRef.current = false;
      setRoomId(matchedRoomId);
      roomIdRef.current = matchedRoomId;
      setStatus("connected");
      setMessages([{ type: "system", text: "✓ Estranho conectado" }]);
      if (data?.selfGeo?.countryCode) setLocalCountryCode(String(data.selfGeo.countryCode).toUpperCase());
      if (data?.partnerGeo?.countryCode) setRemoteCountryCode(String(data.partnerGeo.countryCode).toUpperCase());

      initPeerConnection(role, matchedRoomId);

      const pending = pendingMessagesRef.current;
      if (pending.length) {
        pending.forEach((text) => {
          socket.emit("message", { roomId: matchedRoomId, text });
        });
        pendingMessagesRef.current = [];
        pendingHintShownRef.current = false;
      }
    });

    socket.on("offer", handleOffer);

    socket.on("answer", handleAnswer);

    socket.on("ice_candidate", handleIceCandidate);

    socket.on("message", (data) => {
      setMessages((prev) => [...prev, { type: "stranger", text: data.text }]);
    });

    socket.on("stranger_disconnected", () => {
      setStatus("disconnected");
      setMessages((prev) => [...prev, { type: "system", text: "O estranho saiu 👋" }]);
      setRemoteCountryCode(null);
      cleanupPeerConnection();
    });

    return () => {
      cleanupPeerConnection();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      socket.off("online_count");
      socket.off("status");
      socket.off("connect", onConnect);
      socket.off("waiting");
      socket.off("matched");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice_candidate");
      socket.off("message");
      socket.off("stranger_disconnected");
      socket.disconnect();

      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, [navigate, initPeerConnection, cleanupPeerConnection, emitJoinQueue]);

  // --- Handlers ---

  const sendMessage = (text) => {
    setMessages((prev) => [...prev, { type: "me", text }]);
    if (status === "connected" && roomIdRef.current) {
      socket.emit("message", { roomId: roomIdRef.current, text });
      return;
    }
    pendingMessagesRef.current = [...pendingMessagesRef.current, text];
    if (!pendingHintShownRef.current) {
      pendingHintShownRef.current = true;
      setMessages((prev) => [...prev, { type: "system", text: "A mensagem vai ser enviada quando conectar." }]);
    }
  };

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
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
        const currentIndex = videoDevices.findIndex(d => d.deviceId === currentCameraId);
        const nextIndex = (currentIndex + 1) % videoDevices.length;
        const nextDeviceId = videoDevices[nextIndex].deviceId;
        
        const constraints = {
          video: { deviceId: { exact: nextDeviceId } },
          audio: true
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        localStreamRef.current = stream;
        setLocalStream(stream);
        setCurrentCameraId(nextDeviceId);

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
        <div className="logo small" onClick={() => navigate("/")} style={{cursor:'pointer'}}>
          <span className="logo-ba">BA</span>
          <span className="logo-fly">FLY</span>
        </div>
        <div className={`status-chip ${status}`}>
          {status === "searching" && "⏳ A procurar..."}
          {status === "connected" && "✓ Conectado"}
          {status === "disconnected" && "○ Desconectado"}
        </div>
        <div className="user-info-header" style={{marginLeft:'auto'}}>
          {user ? (
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <span>{user.displayName || user.username}</span>
              <button
                onClick={() => { 
                  localStorage.removeItem("auth_token"); 
                  localStorage.removeItem("auth_user"); 
                  setUser(null);
                  navigate("/");
                }}
                className="ctrl-btn stop"
                style={{padding:'5px 10px', fontSize:'0.7rem'}}
              >
                Sair
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <div className="chat-content">
        <VideoGrid
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          status={status}
          onlineCount={onlineCount}
          queueCount={queueCount}
          localCountryCode={localCountryCode}
          remoteCountryCode={remoteCountryCode}
          remoteVideoActive={remoteVideoActive}
          localVideoActive={!!localStream}
        />
        <ChatBox
          messages={messages}
          onSendMessage={sendMessage}
          disabled={false}
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
          reportedId={roomId}
        />
      )}
    </div>
  );
};

export default Chat;
