// File: src/App.jsx
import React, { useEffect, useState } from "react";

const VOLS = ["R_10", "R_25", "R_50", "R_75", "R_100"];

const App = () => {
  const [tickData, setTickData] = useState({});
  const [clusterData, setClusterData] = useState({});
  const [alertState, setAlertState] = useState({});
  const [digitColors, setDigitColors] = useState({});
  const [clusterThreshold, setClusterThreshold] = useState(4);
  const [clusterStats, setClusterStats] = useState({});

  useEffect(() => {
    const sockets = {};
    const initialTicks = {};
    const initialClusters = {};
    const initialAlerts = {};

    VOLS.forEach((market) => {
      initialTicks[market] = [];
      initialClusters[market] = [];
      initialAlerts[market] = false;

      const socket = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089");
      sockets[market] = socket;

      socket.onopen = () => {
        socket.send(JSON.stringify({ ticks: market }));
      };

      socket.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.msg_type === "tick") {
          const quote = data.tick.quote.toString();
          const digit = Number(quote[quote.length - 1]);

          if (!isNaN(digit)) {
            setTickData((prev) => {
              const updated = {
                ...prev,
                [market]: [digit, ...(prev[market] || []).slice(0, 29)],
              };
              detectClusters(market, updated[market]);
              return updated;
            });
          }
        }
      };
    });

    setTickData(initialTicks);
    setClusterData(initialClusters);
    setAlertState(initialAlerts);

    return () => {
      Object.values(sockets).forEach((s) => s.close());
    };
  }, [clusterThreshold]);

  const speak = (text) => {
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    synth.cancel();
    synth.speak(utterance);
  };

  const detectClusters = (market, digits) => {
    const clusters = [];
    let streak = 1;

    for (let i = 1; i < digits.length; i++) {
      if (digits[i] === digits[i - 1]) {
        streak++;
      } else {
        if (streak >= 2) {
          clusters.push({
            digit: digits[i - 1],
            length: streak,
            endIndex: i - 1,
          });
        }
        streak = 1;
      }
    }

    if (streak >= 2) {
      clusters.push({
        digit: digits[digits.length - 1],
        length: streak,
        endIndex: digits.length - 1,
      });
    }

    const counted = {};
    clusters.forEach((c) => {
      counted[c.digit] = (counted[c.digit] || 0) + 1;
    });

    const sniperDigit = Object.keys(counted).find((d) => counted[d] >= clusterThreshold);
    setClusterData((prev) => ({ ...prev, [market]: clusters }));

    // Update cluster stats
    let statsUpdate = { ...clusterStats };
    Object.keys(counted).forEach((digit) => {
      const count = counted[digit];
      if (count === 3) statsUpdate["3"] = (statsUpdate["3"] || 0) + 1;
      if (count === 4) statsUpdate["4"] = (statsUpdate["4"] || 0) + 1;
      if (count === 5) statsUpdate["5"] = (statsUpdate["5"] || 0) + 1;
    });
    setClusterStats(statsUpdate);

    if (sniperDigit && !alertState[market + sniperDigit]) {
      speak(`Sniper alert on ${market.replace("R_", "Vol ")}. Digit ${sniperDigit} formed ${clusterThreshold} clusters.`);
      setAlertState((prev) => ({ ...prev, [market + sniperDigit]: true }));

      const colorList = [
        "bg-yellow-500 text-black",
        "bg-green-500 text-black",
        "bg-red-500 text-white",
        "bg-blue-500 text-white",
        "bg-purple-500 text-white",
        "bg-pink-500 text-white",
      ];
      const digitClusterCount = counted[sniperDigit];
      const assignedColor = colorList[(digitClusterCount - 1) % colorList.length];
      setDigitColors((prev) => ({
        ...prev,
        [market]: { ...(prev[market] || {}), [sniperDigit]: assignedColor },
      }));
    }
  };

  const getClusterClass = (market, i) => {
    const clusters = clusterData[market] || [];
    const digits = tickData[market] || [];
    const currentDigit = digits[i];
    const colorMap = digitColors[market] || {};

    for (let cluster of clusters) {
      const start = cluster.endIndex - cluster.length + 1;
      if (i >= start && i <= cluster.endIndex && cluster.digit === currentDigit) {
        return colorMap[cluster.digit] || "bg-gray-800 text-white";
      }
    }

    return "bg-gray-900 text-green-400";
  };

  return (
    <div className="min-h-screen bg-black text-green-400 p-4 font-mono">
      <h1 className="text-xl mb-4">🎯 Sniper Bot – Digit Cluster Tracker</h1>

      <div className="mb-6">
        <label htmlFor="threshold" className="mr-2">Cluster Threshold:</label>
        <select
          id="threshold"
          value={clusterThreshold}
          onChange={(e) => setClusterThreshold(Number(e.target.value))}
          className="bg-gray-800 border border-green-500 text-green-300 px-2 py-1"
        >
          {[3, 4, 5, 6].map((val) => (
            <option key={val} value={val}>{val}</option>
          ))}
        </select>
      </div>

      <div className="mb-6">
        <h2 className="text-lg mb-2">📊 Cluster Stats:</h2>
        <p>✅ 3 clusters that stopped: {clusterStats["3"] || 0}</p>
        <p>✅ 4 clusters that stopped: {clusterStats["4"] || 0}</p>
        <p>✅ 5 clusters that stopped: {clusterStats["5"] || 0}</p>
      </div>

      {VOLS.map((market) => (
        <div key={market} className="mb-8 border-t border-gray-700 pt-4">
          <h2 className="text-lg mb-2">📉 {market.replace("R_", "Vol ")}</h2>
          <div className="grid grid-cols-10 gap-2">
            {(tickData[market] || []).map((digit, i) => (
              <div
                key={i}
                className={`${getClusterClass(market, i)} p-2 text-center rounded border border-green-700`}
              >
                {digit}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default App;
