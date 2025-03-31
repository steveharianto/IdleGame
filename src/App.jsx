import { useState, useEffect, useRef } from "react";
import EarningsChart from './EarningsChart'; // Import the chart component
import UpgradeDistributionChart from './UpgradeDistributionChart'; // Import the new chart
import GameStats from './GameStats'; // Import the stats component
import OfflineProgressPopup from './OfflineProgressPopup'; // Import the new popup component
import ConfirmationPopup from './ConfirmationPopup'; // *** Import the Confirmation Popup ***

import "./App.css";
import "./OfflineProgressPopup.css"; // Import the popup styles
import "./ConfirmationPopup.css"; // *** Import Confirmation Popup CSS ***

// --- Helper Functions (Moved outside the component) ---
const PRESTIGE_REQUIREMENT = 1e6; // 1 Million coins needed to prestige

// Calculates how many prestige points you would gain
const calculatePrestigeGain = (currentCoins) => {
    if (currentCoins < PRESTIGE_REQUIREMENT) return 0;
    return Math.floor(5 * Math.cbrt(currentCoins / 1e6)); 
};

// Calculates the CPS bonus multiplier from prestige points
const calculatePrestigeBonus = (points) => {
    return Math.pow(1.02, points); 
};

// Calculates the base CPS sum from all non-clicker upgrades
const calculateBaseCPS = (currentUpgrades) => {
    return currentUpgrades.reduce((sum, upgrade) => {
        if (upgrade.id === 1) return sum; 
        return sum + (upgrade.effect * upgrade.level);
    }, 0.1); 
};

// Calculates the final CPS including the prestige bonus
const calculateTotalCPS = (currentUpgrades, currentPrestigePoints) => {
    const baseCPS = calculateBaseCPS(currentUpgrades);
    const bonus = calculatePrestigeBonus(currentPrestigePoints);
    return baseCPS * bonus;
};

// Format large numbers with prefixes (K, M, B, etc.) - Moved outside as well for consistency
const formatNumber = (num) => {
    if (isNaN(num) || num === undefined || num === null) return "0.00";
    
    const prefixes = ["", "K", "M", "B", "T", "Q"];
    let prefix = 0;
    let value = num;
    value = Number(value);
    
    while (value >= 1000 && prefix < prefixes.length - 1) {
        value /= 1000;
        prefix++;
    }
    
    return `${value.toFixed(2)} ${prefixes[prefix]}`;
};

// --- NEW: Bulk Buy Helper Functions ---

// Calculates the total cost of buying a specific quantity of an upgrade
const getBulkUpgradeCost = (upgrade, quantity) => {
    if (quantity <= 0) return 0;
    let totalCost = 0;
    const baseCost = upgrade.baseCost;
    const multiplier = 1.15; // Defined cost multiplier
    const currentLevel = upgrade.level;

    for (let i = 0; i < quantity; i++) {
        const levelToCalc = currentLevel + i;
        totalCost += Math.floor(baseCost * Math.pow(multiplier, levelToCalc));
    }
    return totalCost;
};

// Calculates the maximum quantity of an upgrade affordable with current coins
const calculateMaxAffordable = (upgrade, currentCoins) => {
    let quantity = 0;
    let totalCost = 0;
    const baseCost = upgrade.baseCost;
    const multiplier = 1.15;
    const currentLevel = upgrade.level;

    // Use Number.MAX_SAFE_INTEGER as a safety break for the loop
    for (let i = 0; i < Number.MAX_SAFE_INTEGER; i++) {
        const levelToCalc = currentLevel + i;
        const nextLevelCost = Math.floor(baseCost * Math.pow(multiplier, levelToCalc));

        if (totalCost + nextLevelCost <= currentCoins) {
            totalCost += nextLevelCost;
            quantity++;
        } else {
            break; // Cannot afford the next level
        }
    }
    return quantity;
};

// --- NEW: Calculates the Click bonus multiplier from prestige points ---
const calculatePrestigeClickBonus = (points) => {
    // Example: Each point gives a 1.5% boost to click value, multiplicative
    // Adjust the 1.015 value to balance clicking vs. idle
    return Math.pow(1.015, points);
};

