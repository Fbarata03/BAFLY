import React from 'react';
import './VideoGrid.css';

const flagUrl = (code) => `https://flagcdn.com/24x18/${String(code).toLowerCase()}.png`;

const VideoGrid = ({
  localVideoRef,
  remoteVideoRef,
  status,
  onlineCount,
  queueCount,
  localCountryCode,
  remoteCountryCode,
  remoteVideoActive,
  localVideoActive,
  isMuted,
  remoteIsMuted,
  onTap,
  isMobile,
  hasMultipleCameras,
  onSwitchCamera,
}) => {
  return (
    <div className="video-main-area" onClick={onTap}>
      {/* Stranger Video (Background/Main) */}
      <div className="remote-video-wrapper">
        {(status === 'searching' || status === 'disconnected' || (status === 'connected' && !remoteVideoActive)) && (
          <div className="video-placeholder-main">
            <div className="placeholder-icon-circle">
              <span className="material-icons">{status === 'disconnected' ? 'person_off' : 'videocam'}</span>
            </div>
            <p className="placeholder-text">
              {status === 'searching' ? (
                <>
                  A procurar alguém
                  <span className="searching-dots" aria-hidden="true">
                    <span>.</span><span>.</span><span>.</span>
                  </span>
                </>
              ) : status === 'disconnected' ? (
                'O estranho saiu. Clica NEXT para continuar.'
              ) : (
                'Conectando vídeo...'
              )}
            </p>
          </div>
        )}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`remote-video-main ${(!remoteVideoActive || status !== 'connected') ? 'hidden' : ''}`}
        />

        {/* Remote Mute Indicator */}
        {remoteIsMuted && status === 'connected' && (
          <div className="mute-indicator remote-mute">
            <span className="material-icons">mic_off</span>
          </div>
        )}
      </div>

      {/* Your Video (Floating PiP) */}
      <div className="local-video-floating">
        <div className="local-video-inner">
          <video ref={localVideoRef} autoPlay muted playsInline className="local-video-feed" />
          {!localVideoActive && (
            <div className="local-placeholder-overlay">
              <span className="material-icons">videocam</span>
            </div>
          )}
          {isMuted && (
            <div className="mute-indicator local-mute">
              <span className="material-icons">mic_off</span>
            </div>
          )}
          {/* Switch camera button inside PiP (mobile only) */}
          {isMobile && hasMultipleCameras && (
            <button
              className="pip-switch-btn"
              onClick={(e) => { e.stopPropagation(); onSwitchCamera(); }}
              aria-label="Trocar câmara"
            >
              <span className="material-icons">cameraswitch</span>
            </button>
          )}
        </div>
      </div>

      {/* Desktop overlays */}
      {!isMobile && (
        <>
          <div className={`status-overlay-chip ${status}`}>
            {status === 'connected' ? (
              <>
                {remoteCountryCode && (
                  <img
                    src={flagUrl(remoteCountryCode)}
                    alt={remoteCountryCode}
                    style={{ width: 18, height: 14, borderRadius: 2 }}
                  />
                )}
                Conectado
              </>
            ) : (
              <>
                <span className="status-dot"></span>
                A procurar
              </>
            )}
          </div>
          <div className="label-stranger">STRANGER</div>
          <div className="label-you">YOU</div>
        </>
      )}
    </div>
  );
};

export default VideoGrid;
