import React from 'react';
import './OfflineProgressPopup.css'; // We'll add styles shortly

function OfflineProgressPopup({ message, onClose }) {
  // Don't render anything if there's no message
  if (!message) return null;

  return (
    // Overlay to dim the background
    <div className="popup-overlay" onClick={onClose}> {/* Optional: Close on overlay click */}
      {/* Stop propagation so clicking content doesn't close it */}
      <div className="popup-content" onClick={(e) => e.stopPropagation()}>
        <h2>Welcome Back!</h2>
        <p>{message}</p>
        <button onClick={onClose}>Got it!</button>
      </div>
    </div>
  );
}

export default OfflineProgressPopup; 