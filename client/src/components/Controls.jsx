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
  isVideoOff 
}) => {
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
