import { useState, useEffect, useRef } from "react";
import EarningsChart from './EarningsChart'; // Import the chart component
import UpgradeDistributionChart from './UpgradeDistributionChart'; // Import the new chart
import GameStats from './GameStats'; // Import the stats component

import "./App.css";

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
            const offlineTime = (now - gameState.lastUpdate) / 1000;
            
            if (offlineTime > 5) {
                setGameState(prev => {
                    const earnings = parseFloat((prev.coinsPerSecond * offlineTime).toFixed(10));
                    
                    if (!isNaN(earnings) && earnings > 0) {
                        alert(`Welcome back! You earned $${formatNumber(earnings)} while away.`);
                    }
                    
                    const newCoins = parseFloat((prev.coins + (isNaN(earnings) ? 0 : earnings)).toFixed(10));
                    return {
                        ...prev,
                        coins: newCoins,
                        // Update total earnings (approximate - more accurate if calculated differently)
                        totalEarnings: prev.totalEarnings + (isNaN(earnings) ? 0 : earnings), 
                        // Update highest coins if needed
                        highestCoins: Math.max(prev.highestCoins, newCoins), 
                        lastUpdate: now
                    };
                });
            } else {
                // Just update the lastUpdate time if no significant offline time
                setGameState(prev => ({
                    ...prev,
                    lastUpdate: now
                }));
            }
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

    // Purchase an upgrade with consistent number handling
    const buyUpgrade = (id) => {
        if (isPurchasing) return; 
        setIsPurchasing(true);
        
        setGameState(prev => {
            const currentCoins = Number(prev.coins.toFixed(10));
            const upgradeIndex = prev.upgrades.findIndex(u => u.id === id);
            if (upgradeIndex === -1) return prev; // Should not happen

            const upgradeToBuy = prev.upgrades[upgradeIndex];
            const cost = getUpgradeCost(upgradeToBuy);

            if (Math.floor(currentCoins) < cost) {
                console.log(`Purchase failed: Have ${currentCoins}, need ${cost}`);
                setIsPurchasing(false); // Reset purchase lock if failed
                return prev;
            }

            // Create a new upgrades array with the updated level
            const newUpgrades = prev.upgrades.map((u, index) => 
                index === upgradeIndex ? {...u, level: u.level + 1} : u
            );

            const newCoins = Number((currentCoins - cost).toFixed(10));
            // Recalculate total CPS based on new upgrade levels and existing prestige
            const newCPS = calculateTotalCPS(newUpgrades, prev.prestigePoints); 

            console.log(`Purchase successful: ${upgradeToBuy.name} for ${cost}. New balance: ${newCoins}`);

            return {
                ...prev,
                coins: newCoins,
                coinsPerSecond: newCPS,
                upgrades: newUpgrades
            };
        });

        setTimeout(() => setIsPurchasing(false), 50); // Reduced delay slightly
    };

    // Enhanced click handler with animations
    const handleClick = (event) => {
        // Get click position relative to the element
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Calculate click value
        const clickerLevel = upgrades.find(u => u.id === 1).level;
        const clickValue = 1 + clickerLevel;
        
        // Add floating text effect
        const newEffect = {
            id: Date.now(),
            x,
            y,
            value: clickValue
        };
        
        setClickEffects(prev => [...prev, newEffect]);
        
        // Remove effect after animation completes
        setTimeout(() => {
            setClickEffects(prev => prev.filter(effect => effect.id !== newEffect.id));
        }, 1000);
        
        // Add pulse animation to the coin amount
        if (coinRef.current) {
            coinRef.current.classList.remove('pulse-animation');
            // Force a reflow to restart the animation
            void coinRef.current.offsetWidth;
            coinRef.current.classList.add('pulse-animation');
        }
        
        // Update coins AND stats
        setGameState(prev => {
            const newManualEarnings = prev.manualEarnings + clickValue;
            const newCoins = prev.coins + clickValue; // Direct addition for click is fine
            return {
                ...prev,
                coins: newCoins,
                totalClicks: prev.totalClicks + 1,
                manualEarnings: newManualEarnings,
                // Also update total earnings from clicks
                totalEarnings: prev.totalEarnings + clickValue,
                // Update highest coins if click makes it the highest
                highestCoins: Math.max(prev.highestCoins, newCoins) 
            };
        });
    };

    // Reset game
    const resetGame = () => {
        if (!confirm("Are you sure you want to HARD reset? This will erase ALL progress, including Prestige Points!")) {
            return;
        }
        localStorage.removeItem("idleGameSave");
        
        const initialStateReset = {
            coins: 0, coinsPerSecond: 0, lastUpdate: Date.now(),
            // Reset using the full list
            upgrades: ALL_UPGRADES.map(u => ({ ...u, level: 0 })), 
            prestigePoints: 0, coinHistory: [{ timestamp: Date.now(), coins: 0 }],
            totalClicks: 0, manualEarnings: 0, totalEarnings: 0, 
            startTime: Date.now(), prestigeCount: 0, highestCoins: 0
        };
        initialStateReset.coinsPerSecond = calculateTotalCPS(initialStateReset.upgrades, initialStateReset.prestigePoints); 
        setGameState(initialStateReset);
    };

    // --- Prestige Function ---
    const prestigeGame = () => {
        const gain = calculatePrestigeGain(coins);
        
        if (coins < PRESTIGE_REQUIREMENT || gain <= 0) {
            alert(`You need at least $${formatNumber(PRESTIGE_REQUIREMENT)} to prestige for points.`);
            return;
        }
    
        if (!confirm(`Are you sure you want to prestige? You will gain ${gain} Prestige Points, boosting future CPS, but reset your current coins and upgrades.`)) {
            return;
        }
    
        setGameState(prev => {
            const newTotalPrestigePoints = prev.prestigePoints + gain;
            // Reset upgrades using the full list
            const initialUpgrades = ALL_UPGRADES.map(u => ({ ...u, level: 0 }));
            // Calculate the new CPS with reset upgrades but new prestige bonus
            const newCPS = calculateTotalCPS(initialUpgrades, newTotalPrestigePoints);
    
            console.log(`Prestiged! Gained ${gain} points. Total: ${newTotalPrestigePoints}`);
    
            return {
                ...prev, // Keep previous state as base
                coins: 0, // Reset current coins
                coinsPerSecond: newCPS, // Set new CPS based on prestige
                upgrades: initialUpgrades, // Set reset upgrades
                prestigePoints: newTotalPrestigePoints, // Update prestige points
                lastUpdate: Date.now(), // Update timestamp
                prestigeCount: prev.prestigeCount + 1, // Increment prestige count
                // --- Persisted Stats ---
                // totalEarnings continues from its current value (not reset)
                totalEarnings: prev.totalEarnings, 
                // coinHistory is NOT reset, so the chart continues
                coinHistory: prev.coinHistory, 
                // Keep other persistent stats
                 totalClicks: prev.totalClicks, 
                 manualEarnings: prev.manualEarnings, 
                 startTime: prev.startTime, 
                 highestCoins: prev.highestCoins, 
            };
        });
    };

    return (
        // Main container - Increase the gap
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

                {/* Prestige Info Display */}
                <div style={{ margin: "0 0 1rem 0", padding: "10px", border: "1px solid #555", borderRadius: "5px", textAlign: 'left' }}> {/* Adjusted margin and alignment */}
                    <p style={{ margin: 0, fontWeight: 'bold' }}>Prestige</p>
                    <p style={{ margin: '5px 0 0 0' }}>Points: {prestigePoints}</p>
                    <p style={{ margin: '5px 0 0 0' }}>
                        CPS Bonus: x{calculatePrestigeBonus(prestigePoints).toFixed(2)}
                    </p>
                    {coins >= PRESTIGE_REQUIREMENT / 10 && ( 
                         <p style={{ margin: '5px 0 0 0', opacity: 0.8 }}>
                             Gain on Prestige: +{calculatePrestigeGain(coins)} points
                         </p>
                    )}
                </div>

                {/* Upgrades List and Buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}> {/* Reduced gap slightly */}
                     {/* Filter upgrades based on totalEarnings before mapping */}
                     {upgrades
                        .filter(upgrade => totalEarnings >= upgrade.baseCost || upgrade.level > 0) // Show if affordable OR already bought
                        .map(upgrade => (
                         // Add a wrapper div for animation
                         <div key={upgrade.id} className="upgrade-item"> 
                            <div style={{ display: "flex", alignItems: "center", padding: '5px 0' }}> {/* Inner flex container */}
                                <div style={{ width: "100px", textAlign: "left", fontSize: '0.9em' }}> {/* Slightly smaller font */}
                                    {upgrade.name} ({upgrade.level})
                                </div>
                                <button 
                                    onClick={() => buyUpgrade(upgrade.id)} 
                                    disabled={Math.floor(coins) < getUpgradeCost(upgrade)}
                                    style={{ 
                                        flex: 1,
                                        opacity: Math.floor(coins) < getUpgradeCost(upgrade) ? 0.6 : 1,
                                        margin: '0 0.5rem',
                                        padding: '0.4em 0.8em', // Slightly smaller padding
                                        fontSize: '0.85em' // Slightly smaller font
                                    }}
                                >
                                    Buy: ${formatNumber(getUpgradeCost(upgrade))}
                                </button>
                                <div style={{ width: "100px", textAlign: "right", fontSize: '0.9em' }}> {/* Slightly smaller font */}
                                    {upgrade.id === 1 ? 
                                        `+${upgrade.effect}/click` : 
                                        `+${formatNumber(upgrade.effect)}/s`}
                                </div>
                            </div>
                         </div> // End animation wrapper
                     ))}
                    
                    {/* Prestige Button */}
                    <button 
                        onClick={prestigeGame} 
                        disabled={coins < PRESTIGE_REQUIREMENT || calculatePrestigeGain(coins) <= 0}
                        style={{ 
                            marginTop: "20px", 
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
                            backgroundColor: "#ff4d4d",
                            width: 'auto' // Let button size naturally
                        }}
                    >
                        Hard Reset Game
                    </button>
                </div>
            </div>

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

        </div> // End of main flex container
    );
}

export default App;