// --- FULL UPGRADE LIST ---
const ALL_UPGRADES = [
    { id: 1, name: "Clicker", level: 0, baseCost: 10, effect: 1 }, // Effect is per click
    { id: 2, name: "Farm", level: 0, baseCost: 100, effect: 5 }, // Effect is base CPS
    { id: 3, name: "Mine", level: 0, baseCost: 1100, effect: 50 },
    { id: 4, name: "Factory", level: 0, baseCost: 12000, effect: 500 },
    // --- New Upgrades ---
    { id: 5, name: "Bank", level: 0, baseCost: 130000, effect: 6000 },       // 130 K
    { id: 6, name: "Temple", level: 0, baseCost: 1.5e6, effect: 75000 },      // 1.5 M
    { id: 7, name: "Portal", level: 0, baseCost: 20e6, effect: 900000 },      // 20 M
    { id: 8, name: "Alchemy Lab", level: 0, baseCost: 330e6, effect: 10e6 }, // 330 M
    { id: 9, name: "Shipment", level: 0, baseCost: 5e9, effect: 150e6 },     // 5 B
    { id: 10, name: "Time Machine", level: 0, baseCost: 75e9, effect: 2.5e9 }, // 75 B
];

function App() {
    const MAX_HISTORY_POINTS = 60; // Store last 60 data points (e.g., 10 minutes if saving every 10s)

    // Initialize game state from localStorage or use defaults
    const [gameState, setGameState] = useState(() => {
        const savedGame = localStorage.getItem("idleGameSave");
        
        // Start with a structure based on ALL_UPGRADES
        let initialState = {
            coins: 0,
            coinsPerSecond: 0,
            lastUpdate: Date.now(),
            // Use ALL_UPGRADES as the base structure
            upgrades: ALL_UPGRADES.map(u => ({ ...u, level: 0 })), 
            prestigePoints: 0,
            coinHistory: [],
            totalClicks: 0,
            manualEarnings: 0,
            totalEarnings: 0,
            startTime: Date.now(),
            prestigeCount: 0,
            highestCoins: 0
        };

        if (savedGame) {
            try {
                const loadedState = JSON.parse(savedGame);
                
                // Create a map of loaded levels for easy lookup
                const loadedLevels = (loadedState.upgrades || []).reduce((map, upgrade) => {
                    map[upgrade.id] = upgrade.level;
                    return map;
                }, {});

                // Merge loaded levels into the full upgrade list
                const mergedUpgrades = ALL_UPGRADES.map(defaultUpgrade => ({
                    ...defaultUpgrade,
                    level: loadedLevels[defaultUpgrade.id] || 0 // Use loaded level or default to 0
                }));

                initialState = {
                    ...initialState, // Start with defaults
                    ...loadedState,  // Override with saved basic data
                    upgrades: mergedUpgrades, // Use the merged list
                    // Ensure stats have defaults if loading old save
                    totalEarnings: loadedState.totalEarnings || (loadedState.coins || 0),
                    highestCoins: loadedState.highestCoins || (loadedState.coins || 0),
                    // ... (other stat defaults as before) ...
                    coinHistory: (loadedState.coinHistory || [])
                       .map(p => ({ timestamp: p.timestamp, totalEarnings: p.totalEarnings ?? p.coins ?? 0 }))
                       .slice(-MAX_HISTORY_POINTS),
                };

            } catch (error) {
                console.error("Error loading saved game:", error);
                localStorage.removeItem("idleGameSave"); // Clear corrupted save
            }
        }
        
        initialState.coinsPerSecond = calculateTotalCPS(initialState.upgrades, initialState.prestigePoints);
        if (initialState.coinHistory.length === 0) {
            initialState.coinHistory.push({ timestamp: initialState.lastUpdate, totalEarnings: initialState.totalEarnings });
        }

        return initialState;
    });

    const { 
        coins, coinsPerSecond, upgrades, prestigePoints, coinHistory,
        totalClicks, manualEarnings, totalEarnings, startTime, prestigeCount, highestCoins 
    } = gameState;

    // Add at the top of your component
    const [isPurchasing, setIsPurchasing] = useState(false);

    // Add state for click animations
    const [clickEffects, setClickEffects] = useState([]);
    const coinRef = useRef(null);

    // --- NEW: State for Buy Multiplier ---
    const [buyMultiplier, setBuyMultiplier] = useState(1); // Default to buying 1

    // --- Define multiplier options ---
    const multiplierOptions = [1, 10, 100, 'max'];

    // *** NEW: State for the offline progress popup message ***
    const [offlineProgressInfo, setOfflineProgressInfo] = useState(null);
    // *** NEW: State for confirmation dialogs ***
    const [confirmationInfo, setConfirmationInfo] = useState(null); // Stores { message, onConfirm }

    // Game loop - update coins with precision handling
    useEffect(() => {
        // Set a fixed starting time to ensure consistent tracking
        const gameStartTime = Date.now();
        let lastUpdateTime = gameStartTime;
        
        const updateGame = () => {
            const now = Date.now();
            const elapsed = (now - lastUpdateTime) / 1000;
            lastUpdateTime = now;
            
            setGameState(prev => {
                // Ensure consistent numeric handling
                const increment = Number((prev.coinsPerSecond * elapsed).toFixed(10));
                const newCoins = Number((prev.coins + increment).toFixed(10));
                return {
                    ...prev,
                    coins: newCoins,
                    // Update total earnings (approximate - more accurate if calculated differently)
                    totalEarnings: prev.totalEarnings + increment, 
                    // Update highest coins if needed
                    highestCoins: Math.max(prev.highestCoins, newCoins), 
                    lastUpdate: now
                };
            });
        };
        
        // Run game loop consistently
        const intervalId = setInterval(updateGame, 100);
        
        // Handle offline progress separately with better precision
        const checkOfflineProgress = () => {
            const now = Date.now();
            // Use gameState from state, not closure, for latest value
            setGameState(prev => {
                const offlineTime = (now - prev.lastUpdate) / 1000;
                let newCoins = prev.coins;
                let newTotalEarnings = prev.totalEarnings;
                let newHighestCoins = prev.highestCoins;
                let popupMessage = null; // Variable to hold potential popup message

                if (offlineTime > 5) { // Check for significant offline time
                    const earnings = parseFloat((prev.coinsPerSecond * offlineTime).toFixed(10));

                    if (!isNaN(earnings) && earnings > 0) {
                        // *** Set the popup message instead of alert ***
                        popupMessage = `You earned $${formatNumber(earnings)} while away.`;
                        console.log("Offline earnings:", earnings); // Keep console log for debugging
                    }

                    const earnedCoins = isNaN(earnings) ? 0 : earnings;
                    newCoins = parseFloat((prev.coins + earnedCoins).toFixed(10));
                    newTotalEarnings = prev.totalEarnings + earnedCoins;
                    newHighestCoins = Math.max(prev.highestCoins, newCoins);
                }

                // Update state including new coins and lastUpdate
                const newState = {
                    ...prev,
                    coins: newCoins,
                    totalEarnings: newTotalEarnings,
                    highestCoins: newHighestCoins,
                    lastUpdate: now
                };

                // *** Trigger the popup state update AFTER game state update ***
                // Use setTimeout to ensure it happens after the current render cycle
                setTimeout(() => {
                    if (popupMessage) {
                        setOfflineProgressInfo(popupMessage);
                    }
                }, 0);

                return newState;
            });
        };
        
        // Check offline progress after a small delay
        const offlineCheckTimeout = setTimeout(checkOfflineProgress, 100);

        return () => {
            clearInterval(intervalId);
            clearTimeout(offlineCheckTimeout);
        };
    }, []);

    // Save game state to localStorage and record history
    useEffect(() => {
        const saveInterval = setInterval(() => {
            setGameState(prev => {
                const now = Date.now();
                // Use the current totalEarnings for the history point
                const currentTotalEarnings = prev.totalEarnings; 

                // Add current state to history using totalEarnings
                const newHistory = [
                    ...prev.coinHistory, 
                    { timestamp: now, totalEarnings: currentTotalEarnings } 
                ].slice(-MAX_HISTORY_POINTS); 

                const newState = {
                    ...prev,
                    coinHistory: newHistory
                };
                
                localStorage.setItem("idleGameSave", JSON.stringify(newState));
                return newState; 
            });
        }, 10000); 
        
        return () => clearInterval(saveInterval);
    }, []); 

    // Calculate cost for an upgrade
    const getUpgradeCost = (upgrade) => {
        return Math.floor(upgrade.baseCost * Math.pow(1.15, upgrade.level));
    };

    // Purchase an upgrade with consistent number handling AND bulk buying
    const buyUpgrade = (id) => {
        // No need for isPurchasing lock for this logic if state updates are handled correctly
        // if (isPurchasing) return;
        // setIsPurchasing(true);

        setGameState(prev => {
            const currentCoins = Number(prev.coins.toFixed(10));
            const upgradeIndex = prev.upgrades.findIndex(u => u.id === id);
            if (upgradeIndex === -1) return prev;

            const upgradeToBuy = prev.upgrades[upgradeIndex];

            // --- Determine quantity and cost based on the multiplier ---
            let quantityToBuy = 0;
            let totalCost = 0;

            if (buyMultiplier === 'max') {
                quantityToBuy = calculateMaxAffordable(upgradeToBuy, currentCoins);
                totalCost = getBulkUpgradeCost(upgradeToBuy, quantityToBuy);
            } else {
                quantityToBuy = Number(buyMultiplier); // Ensure it's a number
                totalCost = getBulkUpgradeCost(upgradeToBuy, quantityToBuy);
            }

            // --- Check affordability (redundant for 'max', safety for others) ---
            if (quantityToBuy <= 0 || currentCoins < totalCost) {
                console.log(`Purchase failed: Have ${currentCoins}, need ${totalCost} for ${quantityToBuy} levels.`);
                // setIsPurchasing(false);
                return prev; // Cannot afford or buy 0
            }

            // --- Perform the update ---
            const newLevel = upgradeToBuy.level + quantityToBuy;

            // Create a new upgrades array with the updated level
            const newUpgrades = prev.upgrades.map((u, index) =>
                index === upgradeIndex ? {...u, level: newLevel } : u
            );

            const newCoins = Number((currentCoins - totalCost).toFixed(10));
            // Recalculate total CPS based on *new* upgrade levels and existing prestige
            const newCPS = calculateTotalCPS(newUpgrades, prev.prestigePoints);

            console.log(`Purchase successful: ${upgradeToBuy.name} x${quantityToBuy} for ${totalCost}. New balance: ${newCoins}. New level: ${newLevel}`);

            return {
                ...prev,
                coins: newCoins,
                coinsPerSecond: newCPS,
                upgrades: newUpgrades
            };
        });

        // setTimeout(() => setIsPurchasing(false), 50); // Can likely remove the purchasing lock
    };

    // Enhanced click handler with animations AND prestige bonus
    const handleClick = (event) => {
        // Get click position relative to the element
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // --- Calculate click value with Prestige Bonus ---
        const clickerLevel = upgrades.find(u => u.id === 1).level;
        const baseClickValue = 1 + clickerLevel;
        const prestigeClickMultiplier = calculatePrestigeClickBonus(prestigePoints);
        const clickValue = baseClickValue * prestigeClickMultiplier; // Keep the precise value for calculations

        // --- Create floating text effect with ROUNDED value ---
        const newEffect = {
            id: Date.now(),
            x,
            y,
            value: Math.round(clickValue) // Use the rounded value *only* for display
        };

        setClickEffects(prev => [...prev, newEffect]);

        // Remove effect after animation completes
        setTimeout(() => {
            setClickEffects(prev => prev.filter(effect => effect.id !== newEffect.id));
        }, 1000);

        // Add pulse animation to the coin amount
        if (coinRef.current) {
            coinRef.current.classList.remove('pulse-animation');
            void coinRef.current.offsetWidth; // Force reflow
            coinRef.current.classList.add('pulse-animation');
        }

        // --- Update coins AND stats using the PRECISE clickValue ---
        setGameState(prev => {
            // Recalculate precise value inside here for safety
            const currentPrestigeClickMultiplier = calculatePrestigeClickBonus(prev.prestigePoints);
            const currentPreciseClickValue = (1 + (prev.upgrades.find(u => u.id === 1)?.level || 0)) * currentPrestigeClickMultiplier;

            const newManualEarnings = prev.manualEarnings + currentPreciseClickValue;
            const newCoins = prev.coins + currentPreciseClickValue;
            return {
                ...prev,
                coins: newCoins,
                totalClicks: prev.totalClicks + 1,
                manualEarnings: newManualEarnings,
                totalEarnings: prev.totalEarnings + currentPreciseClickValue,
                highestCoins: Math.max(prev.highestCoins, newCoins)
            };
        });
    };

    // Reset game - Potentially add confirmation later if needed
    const resetGame = () => {
        if (!confirm("Are you sure you want to HARD reset? This will erase ALL progress, including Prestige Points!")) {
            return;
        }
        localStorage.removeItem("idleGameSave");
        
        const initialStateReset = {
            coins: 0, coinsPerSecond: 0, lastUpdate: Date.now(),
            upgrades: ALL_UPGRADES.map(u => ({ ...u, level: 0 })),
            prestigePoints: 0, coinHistory: [{ timestamp: Date.now(), coins: 0 }],
            totalClicks: 0, manualEarnings: 0, totalEarnings: 0,
            startTime: Date.now(), prestigeCount: 0, highestCoins: 0
        };
        initialStateReset.coinsPerSecond = calculateTotalCPS(initialStateReset.upgrades, initialStateReset.prestigePoints);
        setGameState(initialStateReset);
    };

    // *** NEW: Function containing the actual prestige logic ***
    const executePrestige = (gain) => {
        setGameState(prev => {
            const newTotalPrestigePoints = prev.prestigePoints + gain;
            const initialUpgrades = ALL_UPGRADES.map(u => ({ ...u, level: 0 }));
            const newCPS = calculateTotalCPS(initialUpgrades, newTotalPrestigePoints);

            console.log(`Prestiged! Gained ${gain} points. Total: ${newTotalPrestigePoints}`);

            return {
                ...prev,
                coins: 0,
                coinsPerSecond: newCPS,
                upgrades: initialUpgrades,
                prestigePoints: newTotalPrestigePoints,
                lastUpdate: Date.now(),
                prestigeCount: prev.prestigeCount + 1,
                totalEarnings: prev.totalEarnings,
                coinHistory: prev.coinHistory,
                totalClicks: prev.totalClicks,
                manualEarnings: prev.manualEarnings,
                startTime: prev.startTime,
                highestCoins: prev.highestCoins,
            };
        });
    };

    // --- Prestige Function - Modified to use Popup ---
    const prestigeGame = () => {
        const gain = calculatePrestigeGain(coins);

        if (coins < PRESTIGE_REQUIREMENT || gain <= 0) {
            // Use the offline popup for simple info messages if desired, or keep alert
             setOfflineProgressInfo(`You need at least $${formatNumber(PRESTIGE_REQUIREMENT)} to prestige for points.`);
            // alert(`You need at least $${formatNumber(PRESTIGE_REQUIREMENT)} to prestige for points.`);
            return;
        }

        // *** Set confirmation state instead of calling confirm() ***
        setConfirmationInfo({
            message: `Are you sure you want to prestige? You will gain ${gain} Prestige Points, boosting future CPS, but reset your current coins and upgrades. Your total earnings and history will be kept.`,
            onConfirm: () => executePrestige(gain) // Pass the actual prestige execution function
        });
    };

    // --- NEW: Function to toggle the buy multiplier ---
    const toggleBuyMultiplier = () => {
        const currentIndex = multiplierOptions.indexOf(buyMultiplier);
        const nextIndex = (currentIndex + 1) % multiplierOptions.length; // Wrap around
        setBuyMultiplier(multiplierOptions[nextIndex]);
    };

    const closeOfflinePopup = () => {
        setOfflineProgressInfo(null);
    };

    // *** NEW: Handlers for the Confirmation Popup ***
    const handleConfirm = () => {
        if (confirmationInfo && typeof confirmationInfo.onConfirm === 'function') {
            confirmationInfo.onConfirm(); // Execute the stored action
        }
        setConfirmationInfo(null); // Close the popup
    };

    const handleCancel = () => {
        setConfirmationInfo(null); // Close the popup
    };

    return (
        <> {/* Fragment */}
            {/* Render Popups Conditionally */}
            <OfflineProgressPopup message={offlineProgressInfo} onClose={closeOfflinePopup} />
            {/* *** Render Confirmation Popup *** */}
            <ConfirmationPopup
                message={confirmationInfo?.message} // Use optional chaining
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />

            {/* Main container - Increase the gap */}
            <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'flex-start' }}> {/* Increased gap from 1.5rem to 2.5rem */}

                {/* --- Left Column: Statistics --- */}
                <div style={{ flex: 2, minWidth: '320px' }}> {/* Optional: Slightly increase minWidth */}
                     <GameStats 
                        totalClicks={totalClicks}
                        manualEarnings={manualEarnings}
                        totalEarnings={totalEarnings}
                        startTime={startTime}
                        prestigeCount={prestigeCount}
                        highestCoins={highestCoins}
                    />
                </div>

                {/* --- Middle Column: Main Game Elements --- */}
                <div style={{ flex: 3 }}> 
                    {/* Coin Display */}
                    <h1 
                        ref={coinRef}
                        className="coinValue" 
                        onClick={handleClick} 
                        style={{ cursor: 'pointer', userSelect: 'none', position: 'relative', marginBottom: '0.5rem' }} // Adjusted margin
                    >
                        ${formatNumber(coins)}
                        {/* Floating click effects */}
                        {clickEffects.map(effect => (
                             <div 
                                key={effect.id}
                                className="click-effect"
                                style={{
                                    position: 'absolute',
                                    left: `${effect.x}px`,
                                    top: `${effect.y}px`,
                                    color: '#4caf50',
                                    fontWeight: 'bold',
                                    pointerEvents: 'none'
                                }}
                            >
                                +{effect.value}
                            </div>
                        ))}
            </h1>
                    
                    {/* CPS Display */}
                    <p style={{ userSelect: 'none', marginTop: 0, marginBottom: '1rem' }}> {/* Adjusted margin */}
                        per second: ${formatNumber(coinsPerSecond)}
                    </p>

                    {/* Prestige Info Display - Added Click Bonus */}
                    <div style={{ margin: "0 0 1rem 0", padding: "10px", border: "1px solid #555", borderRadius: "5px", textAlign: 'left' }}>
                        <p style={{ margin: 0, fontWeight: 'bold' }}>Prestige</p>
                        <p style={{ margin: '5px 0 0 0' }}>Points: {prestigePoints}</p>
                        <p style={{ margin: '5px 0 0 0' }}>
                            {/* Display both bonuses */}
                            CPS Bonus: x{calculatePrestigeBonus(prestigePoints).toFixed(2)} | Click Bonus: x{calculatePrestigeClickBonus(prestigePoints).toFixed(2)}
                        </p>
                        {coins >= PRESTIGE_REQUIREMENT / 10 && (
                             <p style={{ margin: '5px 0 0 0', opacity: 0.8 }}>
                                 Gain on Prestige: +{calculatePrestigeGain(coins)} points
                             </p>
                        )}
                    </div>

                    {/* --- UPDATED: Single Buy Multiplier Toggle Button --- */}
                    <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                        <button
                            onClick={toggleBuyMultiplier} // Use the new toggle function
                            style={{
                                padding: '8px 15px', // Slightly larger padding
                                margin: '0 3px',
                                fontSize: '0.9em', // Slightly larger font
                                cursor: 'pointer',
                                border: '1px solid #777', // Consistent border
                                backgroundColor: '#444', // Consistent background
                                color: '#eee',
                                borderRadius: '4px',
                                minWidth: '100px' // Give it more width
                            }}
                            title="Click to change buy amount" // Add a tooltip
                        >
                            {/* Display the current multiplier */}
                            Buy: {buyMultiplier === 'max' ? 'Max' : `x${buyMultiplier}`}
                        </button>
                    </div>

                    {/* --- UPDATED: Upgrades List Container with Scroll --- */}
                    <div 
                        className="upgrade-list-container" // Add class name for CSS targeting
                        style={{ 
                            maxHeight: '210px', // Limit height (adjust as needed for ~5 items)
                            overflowY: 'auto',  // Enable vertical scrollbar only when content overflows
                            display: "flex", 
                            flexDirection: "column", 
                            gap: "5px",
                            paddingRight: '5px' // Add a little padding so scrollbar doesn't overlap content
                        }}
                    > 
                         {/* Filter upgrades based on totalEarnings before mapping */}
                         {upgrades
                            .filter(upgrade => totalEarnings >= upgrade.baseCost || upgrade.level > 0)
                            .map(upgrade => {
                                // --- Calculate cost and quantity (remains the same) ---
                                let quantityToBuy = 0;
                                let currentBulkCost = 0;
                                let isMaxAffordableZero = false;

                                if (buyMultiplier === 'max') {
                                    quantityToBuy = calculateMaxAffordable(upgrade, coins);
                                    currentBulkCost = getBulkUpgradeCost(upgrade, quantityToBuy);
                                    isMaxAffordableZero = quantityToBuy === 0;
                                } else {
                                    quantityToBuy = buyMultiplier;
                                    currentBulkCost = getBulkUpgradeCost(upgrade, quantityToBuy);
                                }
                                const cannotAfford = coins < currentBulkCost || (buyMultiplier === 'max' && isMaxAffordableZero);

                                // --- Calculate Total Effect Gain for Display (Including Prestige Bonus) ---
                                let effectDisplay = '';
                                // Get the current prestige bonus multiplier
                                const currentCpsBonusMultiplier = calculatePrestigeBonus(prestigePoints);

                                if (quantityToBuy > 0) {
                                    if (upgrade.id === 1) {
                                        // Clicker effect ALSO gets its own prestige bonus
                                        const currentClickBonusMultiplier = calculatePrestigeClickBonus(prestigePoints);
                                        const totalClickIncrease = upgrade.effect * quantityToBuy * currentClickBonusMultiplier;
                                        // Display click increase rounded to nearest whole number for simplicity
                                        effectDisplay = `+${Math.round(totalClickIncrease)}/click`;
                                    } else {
                                        // Base CPS increase from levels
                                        const baseCpsIncrease = upgrade.effect * quantityToBuy;
                                        // Apply the current prestige CPS bonus to the increase
                                        const totalCpsIncreaseWithBonus = baseCpsIncrease * currentCpsBonusMultiplier;
                                        effectDisplay = `+${formatNumber(totalCpsIncreaseWithBonus)}/s`;
                                    }
                                } else if (buyMultiplier !== 1) {
                                   effectDisplay = upgrade.id === 1 ? '+0/click' : '+0/s';
                                } else {
                                    // Default for x1 buy - show potential gain WITH bonus applied
                                    if (upgrade.id === 1) {
                                         const currentClickBonusMultiplier = calculatePrestigeClickBonus(prestigePoints);
                                         const singleClickIncrease = upgrade.effect * currentClickBonusMultiplier;
                                         effectDisplay = `+${Math.round(singleClickIncrease)}/click`;
                                    } else {
                                        const singleCpsIncreaseWithBonus = upgrade.effect * currentCpsBonusMultiplier;
                                        effectDisplay = `+${formatNumber(singleCpsIncreaseWithBonus)}/s`;
                                    }
                                }

                                // --- Calculate Progress and Style for Buttons ---
                                let buttonStyle = { // Base style for enabled/base button
                                    flex: 1,
                                    margin: '0 0.5rem',
                                    padding: '0.4em 0.8em',
                                    fontSize: '0.85em',
                                    cursor: 'pointer', // Default cursor
                                    backgroundColor: '#444', // Default background
                                    // UPDATED: Set desired border color for enabled buttons
                                    border: '1px solid #1d1d1d', 
                                    color: '#eee',         // Default text color
                                    borderRadius: '4px',    // Consistent rounding
                                    textAlign: 'center',    // Ensure text is centered
                                };

                                if (cannotAfford) {
                                    let progress = 0;
                                    // Calculate progress only if the cost is > 0 and it's not the 'max buy 0' case
                                    if (currentBulkCost > 0 && !isMaxAffordableZero) {
                                        progress = Math.min(100, (coins / currentBulkCost) * 100);
                                    }

                                    // Style for disabled button with progress gradient
                                    buttonStyle = {
                                        ...buttonStyle, // Inherit base styles
                                        cursor: 'not-allowed', // Set cursor for disabled
                                        background: `linear-gradient(to right, #5a5a5a ${progress}%, #333 ${progress}%)`, // Darker bg for unfilled part
                                        color: '#aaa', // Dimmed text color for disabled
                                        // UPDATED: Set desired border color for disabled buttons
                                        border: '1px solid #1d1d1d', 
                                    };
                                }

                                return (
                                    <div key={upgrade.id} className="upgrade-item">
                                        <div style={{ display: "flex", alignItems: "center", padding: '5px 0' }}>
                                            {/* Upgrade Name & Level */}
                                            <div style={{ width: "100px", textAlign: "left", fontSize: '0.9em' }}>
                                                {upgrade.name} ({upgrade.level})
                                            </div>
                                            {/* Buy Button - Apply dynamic style */}
                                            <button
                                                onClick={() => buyUpgrade(upgrade.id)}
                                                disabled={cannotAfford}
                                                style={buttonStyle} // Apply the calculated style object
                                                title={buyMultiplier === 'max' ? `Buy Max (${quantityToBuy})` : `Buy ${quantityToBuy}`}
                                            >
                                                Buy {buyMultiplier === 'max' ? `Max (${quantityToBuy})` : `x${quantityToBuy}`}: ${formatNumber(currentBulkCost)}
                    </button>
                                            {/* Effect Display */}
                                            <div style={{ width: "100px", textAlign: "right", fontSize: '0.9em' }}>
                                                {effectDisplay}
                                            </div>
                </div>
            </div>
                                );
                            })}
                    </div> {/* --- END: Upgrades List Container --- */}
                    
                    {/* Prestige Button */}
                    <button 
                        onClick={prestigeGame} 
                        disabled={coins < PRESTIGE_REQUIREMENT || calculatePrestigeGain(coins) <= 0}
                        style={{ 
                            marginTop: "20px",
                            marginRight: "10px",
                            backgroundColor: "#6a0dad", 
                            opacity: (coins < PRESTIGE_REQUIREMENT || calculatePrestigeGain(coins) <= 0) ? 0.6 : 1,
                            width: 'auto' // Let button size naturally
                        }}
                    >
                        Prestige (Req: ${formatNumber(PRESTIGE_REQUIREMENT)})
                    </button>

                    {/* Reset Button */}
                    <button 
                        onClick={resetGame} 
                        style={{ 
                            marginTop: "10px", 
                            marginLeft: "10px",
                            backgroundColor: "#ff4d4d",
                            width: 'auto' // Let button size naturally
                        }}
                    >
                        Hard Reset Game
                    </button>
                </div> {/* --- END: Middle Column --- */}

                {/* --- Right Column: Charts --- */}
                <div style={{ 
                    flex: 2, 
                    minWidth: '320px', // Optional: Slightly increase minWidth
                    display: 'flex',        
                    flexDirection: 'column' 
                }}> 
                    <EarningsChart history={coinHistory} />
                    <UpgradeDistributionChart upgrades={upgrades} />
                </div>

            </div> {/* End of main flex container */}
        </>
    );
}

export default App;
