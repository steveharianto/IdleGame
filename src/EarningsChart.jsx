import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  TimeScale
} from 'chart.js';
import 'chartjs-adapter-date-fns';

// Register necessary Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  TimeScale
);

// Utility to format numbers for the chart
const formatChartNumber = (num) => {
  if (num >= 1e12) return (num / 1e12).toFixed(1) + ' T';
  if (num >= 1e9) return (num / 1e9).toFixed(1) + ' B';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + ' M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + ' K';
  return num.toFixed(0);
};


const EarningsChart = ({ history }) => {
  const data = {
    datasets: [
      {
        // label: 'Total Earnings', // Optional: for tooltip fallback
         // Use totalEarnings from the history point for the y-value
        data: history.map(point => ({ x: point.timestamp, y: point.totalEarnings })), 
        borderColor: 'rgb(54, 162, 235)',  // Brighter blue color
        backgroundColor: 'rgba(54, 162, 235, 0.3)', // Lighter blue fill
        tension: 0.2, 
        pointRadius: 0, 
        borderWidth: 2, // Make line slightly thicker
        fill: true, 
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { 
          display: true, // Display title again
          text: 'Total Earnings Over Time', // Update title text
          color: '#ccc',
          font: { size: 12 }
      }, 
       tooltip: {
            enabled: true,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            titleFont: { size: 10 },
            bodyFont: { size: 10 },
            padding: 6,
            callbacks: {
                title: function() { return ''; }, 
                label: function(context) {
                    if (context.parsed.y !== null) {
                         // Update tooltip label to reflect total earnings
                        return 'Total Earned: $' + formatChartNumber(context.parsed.y); 
                    }
                    return '';
                }
            }
        }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'minute',
           displayFormats: {
              minute: 'h:mm'
           }
        },
         grid: {
            display: false,
         },
         ticks: {
             maxRotation: 0,
             autoSkip: true,
             maxTicksLimit: 5,
             font: { size: 9 },
             color: '#aaa'
         },
         border: {
             display: false
         }
      },
      y: {
        // title: { display: true, text: 'Total Earned', color: '#aaa', font: { size: 10 } }, // Optional: Add axis title
        grid: {
            color: 'rgba(100, 100, 100, 0.1)',
            drawBorder: false,
        },
        ticks: {
            callback: function(value) {
                if (value === 0) return '$0';
                return '$' + formatChartNumber(value);
            },
            maxTicksLimit: 4,
            font: { size: 9 },
            color: '#aaa'
        },
         border: {
             display: false
         }
      },
    },
     interaction: {
         intersect: false,
         mode: 'index',
     },
     animation: false,
     parsing: false,
     normalized: true,
  };

  return (
      <div style={{ 
          height: '200px', 
          marginTop: '10px', 
          border: '1px solid #444',
          borderRadius: '5px',
          padding: '10px', // Restore slightly more padding for title
          backgroundColor: 'rgba(40, 40, 40, 0.5)'
      }}> 
          <Line options={options} data={data} />
      </div>
    );
};

export default EarningsChart; 