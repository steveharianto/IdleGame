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

function App() {
    const MAX_HISTORY_POINTS = 60; // Store last 60 data points (e.g., 10 minutes if saving every 10s)

    // Initialize game state from localStorage or use defaults
    const [gameState, setGameState] = useState(() => {
        const savedGame = localStorage.getItem("idleGameSave");
        let initialState = {
            coins: 0,
            coinsPerSecond: 0,
            lastUpdate: Date.now(),
            upgrades: [
                { id: 1, name: "Clicker", level: 0, baseCost: 10, effect: 1 }, // Effect for Clicker is per click
                { id: 2, name: "Farm", level: 0, baseCost: 100, effect: 5 }, // Effect for others is base CPS
                { id: 3, name: "Mine", level: 0, baseCost: 1100, effect: 50 },
                { id: 4, name: "Factory", level: 0, baseCost: 12000, effect: 500 }
            ],
            prestigePoints: 0,
            coinHistory: [],
            // --- Statistics State ---
            totalClicks: 0,
            manualEarnings: 0,
            totalEarnings: 0, // Includes manual + automatic
            startTime: Date.now(), // Track session/total time
            prestigeCount: 0,
            highestCoins: 0
        };

        if (savedGame) {
            try {
                const loadedState = JSON.parse(savedGame);
                // Merge ensuring all keys exist, prioritizing loaded data
                initialState = {
                    ...initialState, // Start with defaults
                    ...loadedState,  // Override with saved data
                    // Ensure complex types are correctly handled/defaulted
                    upgrades: loadedState.upgrades || initialState.upgrades,
                    coinHistory: (loadedState.coinHistory || [])
                        .map(p => ({ 
                            timestamp: p.timestamp, 
                            // Use totalEarnings if present, otherwise fall back to coins (for old saves)
                            totalEarnings: p.totalEarnings ?? p.coins ?? 0 
                        })) 
                        .slice(-MAX_HISTORY_POINTS),
                    // Make sure new stats have defaults if loading old save
                    totalClicks: loadedState.totalClicks || 0,
                    manualEarnings: loadedState.manualEarnings || 0,
                    totalEarnings: loadedState.totalEarnings || (loadedState.coins || 0), // Approximate if missing
                    startTime: loadedState.startTime || Date.now(),
                    prestigeCount: loadedState.prestigeCount || 0,
                    highestCoins: loadedState.highestCoins || (loadedState.coins || 0)
                };
            } catch (error) {
                console.error("Error loading saved game:", error);
                localStorage.removeItem("idleGameSave"); // Clear corrupted save
            }
        }
        
        initialState.coinsPerSecond = calculateTotalCPS(initialState.upgrades, initialState.prestigePoints);
        if (initialState.coinHistory.length === 0) {
            initialState.coinHistory.push({ 
                timestamp: initialState.lastUpdate, // Use lastUpdate for consistency
                totalEarnings: initialState.totalEarnings 
            });
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
        
        // Reset to the absolute initial state using the top-level helper
        const initialState = {
            coins: 0,
            coinsPerSecond: 0.1, 
            lastUpdate: Date.now(),
            upgrades: [
                { id: 1, name: "Clicker", level: 0, baseCost: 10, effect: 1 },
                { id: 2, name: "Farm", level: 0, baseCost: 100, effect: 5 },
                { id: 3, name: "Mine", level: 0, baseCost: 1100, effect: 50 },
                { id: 4, name: "Factory", level: 0, baseCost: 12000, effect: 500 }
            ],
            prestigePoints: 0,
            coinHistory: [{ timestamp: Date.now(), totalEarnings: 0 }], // Initialize history
            // --- Reset ALL stats ---
            totalClicks: 0,
            manualEarnings: 0,
            totalEarnings: 0,
            startTime: Date.now(), // Reset start time
            prestigeCount: 0,
            highestCoins: 0
        };
        // Ensure initial CPS is correctly set after reset using the globally defined function
        initialState.coinsPerSecond = calculateTotalCPS(initialState.upgrades, initialState.prestigePoints); 
        setGameState(initialState);
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
            
            // Reset upgrades to level 0
            const initialUpgrades = prev.upgrades.map(u => ({ ...u, level: 0 }));
            
            // Calculate the new CPS with reset upgrades but new prestige bonus
            const newCPS = calculateTotalCPS(initialUpgrades, newTotalPrestigePoints);

            console.log(`Prestiged! Gained ${gain} points. Total: ${newTotalPrestigePoints}`);

            return {
                ...prev, 
                coins: 0,
                coinsPerSecond: newCPS,
                upgrades: initialUpgrades,
                prestigePoints: newTotalPrestigePoints,
                lastUpdate: Date.now(),
                // --- Reset relevant stats on prestige ---
                totalClicks: prev.totalClicks, // Keep total clicks? Or reset per prestige? Let's keep.
                manualEarnings: prev.manualEarnings, // Keep total manual earnings? Let's keep.
                // totalEarnings is implicitly reset by coins resetting
                // startTime can be kept to track total playtime across prestiges
                prestigeCount: prev.prestigeCount + 1, // Increment prestige count!
                // highestCoins can be kept, or reset per prestige - let's keep overall highest
                highestCoins: prev.highestCoins,
                // Reset coin history
                coinHistory: [{ timestamp: Date.now(), totalEarnings: 0 }] 
            };
        });
    };

    return (
        // Main container - NOW THREE COLUMNS
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>

            {/* --- Left Column: Statistics --- */}
            <div style={{ flex: 2, minWidth: '220px' }}> 
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
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {upgrades.map(upgrade => (
                         <div key={upgrade.id} style={{ display: "flex", alignItems: "center" }}>
                            <div style={{ width: "100px", textAlign: "left" }}>
                                {upgrade.name} ({upgrade.level})
                            </div>
                            <button 
                                onClick={() => buyUpgrade(upgrade.id)} 
                                disabled={Math.floor(coins) < getUpgradeCost(upgrade)}
                                style={{ 
                                    flex: 1,
                                    opacity: Math.floor(coins) < getUpgradeCost(upgrade) ? 0.6 : 1,
                                    margin: '0 0.5rem' // Remove default bottom margin, add side margin
                                }}
                            >
                                Buy: ${formatNumber(getUpgradeCost(upgrade))}
                            </button>
                            <div style={{ width: "100px", textAlign: "right" }}>
                                {upgrade.id === 1 ? 
                                    `+${upgrade.effect}/click` : 
                                    `+${formatNumber(upgrade.effect)}/s`}
                            </div>
                        </div>
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
                minWidth: '300px', 
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
