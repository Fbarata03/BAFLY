import React from 'react';
import './Controls.css';

const Controls = ({
  onNext,
  onStop,
  onMute,
  onVideoOff,
  onSwitchCamera,
  onReport,
  hasMultipleCameras,
  isMuted,
  isVideoOff,
  isMobile,
  onOpenChat,
  unreadChatCount,
}) => {
  if (isMobile) {
    return (
      <div className="controls-pill">
        <button className="pill-btn grey" onClick={onOpenChat} aria-label="Chat">
          <span className="material-icons">chat</span>
          {unreadChatCount > 0 && (
            <span className="pill-badge">{unreadChatCount}</span>
          )}
          <span className="pill-label">Chat</span>
        </button>

        <button
          className={`pill-btn ${isVideoOff ? 'grey' : 'white'}`}
          onClick={onVideoOff}
          aria-label={isVideoOff ? 'Ligar câmara' : 'Desligar câmara'}
        >
          <span className="material-icons">{isVideoOff ? 'videocam_off' : 'videocam'}</span>
          <span className="pill-label">Câmara</span>
        </button>

        {hasMultipleCameras && (
          <button
            className="pill-btn grey"
            onClick={onSwitchCamera}
            aria-label="Virar câmara"
          >
            <span className="material-icons">cameraswitch</span>
            <span className="pill-label">Virar</span>
          </button>
        )}

        <button
          className={`pill-btn ${isMuted ? 'grey' : 'white'}`}
          onClick={onMute}
          aria-label={isMuted ? 'Ativar mic' : 'Silenciar'}
        >
          <span className="material-icons">{isMuted ? 'mic_off' : 'mic'}</span>
          <span className="pill-label">Mic</span>
        </button>

        <button className="pill-btn blue" onClick={onNext} aria-label="Próximo">
          <span className="material-icons">skip_next</span>
          <span className="pill-label">Next</span>
        </button>

        <button className="pill-btn red" onClick={onStop} aria-label="Terminar">
          <span className="material-icons">call_end</span>
          <span className="pill-label">Sair</span>
        </button>
      </div>
    );
  }

  return (
    <div className="controls-bar">
      <button className="ctrl-btn mute" onClick={onMute} title={isMuted ? "Unmute" : "Mute"}>
        <span className="material-icons">{isMuted ? 'mic_off' : 'mic'}</span>
        <span className="btn-label">{isMuted ? "[OFF]" : "MUTE"}</span>
      </button>
      <button className="ctrl-btn camera" onClick={onVideoOff} title={isVideoOff ? "Video On" : "Video Off"}>
        <span className="material-icons">{isVideoOff ? 'videocam_off' : 'videocam'}</span>
        <span className="btn-label">{isVideoOff ? "[OFF]" : "CAM"}</span>
      </button>
      {hasMultipleCameras && (
        <button className="ctrl-btn camera-switch" onClick={onSwitchCamera} title="Switch Camera">
          <span className="material-icons">cameraswitch</span>
          <span className="btn-label">TROCAR</span>
        </button>
      )}
      <button className="ctrl-btn next-btn" onClick={onNext}>
        <span className="material-icons">skip_next</span>
        NEXT
      </button>
      <button className="ctrl-btn report" onClick={onReport}>
        <span className="material-icons">flag</span>
        <span className="btn-label">REPORT</span>
      </button>
      <button className="ctrl-btn stop" onClick={onStop}>
        <span className="material-icons">close</span>
        <span className="btn-label">STOP</span>
      </button>
    </div>
  );
};

export default Controls;
