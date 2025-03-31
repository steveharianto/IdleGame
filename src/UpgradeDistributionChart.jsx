import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement, // Needed for Doughnut charts
  Tooltip,
  Legend // Keep legend for this one, or use tooltips effectively
} from 'chart.js';

// Register necessary components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend
);

// Define colors - choose distinct but not overly bright colors
const UPGRADE_COLORS = [
  'rgba(75, 192, 192, 0.7)',  // Teal (Clicker)
  'rgba(54, 162, 235, 0.7)',  // Blue (Farm)
  'rgba(255, 206, 86, 0.7)',   // Yellow (Mine)
  'rgba(255, 99, 132, 0.7)',   // Red (Factory)
  'rgba(153, 102, 255, 0.7)', // Purple (If more upgrades added)
  'rgba(255, 159, 64, 0.7)'   // Orange (If more upgrades added)
];

const UpgradeDistributionChart = ({ upgrades }) => {
  // Filter out upgrades with 0 levels to avoid cluttering the chart
  const relevantUpgrades = upgrades.filter(u => u.level > 0);

  // If no upgrades have levels, display a placeholder message
  if (relevantUpgrades.length === 0) {
      return (
          <div style={{ 
              height: '150px', // Match expected height
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#aaa',
              fontSize: '0.9em',
              border: '1px dashed #444',
              borderRadius: '5px',
              padding: '10px',
              marginTop: '15px', // Add spacing below the earnings chart
              backgroundColor: 'rgba(40, 40, 40, 0.3)'
           }}>
              Purchase upgrades to see distribution.
          </div>
      );
  }

  const data = {
    labels: relevantUpgrades.map(u => u.name), // Upgrade names
    datasets: [
      {
        label: ' Levels', // Add space for tooltip formatting
        data: relevantUpgrades.map(u => u.level), // Number of levels for each
        backgroundColor: relevantUpgrades.map((u, index) => UPGRADE_COLORS[index % UPGRADE_COLORS.length]),
        borderColor: relevantUpgrades.map((u, index) => UPGRADE_COLORS[index % UPGRADE_COLORS.length].replace('0.7', '1')), // Solid border
        borderWidth: 1,
        hoverOffset: 4 // Slightly expand segment on hover
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true, // Show legend for Doughnut chart labels
        position: 'bottom', // Position legend below
        labels: {
          boxWidth: 12,
          padding: 15,
          font: { size: 10 },
          color: '#ccc'
        }
      },
      title: {
        display: false, // Keep title hidden for simplicity
      },
      tooltip: {
         enabled: true,
         backgroundColor: 'rgba(0, 0, 0, 0.8)',
         titleFont: { size: 11 },
         bodyFont: { size: 11 },
         padding: 8,
         callbacks: {
            // Customize tooltip label
            label: function(context) {
                let label = context.label || ''; // Upgrade name
                if (label) {
                    label += ': ';
                }
                // Get the raw value (level count)
                const value = context.raw;
                label += value + (value === 1 ? ' Level' : ' Levels');

                 // Optional: Calculate and add percentage
                 const total = context.chart.getDatasetMeta(0).total;
                 const percentage = ((value / total) * 100).toFixed(1) + '%';
                 label += ` (${percentage})`;

                return label;
            }
        }
      }
    },
    // Make the hole in the middle bigger
    cutout: '65%',
    animation: {
        animateRotate: true,
        animateScale: false // Don't scale, just rotate in
    }
  };

  return (
    <div style={{ 
        height: '200px', // Adjust height as needed
        marginTop: '15px', // Add spacing below the earnings chart
        padding: '5px' // Add a little padding
    }}>
        <Doughnut options={options} data={data} />
    </div>
  );
};

export default UpgradeDistributionChart; 