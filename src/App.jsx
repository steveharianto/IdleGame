import { useState, useEffect } from "react";

import "./App.css";

function App() {
    // Initialize game state from localStorage or use defaults
    const [gameState, setGameState] = useState(() => {
        const savedGame = localStorage.getItem("idleGameSave");
        if (savedGame) {
            return JSON.parse(savedGame);
        }
        return {
            coins: 0,
            coinsPerSecond: 0.1,
            lastUpdate: Date.now(),
            upgrades: [
                { id: 1, name: "Clicker", level: 0, baseCost: 10, effect: 1 },
                { id: 2, name: "Farm", level: 0, baseCost: 100, effect: 5 },
                { id: 3, name: "Mine", level: 0, baseCost: 1100, effect: 50 },
                { id: 4, name: "Factory", level: 0, baseCost: 12000, effect: 500 }
            ]
        };
    });

    const { coins, coinsPerSecond, upgrades } = gameState;

    // Format large numbers with prefixes (K, M, B, etc.)
    const formatNumber = (num) => {
        // Check for NaN, undefined, or null
        if (isNaN(num) || num === undefined || num === null) return "0.00";
        
        const prefixes = ["", "K", "M", "B", "T", "Q"];
        let prefix = 0;
        let value = num;
        
        // Ensure value is a number
        value = Number(value);
        
        while (value >= 1000 && prefix < prefixes.length - 1) {
            value /= 1000;
            prefix++;
        }
        
        return `${value.toFixed(2)} ${prefixes[prefix]}`;
    };

    // Game loop - update coins based on time passed
    useEffect(() => {
        // Set a fixed starting time to ensure consistent tracking
        const gameStartTime = Date.now();
        let lastUpdateTime = gameStartTime;
        
        const updateGame = () => {
            const now = Date.now();
            const elapsed = (now - lastUpdateTime) / 1000; // seconds since last update
            lastUpdateTime = now;
            
            // Use toFixed(10) to avoid floating point errors
            setGameState(prev => {
                const increment = parseFloat((prev.coinsPerSecond * elapsed).toFixed(10));
                return {
                    ...prev,
                    coins: parseFloat((prev.coins + increment).toFixed(10)),
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

    // Purchase an upgrade
    const buyUpgrade = (id) => {
        setGameState(prev => {
            const newState = {...prev};
            const upgrade = newState.upgrades.find(u => u.id === id);
            
            const cost = getUpgradeCost(upgrade);
            
            // Double-check affordability
            if (prev.coins < cost) {
                console.log("Can't afford: have", prev.coins, "need", cost);
                return prev; // Can't afford
            }
            
            // Update coins and CPS
            upgrade.level += 1;
            
            // Add effect to CPS (but handle clicker differently)
            let cpsBonus = upgrade.effect;
            if (id === 1) {
                // Clicker doesn't add as much to automatic CPS
                cpsBonus = upgrade.effect / 10;
            }
            
            // Make sure to properly deduct the cost
            const newCoins = Math.max(0, prev.coins - cost);
            
            return {
                ...newState,
                coins: newCoins,
                coinsPerSecond: prev.coinsPerSecond + cpsBonus
            };
        });
    };

    // Handle manual clicks
    const handleClick = () => {
        const clickerLevel = upgrades.find(u => u.id === 1).level;
        const clickValue = 1 + clickerLevel; // Each clicker level adds +1 to click value
        
        setGameState(prev => ({
            ...prev,
            coins: prev.coins + clickValue
        }));
    };

    // Reset game
    const resetGame = () => {
        localStorage.removeItem("idleGameSave");
        setGameState({
            coins: 0,
            coinsPerSecond: 0.1,
            lastUpdate: Date.now(),
            upgrades: [
                { id: 1, name: "Clicker", level: 0, baseCost: 10, effect: 1 },
                { id: 2, name: "Farm", level: 0, baseCost: 100, effect: 5 },
                { id: 3, name: "Mine", level: 0, baseCost: 1100, effect: 50 },
                { id: 4, name: "Factory", level: 0, baseCost: 12000, effect: 500 }
            ]
        });
    };

    return (
        <>
            <h1 
                className="coinValue" 
                onClick={handleClick} 
                style={{ cursor: 'pointer', userSelect: 'none' }}
            >
                ${formatNumber(coins)}
            </h1>
            
            <p style={{ userSelect: 'none' }}>
                per second: ${formatNumber(coinsPerSecond)}
            </p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {upgrades.map(upgrade => (
                    <div key={upgrade.id} style={{ display: "flex", alignItems: "center" }}>
                        <div style={{ width: "100px", textAlign: "left" }}>
                            {upgrade.name} ({upgrade.level})
                        </div>
                        <button 
                            onClick={() => buyUpgrade(upgrade.id)} 
                            disabled={Math.floor(coins) < getUpgradeCost(upgrade)}
                            style={{ flex: 1 }}
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
                
                <button 
                    onClick={resetGame} 
                    style={{ marginTop: "20px", backgroundColor: "#ff4d4d" }}
                >
                    Reset Game
                </button>
            </div>
        </>
    );
}

export default App;
