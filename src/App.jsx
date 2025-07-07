
import { useEffect, useState } from 'react';
import usePatternTracker from './hooks/usePatternTracker';

function App() {
  const [ticks, setTicks] = useState([]);
  const [volatility, setVolatility] = useState('Volatility 100');

  // Simulate WebSocket tick stream (you will replace with real Deriv API logic)
  useEffect(() => {
    const interval = setInterval(() => {
      const price = 100 + Math.random(); // Simulate random price
      const time = Date.now();
      const newTick = { price, time, volatility };
      setTicks(prev => [...prev.slice(-9999), newTick]);
    }, 1000);
    return () => clearInterval(interval);
  }, [volatility]);

  const { sniperAlerts, tickHistory, patternClusters } = usePatternTracker(ticks, volatility);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 font-mono">
      <h1 className="text-2xl mb-4 font-bold">🧠 Digit Differ Sniper Tool</h1>

      <div className="mb-4">
        <label className="mr-2">Select Volatility:</label>
        <select
          className="text-black p-1 rounded"
          value={volatility}
          onChange={(e) => setVolatility(e.target.value)}
        >
          <option>Volatility 10</option>
          <option>Volatility 25</option>
          <option>Volatility 50</option>
          <option>Volatility 75</option>
          <option>Volatility 100</option>
        </select>
      </div>

      <div className="bg-gray-800 p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-2">🎯 Sniper Alerts</h2>
        <ul className="max-h-80 overflow-y-scroll">
          {sniperAlerts.map((alert, i) => (
            <li key={i} className="mb-2 p-2 border border-green-500 rounded">
              <div><strong>Digit:</strong> {alert.digit}</div>
              <div><strong>Volatility:</strong> {alert.volatility}</div>
              <div><strong>Pattern Count:</strong> {alert.sniperCount}</div>
              <div><strong>Chain:</strong> {alert.groupChain.join(' → ')}</div>
              <div><strong>Time:</strong> {new Date(alert.time).toLocaleTimeString()}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
