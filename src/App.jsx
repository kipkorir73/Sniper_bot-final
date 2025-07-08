// File: src/App.jsx
import React, { useEffect, useState } from "react";

const VOLS = [
  "R_10", "R_25", "R_50", "R_75", "R_100", 
  "R_10_HZ", "R_25_HZ", "R_50_HZ", "R_75_HZ", "R_100_HZ"
];

export default function App() {
  const [tickData, setTickData] = useState({});
  const [clusterData, setClusterData] = useState({});
  const [alertState, setAlertState] = useState({});
  const [digitColors, setDigitColors] = useState({});
  const [clusterThreshold, setClusterThreshold] = useState(4);
  const [clusterStats, setClusterStats] = useState({});

  useEffect(() => {
    const sockets = {};
    const initTicks = {};
    VOLS.forEach((market) => {
      initTicks[market] = [];
      const socket = new WebSocket("wss://ws.derivws.com/websockets/v3?app_id=1089");
      sockets[market] = socket;
      socket.onopen = () => socket.send(JSON.stringify({ ticks: market }));
      socket.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.msg_type === "tick") {
          const quoteStr = msg.tick.quote.toString();
          const lastChar = quoteStr[quoteStr.length - 1];
          const digit = parseInt(lastChar, 10);
          if (!isNaN(digit)) {
            setTickData((prev) => {
              const arr = prev[market] || [];
              const updated = [digit, ...arr].slice(0, 30);
              detectClusters(market, updated);
              return { ...prev, [market]: updated };
            });
          }
        }
      };
    });
    setTickData(initTicks);
    return () => Object.values(sockets).forEach((s) => s.close());
  }, [clusterThreshold]);

  const speak = (text) => {
    const u = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  const detectClusters = (market, digits) => {
    let streak = 1;
    const clusters = [];
    for (let i = 1; i < digits.length; i++) {
      if (digits[i] === digits[i - 1]) streak++;
      else {
        if (streak >= 2) clusters.push({ digit: digits[i - 1], length: streak, end: i - 1 });
        streak = 1;
      }
    }
    if (streak >= 2) clusters.push({ digit: digits[digits.length - 1], length: streak, end: digits.length - 1 });

    setClusterData((prev) => ({ ...prev, [market]: clusters }));

    const counted = {};
    clusters.forEach((c) => {
      counted[c.digit] = (counted[c.digit] || 0) + 1;
    });

    const stats = { ...clusterStats };
    Object.entries(counted).forEach(([d, cnt]) => {
      stats[cnt] = (stats[cnt] || 0) + 1;
    });
    setClusterStats(stats);

    const sniper = Object.entries(counted).find(([d, cnt]) => cnt >= clusterThreshold);
    if (sniper) {
      const [dig, cnt] = sniper;
      const key = market + dig;
      if (!alertState[key]) {
        speak(`Sniper alert on ${market.replace("R_", "Vol ").replace("_HZ", "HZ")}. Digit ${dig} formed ${clusterThreshold} clusters.`);
        setAlertState((prev) => ({ ...prev, [key]: true }));
        const colors = ["bg-yellow-500", "bg-green-500", "bg-red-500", "bg-blue-500", "bg-purple-500", "bg-pink-500"];
        setDigitColors((prev) => ({
          ...prev,
          [market]: { ...(prev[market] || {}), [dig]: colors[(cnt - 1) % colors.length] + " text-white" }
        }));
      }
    }
  };

  const getClass = (market, idx) => {
    const clusters = clusterData[market] || [];
    const digits = tickData[market] || [];
    const d = digits[idx];
    const colorMap = digitColors[market] || {};
    for (const c of clusters) {
      const start = c.end - c.length + 1;
      if (idx >= start && idx <= c.end && c.digit === d) return colorMap[d] || "bg-gray-700 text-white";
    }
    return "bg-gray-900 text-green-400";
  };

  return (
    <div className="min-h-screen bg-black p-4 font-mono">
      <h1 className="text-xl text-green-400 mb-4">🎯 Sniper Bot Cluster Tracker</h1>
      <div className="mb-6 text-green-200">
        <label>Cluster Threshold: </label>
        <select value={clusterThreshold} onChange={(e) => setClusterThreshold(+e.target.value)} className="bg-gray-800 p-1">
          {[3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="mb-6 text-green-300">
        <div>Stats:</div>
        {[3, 4, 5, 6].map(n => <div key={n}>Clusters {n}: {clusterStats[n] || 0}</div>)}
      </div>
      {VOLS.map(m => (
        <div key={m} className="mb-6">
          <h2 className="text-green-400 mb-2">{m.replace("R_", "Vol ").replace("_HZ", " HZ")}</h2>
          <div className="grid grid-cols-10 gap-1">
            {(tickData[m] || []).map((d, i) => (
              <div key={i} className={`${getClass(m, i)} p-2 rounded border border-gray-600`}>{d}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
