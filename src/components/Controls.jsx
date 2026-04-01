import React from 'react';
import './Controls.css';

const Controls = ({ onNext, onStop, onMute, onVideoOff, onReport, isMuted, isVideoOff }) => {
  return (
    <div className="controls-bar">
      <button className="ctrl-btn mute" onClick={onMute} title={isMuted ? "Unmute" : "Mute"}>
        {isMuted ? "🎤 [OFF]" : "🎤 MUTE"}
      </button>
      <button className="ctrl-btn camera" onClick={onVideoOff} title={isVideoOff ? "Video On" : "Video Off"}>
        {isVideoOff ? "📷 [OFF]" : "📷 CAM"}
      </button>
      <button className="ctrl-btn next-btn" onClick={onNext}>
        ⏭ NEXT
      </button>
      <button className="ctrl-btn report" onClick={onReport}>
        🚩 REPORT
      </button>
      <button className="ctrl-btn stop" onClick={onStop}>
        ✕ STOP
      </button>
    </div>
  );
};

export default Controls;
