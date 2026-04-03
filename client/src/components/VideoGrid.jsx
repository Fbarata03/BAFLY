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
  localVideoActive
}) => {
  return (
    <div className="video-main-area">
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
        
        {/* Status Chip Overlay */}
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

        {/* Stranger Label */}
        <div className="label-stranger">
          STRANGER
        </div>
      </div>
      
      {/* Your Video (Floating Overlay) */}
      <div className="local-video-floating">
        <div className="local-video-inner">
          <video ref={localVideoRef} autoPlay muted playsInline className="local-video-feed" />
          <div className="label-you">YOU</div>
          
          {/* If no video yet */}
          {!localVideoActive && (
             <div className="local-placeholder-overlay">
                <span className="material-icons">videocam</span>
                <p>Your Camera</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoGrid;
