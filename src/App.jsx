import React, { useState, useEffect, useRef } from 'react';

const App = () => {
  const [activeSymbols, setActiveSymbols] = useState(['R_10', 'R_25', 'R_50', 'R_75', 'R_100']);
  const [tickData, setTickData] = useState({});
  const [clusterThreshold, setClusterThreshold] = useState(3);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({ 3: 0, 4: 0, 5: 0, 6: 0 });
  const ws = useRef(null);
  const digitHistory = useRef({});
  const clusterTracker = useRef({});

  // Initialize WebSocket and subscribe to ticks
  useEffect(() => {
    ws.current = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');

    ws.current.onopen = () => {
      activeSymbols.forEach(symbol => {
        ws.current.send(JSON.stringify({
          ticks: symbol,
          subscribe: 1
        }));
        
        // Initialize data structures
        digitHistory.current[symbol] = [];
        clusterTracker.current[symbol] = {};
      });
    };

    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.msg_type === 'tick') {
        processTick(data.tick);
      }
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  // Process each incoming tick
  const processTick = (tick) => {
    const symbol = tick.symbol;
    const digit = tick.quote % 10; // Get last digit
    
    // Update digit history (keep last 30 ticks)
    const updatedHistory = [...(digitHistory.current[symbol] || []), digit];
    if (updatedHistory.length > 30) updatedHistory.shift();
    digitHistory.current[symbol] = updatedHistory;
    
    // Detect clusters
    detectClusters(symbol, updatedHistory);
    
    // Update UI
    setTickData(prev => ({
      ...prev,
      [symbol]: updatedHistory
    }));
  };

  // Cluster detection logic
  const detectClusters = (symbol, history) => {
    if (history.length < 2) return;
    
    const lastDigit = history[history.length - 1];
    const prevDigit = history[history.length - 2];
    
    // Check for repeated digit (cluster)
    if (lastDigit === prevDigit) {
      // Initialize tracker for this digit if needed
      if (!clusterTracker.current[symbol][lastDigit]) {
        clusterTracker.current[symbol][lastDigit] = {
          currentStreak: 2,
          clusters: []
        };
      } else {
        clusterTracker.current[symbol][lastDigit].currentStreak++;
      }
    } else {
      // Streak broken - finalize if it was a valid cluster
      if (clusterTracker.current[symbol]?.[prevDigit]?.currentStreak >= 2) {
        const digitTracker = clusterTracker.current[symbol][prevDigit];
        digitTracker.clusters.push(digitTracker.currentStreak);
        
        // Check if we've reached the threshold
        if (digitTracker.clusters.length >= clusterThreshold) {
          triggerAlert(symbol, prevDigit, digitTracker.clusters.length);
          
          // Update stats
          const newStats = { ...stats };
          newStats[clusterThreshold]++;
          setStats(newStats);
        }
        
        // Reset current streak
        digitTracker.currentStreak = 0;
      }
    }
  };

  // Alert logic with native TTS
  const triggerAlert = (symbol, digit, clusterCount) => {
    const volName = `Vol ${symbol.split('_')[1]}`;
    const alertMessage = `Sniper alert on ${volName}. Digit ${digit} formed ${clusterCount} clusters.`;
    
    // Add to alerts list
    setAlerts(prev => [...prev, {
      id: Date.now(),
      message: alertMessage,
      symbol,
      digit,
      timestamp: new Date().toLocaleTimeString()
    }]);
    
    // Native browser TTS (no dependencies)
    if ('speechSynthesis' in window) {
      const speech = new SpeechSynthesisUtterance(alertMessage);
      speech.rate = 1.2; // Faster speech
      window.speechSynthesis.speak(speech);
    }
  };

  // Get color for digit based on cluster status
  const getDigitColor = (symbol, digit, index) => {
    const history = digitHistory.current[symbol] || [];
    if (index === history.length - 1) return 'bg-yellow-200'; // Highlight latest
    
    // Check if part of a cluster
    if (index > 0 && history[index] === history[index - 1]) {
      return 'bg-blue-200';
    }
    if (index < history.length - 1 && history[index] === history[index + 1]) {
      return 'bg-blue-200';
    }
    
    return '';
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Deriv Sniper Bot</h1>
      
      <div className="mb-4">
        <label className="mr-2">Cluster Threshold:</label>
        <select 
          value={clusterThreshold}
          onChange={(e) => setClusterThreshold(Number(e.target.value))}
          className="border p-1"
        >
          {[3, 4, 5, 6].map(num => (
            <option key={num} value={num}>{num}</option>
          ))}
        </select>
      </div>
      
      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        {Object.entries(stats).map(([size, count]) => (
          <div key={size} className="border p-2 text-center">
            <div className="font-bold">Size {size}</div>
            <div>{count}</div>
          </div>
        ))}
      </div>
      
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="mb-6 border-t pt-4">
          <h2 className="text-xl font-semibold mb-2">Alerts</h2>
          <div className="space-y-2">
            {alerts.slice().reverse().map(alert => (
              <div key={alert.id} className="bg-red-100 p-2 rounded">
                <strong>{alert.timestamp}</strong> - {alert.message}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Digit Grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeSymbols.map(symbol => (
          <div key={symbol} className="border p-4 rounded">
            <h3 className="font-bold mb-2">Vol {symbol.split('_')[1]}</h3>
            <div className="grid grid-cols-10 gap-1">
              {(tickData[symbol] || []).map((digit, index) => (
                <div 
                  key={`${symbol}-${index}`}
                  className={`border text-center p-1 ${getDigitColor(symbol, digit, index)}`}
                >
                  {digit}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
