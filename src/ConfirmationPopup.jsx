import React from 'react';
import './ConfirmationPopup.css'; // We'll add styles shortly

function ConfirmationPopup({ message, onConfirm, onCancel }) {
  // Don't render if there's no message
  if (!message) return null;

  return (
    <div className="confirm-popup-overlay" onClick={onCancel}> {/* Close on overlay click (cancel) */}
      <div className="confirm-popup-content" onClick={(e) => e.stopPropagation()}>
        <h2>Confirmation</h2>
        <p>{message}</p>
        <div className="confirm-popup-buttons">
          <button onClick={onConfirm} className="confirm-button">
            Yes, Prestige!
          </button>
          <button onClick={onCancel} className="cancel-button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmationPopup; 