import React from 'react';
import './VideoGrid.css';

const flagUrl = (code) => `https://flagcdn.com/24x18/${String(code).toLowerCase()}.png`;

const VideoGrid = ({ localVideoRef, remoteVideoRef, status, localCountryCode, remoteCountryCode }) => {
  return (
    <div className="video-grid">
      <div className="video-container stranger">
        {status === 'searching' ? (
          <div className="video-placeholder">
            <div className="spinner"></div>
            <p>Finding someone...</p>
          </div>
        ) : (
          <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
        )}
        <div className="video-label">
          {remoteCountryCode ? <img className="video-flag" src={flagUrl(remoteCountryCode)} alt={remoteCountryCode} /> : null}
          <span>STRANGER</span>
        </div>
      </div>
      
      <div className="video-container you">
        <video ref={localVideoRef} autoPlay muted playsInline className="local-video" />
        <div className="video-label">
          {localCountryCode ? <img className="video-flag" src={flagUrl(localCountryCode)} alt={localCountryCode} /> : null}
          <span>YOU</span>
        </div>
      </div>
    </div>
  );
};

export default VideoGrid;
