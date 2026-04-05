import React, { useRef, useState, useEffect, useCallback } from 'react';
import './VideoGrid.css';

const flagUrl = (code) => `https://flagcdn.com/24x18/${String(code).toLowerCase()}.png`;

// Margins from edges (px) when snapped to a corner
const PIP_MARGIN = 12;
// Offset from top (header) and bottom (controls pill) when snapped
const TOP_SNAP    = 'calc(74px + env(safe-area-inset-top))';
const BOTTOM_SNAP = 'calc(106px + env(safe-area-inset-bottom))';

const cornerStyle = (corner) => ({
  top:    corner[0] === 't' ? TOP_SNAP    : 'auto',
  bottom: corner[0] === 'b' ? BOTTOM_SNAP : 'auto',
  left:   corner[1] === 'l' ? `${PIP_MARGIN}px` : 'auto',
  right:  corner[1] === 'r' ? `${PIP_MARGIN}px` : 'auto',
});

const VideoGrid = ({
  localVideoRef,
  remoteVideoRef,
  status,
  onlineCount,
  queueCount,
  localCountryCode,
  remoteCountryCode,
  remoteVideoActive,
  remoteVideoOff,
  localVideoActive,
  isVideoOff,
  isMuted,
  remoteIsMuted,
  onTap,
  isMobile,
  hasMultipleCameras,
  onSwitchCamera,
}) => {
  // 'br' | 'bl' | 'tr' | 'tl'
  const [pipCorner, setPipCorner] = useState('br');
  const [isDragging, setIsDragging] = useState(false);
  const pipRef = useRef(null);
  const dragRef = useRef(null);

  // Touch move handler (needs passive:false to preventDefault)
  const handleTouchMove = useCallback((e) => {
    if (!dragRef.current || !pipRef.current) return;
    const touch = e.touches[0];

    const dx = Math.abs(touch.clientX - dragRef.current.startX);
    const dy = Math.abs(touch.clientY - dragRef.current.startY);
    if (dx > 6 || dy > 6) dragRef.current.moved = true;
    if (!dragRef.current.moved) return;

    e.preventDefault(); // stop page scroll while dragging

    const containerRect = pipRef.current.parentElement.getBoundingClientRect();
    const pipW = pipRef.current.offsetWidth;
    const pipH = pipRef.current.offsetHeight;

    let newLeft = touch.clientX - containerRect.left - dragRef.current.offsetX;
    let newTop  = touch.clientY - containerRect.top  - dragRef.current.offsetY;

    // Clamp inside container
    newLeft = Math.max(0, Math.min(newLeft, containerRect.width  - pipW));
    newTop  = Math.max(0, Math.min(newTop,  containerRect.height - pipH));

    pipRef.current.style.left   = `${newLeft}px`;
    pipRef.current.style.top    = `${newTop}px`;
    pipRef.current.style.right  = 'auto';
    pipRef.current.style.bottom = 'auto';
    pipRef.current.style.transition = 'none';

    dragRef.current.lastLeft = newLeft;
    dragRef.current.lastTop  = newTop;
  }, []);

  // Attach touchmove with passive:false so preventDefault works
  useEffect(() => {
    const el = pipRef.current;
    if (!el || !isMobile) return;
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', handleTouchMove);
  }, [isMobile, handleTouchMove]);

  const handleTouchStart = (e) => {
    if (!isMobile) return;
    const touch = e.touches[0];
    const rect  = pipRef.current.getBoundingClientRect();
    dragRef.current = {
      offsetX: touch.clientX - rect.left,
      offsetY: touch.clientY - rect.top,
      startX:  touch.clientX,
      startY:  touch.clientY,
      moved:   false,
      lastLeft: null,
      lastTop:  null,
    };
    setIsDragging(true);
  };

  const handleTouchEnd = (e) => {
    if (!dragRef.current) return;
    setIsDragging(false);

    if (!dragRef.current.moved) {
      dragRef.current = null;
      return;
    }

    const containerRect = pipRef.current.parentElement.getBoundingClientRect();
    const pipW = pipRef.current.offsetWidth;
    const pipH = pipRef.current.offsetHeight;

    const centerX = (dragRef.current.lastLeft ?? 0) + pipW / 2;
    const centerY = (dragRef.current.lastTop  ?? 0) + pipH / 2;

    const isTop  = centerY < containerRect.height / 2;
    const isLeft = centerX < containerRect.width  / 2;
    const newCorner = `${isTop ? 't' : 'b'}${isLeft ? 'l' : 'r'}`;

    // Clear inline styles — CSS takes over for the snapped corner
    pipRef.current.style.left   = '';
    pipRef.current.style.top    = '';
    pipRef.current.style.right  = '';
    pipRef.current.style.bottom = '';
    pipRef.current.style.transition = '';

    setPipCorner(newCorner);
    dragRef.current = null;
  };

  const pipInlineStyle = isMobile
    ? {
        ...cornerStyle(pipCorner),
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: isDragging ? 'none' : 'top 0.22s ease, bottom 0.22s ease, left 0.22s ease, right 0.22s ease',
        touchAction: 'none',
        userSelect: 'none',
      }
    : {};

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

        {/* Remote camera off overlay */}
        {remoteVideoOff && remoteVideoActive && status === 'connected' && (
          <div className="remote-camera-off-overlay">
            <div className="cam-off-avatar">
              <span className="material-icons">person</span>
            </div>
            <div className="cam-off-name">
              {remoteCountryCode && (
                <img
                  src={flagUrl(remoteCountryCode)}
                  alt={remoteCountryCode}
                  className="cam-off-flag"
                />
              )}
              <span>STRANGER</span>
            </div>
            <div className="cam-off-status">
              <span className="material-icons">videocam_off</span>
              <span>Câmara desligada</span>
            </div>
          </div>
        )}

        {/* Remote Mute Indicator */}
        {remoteIsMuted && status === 'connected' && (
          <div className="mute-indicator remote-mute">
            <span className="material-icons">mic_off</span>
          </div>
        )}
      </div>

      {/* Your Video (Draggable PiP on mobile, floating on desktop) */}
      <div
        ref={pipRef}
        className="local-video-floating"
        style={pipInlineStyle}
        onTouchStart={isMobile ? handleTouchStart : undefined}
        onTouchEnd={isMobile ? handleTouchEnd : undefined}
      >
        <div className="local-video-inner">
          <video ref={localVideoRef} autoPlay muted playsInline className="local-video-feed" />
          {(!localVideoActive || isVideoOff) && (
            <div className="local-placeholder-overlay">
              <span className="material-icons">{isVideoOff ? 'videocam_off' : 'videocam'}</span>
              {isVideoOff && <span className="local-cam-off-label">Câmara off</span>}
            </div>
          )}
          {isMuted && (
            <div className="mute-indicator local-mute">
              <span className="material-icons">mic_off</span>
            </div>
          )}
          {/* Switch camera inside PiP (mobile only) */}
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
