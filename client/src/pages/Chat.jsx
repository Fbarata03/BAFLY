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
    { urls: "stun:stun2.l.google.com:19305" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    // Public TURN fallback (openrelay demo — used when server ICE fetch fails)
    { urls: "turn:openrelay.metered.ca:80",               username: "openrelayproject", credential: "openrelayprojectsecret" },
    { urls: "turn:openrelay.metered.ca:443",              username: "openrelayproject", credential: "openrelayprojectsecret" },
    { urls: "turn:openrelay.metered.ca:443?transport=tcp",username: "openrelayproject", credential: "openrelayprojectsecret" },
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
  const [remoteVideoOff, setRemoteVideoOff] = useState(false);
  const [remotePlayBlocked, setRemotePlayBlocked] = useState(false);
  const [remoteIsMuted, setRemoteIsMuted] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 900px)").matches);
  const [isChatOpen, setIsChatOpen] = useState(() => !window.matchMedia("(max-width: 900px)").matches);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [callDuration, setCallDuration] = useState(0);

  const peerConfigRef = useRef(ICE_SERVERS);
  const icePromiseRef = useRef(null);
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
  const isMobileRef = useRef(window.matchMedia("(max-width: 900px)").matches);
  const isChatOpenRef = useRef(!window.matchMedia("(max-width: 900px)").matches);
  // Refs to read latest state inside stale socket closures
  const isVideoOffRef = useRef(false);
  const isMutedRef = useRef(false);
  const remoteVideoActiveRef = useRef(false);
  const remoteVideoOffRef = useRef(false);
  const roleRef = useRef(null);
  const remoteTrackTimerRef = useRef(null);
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
    setRemotePlayBlocked(false);
    if (remoteTrackTimerRef.current) {
      clearTimeout(remoteTrackTimerRef.current);
      remoteTrackTimerRef.current = null;
    }
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
    setRemoteIsMuted(false);
    setRemoteVideoOff(false);
    pendingSignalingRef.current = [];
    emitJoinQueue();
  }, [cleanupPeerConnection, emitJoinQueue]);

  const initPeerConnection = useCallback(async (role, rId) => {
    cleanupPeerConnection();
    iceRestartedRef.current = false;
    roleRef.current = role;

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

    // Wait for TURN servers to load before creating the peer connection
    if (icePromiseRef.current) await icePromiseRef.current;

    const pc = new RTCPeerConnection({
      ...(peerConfigRef.current || ICE_SERVERS),
      iceTransportPolicy: "all",
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    });
    peerConnectionRef.current = pc;

    localStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });
    // NOTE: setParameters() is NOT called here intentionally.
    // Calling it before offer/answer causes undefined behaviour in Safari/Firefox
    // and can silently corrupt the sender, making video never transmit.

    pc.ontrack = (event) => {
      const stream = event.streams?.[0] ?? new MediaStream([event.track]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        setRemoteVideoActive(true);
        setRemoteVideoOff(false);
        remoteVideoRef.current.play().then(() => {
          setRemotePlayBlocked(false);
        }).catch((e) => {
          // NotAllowedError = browser blocked autoplay (common on iOS Safari)
          if (e?.name === 'NotAllowedError' || e?.name === 'NotSupportedError') {
            setRemotePlayBlocked(true);
          }
        });
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

      // When ICE connects, sync camera/mic state to peer.
      // This is the RELIABLE moment — timer-based sync can fire too early or too late.
      if ((state === 'connected' || state === 'completed') && rId) {
        if (isVideoOffRef.current) {
          socket.emit("camera_state", { roomId: rId, enabled: false });
        }
        if (isMutedRef.current) {
          socket.emit("mic_state", { roomId: rId, enabled: false });
        }
      }

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

    if (remoteTrackTimerRef.current) clearTimeout(remoteTrackTimerRef.current);
    remoteTrackTimerRef.current = setTimeout(async () => {
      if (statusRef.current !== "connected") return;
      if (roomIdRef.current !== rId) return;
      if (remoteVideoActiveRef.current || remoteVideoOffRef.current) return;
      if (remoteVideoRef.current?.srcObject) return;

      if (roleRef.current === "caller" && peerConnectionRef.current) {
        try {
          const offer = await peerConnectionRef.current.createOffer({ iceRestart: true });
          await peerConnectionRef.current.setLocalDescription(offer);
          socket.emit("offer", { roomId: rId, sdp: offer });
        } catch {}
        return;
      }

      socket.emit("request_ice_restart", { roomId: rId });
    }, 9000);
  }, [cleanupPeerConnection]);

  // --- Effects ---

  // Keep refs in sync with state (for stale socket closures)
  useEffect(() => { isVideoOffRef.current = isVideoOff; }, [isVideoOff]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { remoteVideoActiveRef.current = remoteVideoActive; }, [remoteVideoActive]);
  useEffect(() => { remoteVideoOffRef.current = remoteVideoOff; }, [remoteVideoOff]);

  // Attach local stream to video element
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(e => console.warn("Local video play error:", e));
    }
  }, [localStream]);

  // Play remote video AFTER React removes the .hidden class (display:none → visible)
  useEffect(() => {
    if (remoteVideoActive && remoteVideoRef.current) {
      remoteVideoRef.current.play().then(() => {
        setRemotePlayBlocked(false);
      }).catch((e) => {
        if (e?.name === 'NotAllowedError' || e?.name === 'NotSupportedError') {
          setRemotePlayBlocked(true);
        }
      });
    }
  }, [remoteVideoActive]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const update = () => setIsMobile(!!mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);

  useEffect(() => {
    isMobileRef.current = isMobile;
    if (!isMobile) {
      setIsChatOpen(true);
      setUnreadChatCount(0);
    } else {
      setIsChatOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
    if (isChatOpen) setUnreadChatCount(0);
  }, [isChatOpen]);

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

    icePromiseRef.current = fetch(`${API_URL}/api/webrtc/ice`)
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
          video: targetDeviceId
            ? {
                deviceId: { exact: targetDeviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30, max: 30 },
              }
            : {
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30, max: 30 },
              },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
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
          try { videoTrack.contentHint = "motion"; } catch {}
          setCurrentCameraId(videoTrack.getSettings().deviceId);
        }

        // Re-check camera count after permission granted (labels available now)
        const afterDevices = await navigator.mediaDevices.enumerateDevices();
        const afterVideoDevices = afterDevices.filter(d => d.kind === 'videoinput');
        setHasMultipleCameras(afterVideoDevices.length > 1);

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

    socket.on("request_ice_restart", async () => {
      if (roleRef.current !== "caller") return;
      if (!peerConnectionRef.current || !roomIdRef.current) return;
      try {
        const offer = await peerConnectionRef.current.createOffer({ iceRestart: true });
        await peerConnectionRef.current.setLocalDescription(offer);
        socket.emit("offer", { roomId: roomIdRef.current, sdp: offer });
      } catch {}
    });

    socket.on("message", (data) => {
      setMessages((prev) => [...prev, { type: "stranger", text: data.text }]);
      if (isMobileRef.current && !isChatOpenRef.current) {
        setUnreadChatCount((c) => c + 1);
      }
    });

    socket.on("camera_state", (data) => {
      const enabled = !!data?.enabled;
      setRemoteVideoOff(!enabled);
      setMessages((prev) => [
        ...prev,
        { type: "system", text: enabled ? "O estranho ligou a câmara" : "O estranho desligou a câmara" },
      ]);
    });

    socket.on("mic_state", (data) => {
      const enabled = !!data?.enabled;
      setRemoteIsMuted(!enabled);
      setMessages((prev) => [
        ...prev,
        { type: "system", text: enabled ? "O estranho ligou o microfone" : "O estranho desligou o microfone" },
      ]);
    });

    socket.on("stranger_disconnected", () => {
      setStatus("disconnected");
      setMessages((prev) => [...prev, { type: "system", text: "O estranho saiu 👋" }]);
      setRemoteCountryCode(null);
      setRemoteIsMuted(false);
      setRemoteVideoOff(false);
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
      socket.off("request_ice_restart");
      socket.off("message");
      socket.off("camera_state");
      socket.off("mic_state");
      socket.off("stranger_disconnected");
      socket.disconnect();

      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, [navigate, initPeerConnection, cleanupPeerConnection, emitJoinQueue]);

  // Call duration timer
  useEffect(() => {
    if (status !== "connected") {
      setCallDuration(0);
      return;
    }
    const interval = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, [status]);

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

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
      if (roomIdRef.current) {
        socket.emit("mic_state", { roomId: roomIdRef.current, enabled: audioTrack.enabled });
      }
    }
  };

  const toggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
      if (roomIdRef.current) {
        socket.emit("camera_state", { roomId: roomIdRef.current, enabled: videoTrack.enabled });
      }
    }
  };

  const handleSwitchCamera = async () => {
    const currentTrack = localStreamRef.current?.getVideoTracks()[0];
    if (!currentTrack) return;

    const currentFacing = currentTrack.getSettings()?.facingMode;
    const nextFacing = currentFacing === 'environment' ? 'user' : 'environment';

    // ── Method 1: applyConstraints ──────────────────────────────────────────
    // Best approach: mutates the existing track in-place, no stream restart,
    // no race conditions. Works on Chrome Android 84+ and Safari 15+.
    try {
      await currentTrack.applyConstraints({ facingMode: { exact: nextFacing } });
      setCurrentCameraId(currentTrack.getSettings()?.deviceId ?? null);
      // Force re-render so the mirroring CSS updates if needed
      setLocalStream(s => s ? new MediaStream(s.getTracks()) : s);
      return;
    } catch { /* not supported or failed — fall through */ }

    // ── Method 2: stop + delay + getUserMedia ───────────────────────────────
    // Required on older Android WebViews and iOS when applyConstraints fails.
    currentTrack.stop();
    localStreamRef.current?.removeTrack(currentTrack);

    // Give the OS time to fully release the camera hardware (critical on Android)
    await new Promise(r => setTimeout(r, 600));

    let newTrack = null;

    // 2a. exact facingMode
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: nextFacing } }, audio: false });
      newTrack = s.getVideoTracks()[0] ?? null;
    } catch { /* try next */ }

    // 2b. ideal facingMode (less strict, wider device support)
    if (!newTrack) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: nextFacing }, audio: false });
        newTrack = s.getVideoTracks()[0] ?? null;
      } catch { /* try next */ }
    }

    // 2c. deviceId cycle (last resort for devices that ignore facingMode)
    if (!newTrack) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter(d => d.kind === 'videoinput');
        if (cams.length > 1) {
          const idx = cams.findIndex(d => d.deviceId === currentCameraId);
          const next = cams[(idx + 1) % cams.length];
          const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: next.deviceId } }, audio: false });
          newTrack = s.getVideoTracks()[0] ?? null;
        }
      } catch { /* all methods exhausted */ }
    }

    if (!newTrack) return; // silent fail — no alert, no crash

    try { newTrack.contentHint = "motion"; } catch { /* ignore */ }

    // Replace track in the peer connection without renegotiation
    if (peerConnectionRef.current) {
      const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
      if (sender) try { await sender.replaceTrack(newTrack); } catch { /* ignore */ }
    }

    localStreamRef.current?.addTrack(newTrack);
    setLocalStream(new MediaStream(localStreamRef.current?.getTracks() ?? []));
    setCurrentCameraId(newTrack.getSettings()?.deviceId ?? null);
  };

  return (
    <div className="chat-page">
      {isMobile ? (
        <header className="chat-header mobile-call-header">
          <button className="call-hdr-btn" onClick={handleStop} aria-label="Voltar">
            <span className="material-icons">arrow_back_ios</span>
          </button>
          <div className="call-hdr-center">
            <span className="call-hdr-name">
              {remoteCountryCode
                ? <img src={`https://flagcdn.com/24x18/${remoteCountryCode.toLowerCase()}.png`} alt={remoteCountryCode} style={{width:16,height:12,borderRadius:2,marginRight:6,verticalAlign:'middle'}} />
                : null}
              STRANGER
            </span>
            <span className="call-hdr-timer">
              {status === "connected"
                ? formatDuration(callDuration)
                : status === "searching"
                ? "A procurar..."
                : "Desconectado"}
            </span>
          </div>
          <button className="call-hdr-btn" onClick={() => setShowReportModal(true)} aria-label="Reportar">
            <span className="material-icons">flag</span>
          </button>
        </header>
      ) : (
        <header className="chat-header">
          <div className="logo small" onClick={() => navigate("/")} style={{cursor:'pointer'}}>
            <span className="logo-ba">BA</span>
            <span className="logo-fly">FLY</span>
          </div>
          <div className={`status-chip ${status}`}>
            {status === "searching" && (
              <>
                <span className="material-icons status-spinner" aria-hidden="true">autorenew</span>
                A procurar
              </>
            )}
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
      )}

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
          remoteVideoOff={remoteVideoOff}
          remotePlayBlocked={remotePlayBlocked}
          onRetryPlay={() => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.play().then(() => setRemotePlayBlocked(false)).catch(() => {});
            }
          }}
          localVideoActive={!!localStream}
          isVideoOff={isVideoOff}
          isMuted={isMuted}
          remoteIsMuted={remoteIsMuted}
          onTap={isMobile && isChatOpen ? () => setIsChatOpen(false) : undefined}
          isMobile={isMobile}
          hasMultipleCameras={hasMultipleCameras}
          onSwitchCamera={handleSwitchCamera}
        />
        {isMobile && isChatOpen ? (
          <div className="chat-backdrop" onClick={() => setIsChatOpen(false)} />
        ) : null}
        {!isMobile || isChatOpen ? (
          <ChatBox
            messages={messages}
            onSendMessage={sendMessage}
            disabled={false}
            showClose={isMobile}
            onClose={() => setIsChatOpen(false)}
            isOpen={!isMobile || isChatOpen}
          />
        ) : null}
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
        isMobile={isMobile}
        onOpenChat={() => setIsChatOpen(true)}
        unreadChatCount={unreadChatCount}
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
