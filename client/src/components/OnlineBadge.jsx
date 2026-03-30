import React from 'react';
import './OnlineBadge.css';

const OnlineBadge = ({ count }) => {
  return (
    <div className="online-badge">
      <span className="dot pulse"></span>
      <span className="count">{count} online now</span>
    </div>
  );
};

export default OnlineBadge;
