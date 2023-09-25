import { useState, useEffect } from "react";

import "./App.css";

function App() {
    const [coin, setCoin] = useState({
        value: 1,
        prefix: 0,
    });
    const [cps, setCps] = useState({
        value: 100,
        prefix: 0,
    });
    const [upgradeCost, setUpgradeCost] = useState({
        value: 1,
        prefix: 0,
    });

    let addCoin = () => {
        // If Prefix coin == cps
        if (coin.prefix == cps.prefix) {
            setCoin((prevCoin) => ({
                ...prevCoin,
                value: prevCoin.value + cps.value / 10,
            }));
            console.log("Add Coin : coin == cps");
        }
        // If Prefix coin > cps
        else if (coin.prefix > cps.prefix) {
            let tempCpsValue = cps.value / 10;
            let prefixDiff = coin.prefix - cps.prefix;
            while (prefixDiff > 0) {
                tempCpsValue /= 1000;
                prefixDiff--;
            }
            setCoin((prevCoin) => ({
                ...prevCoin,
                value: prevCoin.value + tempCpsValue,
            }));
            console.log("Add Coin : coin > cps");
        }
        // If Prefix coin < cps
        else {
            let tempCpsValue = cps.value / 10;
            let prefixDiff = cps.prefix - coin.prefix;
            setCoin((prevCoin) => ({
                ...prevCoin,
                prefix: prevCoin.prefix + prefixDiff,
                value: prevCoin.value + tempCpsValue,
            }));
            console.log("Add Coin : coin < cps");
        }
    };

    // Upgrades
    const upgrade = () => {
        // if (coin >= upgradeCost) {
        //     setCps(cps + 1);
        //     setCoin(coin - upgradeCost);
        //     setUpgradeCost(upgradeCost + 1);
        // }
        setCps((prevCps) => ({
            ...prevCps,
            prefix: prevCps.prefix + 1,
        }));
    };

    useEffect(() => {
        const intervalId = setInterval(addCoin, 100);

        return () => {
            clearInterval(intervalId);
        };
    }, [coin.prefix, cps]);

    // Change Prefix
    useEffect(() => {
        if (coin.value >= 1000) {
            setCoin((prevCoin) => ({
                ...prevCoin,
                prefix: prevCoin.prefix + 1,
                value: prevCoin.value / 1000,
            }));
        }
    }, [coin]);
    useEffect(() => {
        if (cps.value >= 1000) {
            setCoin((prevCps) => ({
                ...prevCps,
                prefix: prevCps.prefix + 1,
                value: prevCps.value / 1000,
            }));
        }
    }, [cps]);

    let prefixList = ["", "K", "M", "B", "T"];

    return (
        <>
            <h1 className="coinValue">
                ${coin.value.toFixed(3)} {coin.prefix < prefixList.length ? prefixList[coin.prefix] : `E${coin.prefix * 3}`}
            </h1>
            <p>
                cps : ${cps.value} {cps.prefix < prefixList.length ? prefixList[cps.prefix] : `E${cps.prefix * 3}`}
            </p>
            <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                    <p style={{ margin: "0 1em 1em 0", width: "5em" }}>+ 1</p>
                    <button onClick={upgrade} disabled={upgradeCost > coin}>
                        {upgradeCost.value} {cps.prefix < prefixList.length ? prefixList[cps.prefix] : `E${cps.prefix * 3}`}
                    </button>
                    {/* <p style={{ margin: "0 1em 1em 0", width: "5em" }}>Level : {upgradeCost}</p> */}
                </div>
            </div>
        </>
    );
}

export default App;
