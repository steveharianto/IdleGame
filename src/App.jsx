import { useState, useEffect } from "react";

import "./App.css";

function App() {
    const [coin, setCoin] = useState(1);
    const [cps, setCps] = useState(1);

    const [upgradeCost, setUpgradeCost] = useState(1);
    const [cost1, setCost1] = useState(100);
    const [cost2, setCost2] = useState(1000);
    const [cost3, setCost3] = useState(10000);

    let addCoin = () => {
        setCoin((prevCoin) => prevCoin + cps / 10);
    };

    // Upgrades
    const upgrade = () => {
        if (coin >= upgradeCost) {
            setCps(cps + 1);
            setCoin(coin - upgradeCost);
            setUpgradeCost(upgradeCost + 1);
        }
    };
    const upgrade1 = () => {
        if (coin >= cost1) {
            setCps(cps + 10);
            setCoin(coin - cost1);
            setCost1(cost1 + 100);
        }
    };
    const upgrade2 = () => {
        if (coin >= cost2) {
            setCps(cps + 100);
            setCoin(coin - cost2);
            setCost2(cost2 + 1000);
        }
    };
    const upgrade3 = () => {
        if (coin >= cost3) {
            setCps(cps + 1000);
            setCoin(coin - cost3);
            setCost3(cost3 + 10000);
        }
    };

    useEffect(() => {
        const intervalId = setInterval(addCoin, 100);

        return () => {
            clearInterval(intervalId);
        };
    }, [cps]);

    return (
        <>
            <h1 className="coinValue">{Math.round(coin).toLocaleString("en-US", { style: "currency", currency: "USD" })}</h1>
            <p>cps : {cps.toLocaleString("en-US", { style: "currency", currency: "USD" })}</p>
            <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                    <p style={{ margin: "0 1em 1em 0", width: "5em" }}>+ 1</p>
                    <button onClick={upgrade} disabled={upgradeCost > coin}>
                        {upgradeCost.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                    </button>
                    {/* <p style={{ margin: "0 1em 1em 0", width: "5em" }}>Level : {upgradeCost}</p> */}
                </div>

                <div style={{ display: "flex", alignItems: "center" }}>
                    <p style={{ margin: "0 1em 1em 0", width: "5em" }}>+ 10</p>
                    <button onClick={upgrade1} disabled={cost1 > coin}>
                        {cost1.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                    </button>
                    {/* <p style={{ margin: "0 1em 1em 0", width: "5em" }}>Level : {cost1 / 100}</p> */}
                </div>

                <div style={{ display: "flex", alignItems: "center" }}>
                    <p style={{ margin: "0 1em 1em 0", width: "5em" }}>+ 100</p>
                    <button onClick={upgrade2} disabled={cost2 > coin}>
                        {cost2.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                    </button>
                </div>
                <div style={{ display: "flex", alignItems: "center" }}>
                    <p style={{ margin: "0 1em 1em 0", width: "5em" }}>+ 1000</p>
                    <button onClick={upgrade3} disabled={cost3 > coin}>
                        {cost3.toLocaleString("en-US", { style: "currency", currency: "USD" })}
                    </button>
                </div>
            </div>
        </>
    );
}

export default App;
