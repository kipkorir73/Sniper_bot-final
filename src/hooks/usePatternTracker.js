
import { useEffect, useRef, useState } from "react";

const MAX_HISTORY = 10000;
const MIN_SNIPER_PATTERNS = 3;

export default function usePatternTracker(ticks, selectedVolatility) {
  const [sniperAlerts, setSniperAlerts] = useState([]);
  const tickHistoryRef = useRef([]);
  const patternClustersRef = useRef([]);
  const digitTrackersRef = useRef({});

  useEffect(() => {
    if (!ticks || ticks.length === 0) return;
    for (const tick of ticks) {
      processTick(tick);
    }
  }, [ticks]);

  function processTick(tick) {
    const tickHistory = tickHistoryRef.current;
    const digit = parseInt(tick.price.toString().slice(-1));

    const newTick = {
      time: tick.time,
      price: tick.price,
      digit,
      volatility: tick.volatility
    };

    tickHistory.push(newTick);
    if (tickHistory.length > MAX_HISTORY) tickHistory.shift();

    detectPattern(newTick);
  }

  function detectPattern(newTick) {
    const digit = newTick.digit;
    const history = tickHistoryRef.current;
    const recent = history.slice(-10); // Short window to scan patterns

    let count = 1;
    for (let i = recent.length - 2; i >= 0; i--) {
      if (recent[i].digit === digit) {
        count++;
      } else break;
    }

    if (count >= 2) {
      const cluster = {
        digit,
        size: count,
        startIndex: history.length - count,
        endIndex: history.length - 1,
        volatility: newTick.volatility,
        groupId: `${newTick.volatility}-${digit}-G${count}-${Date.now()}`
      };

      patternClustersRef.current.push(cluster);
      trackDigitPattern(cluster);
    }
  }

  function trackDigitPattern(cluster) {
    const key = `${cluster.volatility}-${cluster.digit}`;
    if (!digitTrackersRef.current[key]) {
      digitTrackersRef.current[key] = {
        digit: cluster.digit,
        volatility: cluster.volatility,
        recentGroups: [],
        sniperCount: 0,
        isSniperActive: false
      };
    }

    const tracker = digitTrackersRef.current[key];
    tracker.recentGroups.push(cluster);

    // Remove noise between clusters, keep last 5 only
    if (tracker.recentGroups.length > 5) tracker.recentGroups.shift();

    // Count unique group appearances
    const groupCount = tracker.recentGroups.length;
    tracker.sniperCount = groupCount;

    // Trigger sniper if same digit forms MIN_SNIPER_PATTERNS or more clusters
    if (groupCount >= MIN_SNIPER_PATTERNS && !tracker.isSniperActive) {
      tracker.isSniperActive = true;
      const alert = {
        time: Date.now(),
        digit: tracker.digit,
        volatility: tracker.volatility,
        sniperCount: groupCount,
        groupChain: tracker.recentGroups.map(g => `G${g.size}`)
      };
      setSniperAlerts(prev => [...prev.slice(-20), alert]);
      speakAlert(alert);
    }

    // Reset sniper if pattern broke (non-repeating cluster)
    if (groupCount >= MIN_SNIPER_PATTERNS && cluster.size === 1) {
      tracker.isSniperActive = false;
    }
  }

  function speakAlert(alert) {
    const msg = new SpeechSynthesisUtterance();
    msg.text = `Sniper Alert. Digit ${alert.digit} repeating. ${alert.sniperCount} patterns formed. Volatility ${alert.volatility}`;
    msg.rate = 1;
    msg.pitch = 1;
    window.speechSynthesis.speak(msg);
  }

  return {
    sniperAlerts,
    tickHistory: tickHistoryRef.current,
    patternClusters: patternClustersRef.current
  };
}
