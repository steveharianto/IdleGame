import { useState, useEffect, useRef } from "react";

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
    // Initialize game state from localStorage or use defaults
    const [gameState, setGameState] = useState(() => {
        const savedGame = localStorage.getItem("idleGameSave");
        let initialState = {
            coins: 0,
            coinsPerSecond: 0, // Will be calculated based on upgrades and prestige
            lastUpdate: Date.now(),
            upgrades: [
                { id: 1, name: "Clicker", level: 0, baseCost: 10, effect: 1 }, // Effect for Clicker is per click
                { id: 2, name: "Farm", level: 0, baseCost: 100, effect: 5 }, // Effect for others is base CPS
                { id: 3, name: "Mine", level: 0, baseCost: 1100, effect: 50 },
                { id: 4, name: "Factory", level: 0, baseCost: 12000, effect: 500 }
            ],
            prestigePoints: 0 // Added prestige points
        };

        if (savedGame) {
            try {
                const loadedState = JSON.parse(savedGame);
                // Merge saved state with default structure to handle potential missing keys
                initialState = {
                    ...initialState,
                    ...loadedState,
                    // Ensure upgrades structure is preserved if loading older save
                    upgrades: loadedState.upgrades || initialState.upgrades,
                    // Ensure prestigePoints exist
                    prestigePoints: loadedState.prestigePoints || 0
                };
            } catch (error) {
                console.error("Error loading saved game:", error);
                localStorage.removeItem("idleGameSave"); // Clear corrupted save
            }
        }
        
        // Calculate initial CPS based on loaded state
        initialState.coinsPerSecond = calculateTotalCPS(initialState.upgrades, initialState.prestigePoints);

        return initialState;
    });

    const { coins, coinsPerSecond, upgrades, prestigePoints } = gameState;

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
                return {
                    ...prev,
                    coins: Number((prev.coins + increment).toFixed(10)),
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
                    
                    return {
                        ...prev,
                        coins: parseFloat((prev.coins + (isNaN(earnings) ? 0 : earnings)).toFixed(10)),
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

    // Save game state to localStorage
    useEffect(() => {
        const saveInterval = setInterval(() => {
            localStorage.setItem("idleGameSave", JSON.stringify(gameState));
        }, 10000);
        
        return () => clearInterval(saveInterval);
    }, [gameState]);

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
        
        // Update coins
        setGameState(prev => ({
            ...prev,
            coins: prev.coins + clickValue
        }));
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
            coinsPerSecond: 0, // Will be recalculated below
            lastUpdate: Date.now(),
            upgrades: [
                { id: 1, name: "Clicker", level: 0, baseCost: 10, effect: 1 },
                { id: 2, name: "Farm", level: 0, baseCost: 100, effect: 5 },
                { id: 3, name: "Mine", level: 0, baseCost: 1100, effect: 50 },
                { id: 4, name: "Factory", level: 0, baseCost: 12000, effect: 500 }
            ],
            prestigePoints: 0 
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
                ...prev, // Keep lastUpdate potentially, or reset it? Let's reset for consistency.
                coins: 0,
                coinsPerSecond: newCPS,
                upgrades: initialUpgrades,
                prestigePoints: newTotalPrestigePoints,
                lastUpdate: Date.now() 
            };
        });
    };

    return (
        <>
            <h1 
                ref={coinRef}
                className="coinValue" 
                onClick={handleClick} 
                style={{ cursor: 'pointer', userSelect: 'none', position: 'relative' }}
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
            
            <p style={{ userSelect: 'none' }}>
                per second: ${formatNumber(coinsPerSecond)}
            </p>
            
            {/* Prestige Info Display */}
            <div style={{ margin: "10px 0", padding: "10px", border: "1px solid #555", borderRadius: "5px" }}>
                <p style={{ margin: 0 }}>Prestige Points: {prestigePoints}</p>
                <p style={{ margin: '5px 0 0 0' }}>
                    Current CPS Bonus: x{calculatePrestigeBonus(prestigePoints).toFixed(2)}
                </p>
                {coins >= PRESTIGE_REQUIREMENT / 10 && ( // Show potential gain earlier
                     <p style={{ margin: '5px 0 0 0', opacity: 0.8 }}>
                         Prestige Now Gain: +{calculatePrestigeGain(coins)} points
                     </p>
                )}
            </div>
            
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
                                opacity: Math.floor(coins) < getUpgradeCost(upgrade) ? 0.6 : 1 
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
                        backgroundColor: "#6a0dad", // Purple color for prestige
                        opacity: (coins < PRESTIGE_REQUIREMENT || calculatePrestigeGain(coins) <= 0) ? 0.6 : 1
                    }}
                >
                    Prestige (Req: ${formatNumber(PRESTIGE_REQUIREMENT)})
                </button>

                {/* Reset Button */}
                <button 
                    onClick={resetGame} 
                    style={{ marginTop: "10px", backgroundColor: "#ff4d4d" }} // Adjusted margin
                >
                    Hard Reset Game
                </button>
            </div>
        </>
    );
}

export default App;
