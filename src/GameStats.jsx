import React from 'react';

// Reuse or import the formatter
const formatNumber = (num) => {
    if (isNaN(num) || num === undefined || num === null) return "0"; // Simple format for stats
    if (num >= 1e12) return (num / 1e12).toFixed(1) + ' T';
    if (num >= 1e9) return (num / 1e9).toFixed(1) + ' B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + ' M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + ' K';
    return num.toFixed(0);
};

// Helper to format time duration
const formatDuration = (ms) => {
  if (isNaN(ms) || ms <= 0) return '0s';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let str = '';
  if (days > 0) str += `${days}d `;
  if (hours > 0 || days > 0) str += `${hours}h `;
  if (minutes > 0 || hours > 0 || days > 0) str += `${minutes}m `;
  str += `${seconds}s`;
  
  return str.trim() || '0s';
};

const GameStats = ({ 
    totalClicks, 
    manualEarnings, 
    totalEarnings, 
    startTime, 
    prestigeCount, 
    highestCoins 
}) => {
  const timePlayedMs = Date.now() - startTime;

  const statsContainerStyle = {
    padding: '15px',
    border: '1px solid #444',
    borderRadius: '5px',
    backgroundColor: 'rgba(40, 40, 40, 0.5)',
    color: '#ccc',
    fontSize: '0.9em',
    minWidth: '200px', // Ensure it doesn't get too small
  };

  const statItemStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    borderBottom: '1px solid #333',
    paddingBottom: '5px',
  };

  const statLabelStyle = {
    color: '#aaa',
  };

  const statValueStyle = {
    fontWeight: 'bold',
    color: '#eee',
  };

  return (
    <div style={statsContainerStyle}>
      <h3 style={{ marginTop: 0, marginBottom: '15px', textAlign: 'center', color: '#eee' }}>Statistics</h3>
      
      <div style={statItemStyle}>
        <span style={statLabelStyle}>Time Played:</span>
        <span style={statValueStyle}>{formatDuration(timePlayedMs)}</span>
      </div>
      <div style={statItemStyle}>
        <span style={statLabelStyle}>Total Clicks:</span>
        <span style={statValueStyle}>{formatNumber(totalClicks)}</span>
      </div>
      <div style={statItemStyle}>
        <span style={statLabelStyle}>Manual Earnings:</span>
        <span style={statValueStyle}>${formatNumber(manualEarnings)}</span>
      </div>
       <div style={statItemStyle}>
        <span style={statLabelStyle}>Total Earnings (All Time):</span>
        <span style={statValueStyle}>${formatNumber(totalEarnings)}</span>
      </div>
       <div style={statItemStyle}>
        <span style={statLabelStyle}>Highest Coins Held:</span>
        <span style={statValueStyle}>${formatNumber(highestCoins)}</span>
      </div>
      <div style={{...statItemStyle, borderBottom: 'none', marginBottom: 0 }}> {/* Last item no border */}
        <span style={statLabelStyle}>Prestiges:</span>
        <span style={statValueStyle}>{prestigeCount}</span>
      </div>
      
    </div>
  );
};

export default GameStats; 