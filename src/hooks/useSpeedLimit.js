import { useState, useEffect, useRef } from 'react';

function parseMaxspeed(ms) {
  if (!ms || ms === 'none' || ms === 'signals') return null;
  const m = String(ms).match(/(\d+)/);
  if (!m) return null;
  let v = parseInt(m[1], 10);
  if (/mph/i.test(ms)) v = Math.round(v * 1.609);
  return v;
}

export function useSpeedLimit(userPos) {
  const [limit, setLimit] = useState(null);
  const lastCellRef = useRef('');

  useEffect(() => {
    if (!userPos) return;
    const [lat, lng] = userPos;
    const cell = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    if (cell === lastCellRef.current) return;
    lastCellRef.current = cell;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4500);
    const query = `[out:json][timeout:5];way(around:25,${lat},${lng})["maxspeed"];out tags 5;`;
    fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d) => {
        const ways = d?.elements || [];
        for (const w of ways) {
          const v = parseMaxspeed(w.tags?.maxspeed || w.tags?.['maxspeed:forward']);
          if (v) { setLimit(v); return; }
        }
      })
      .catch(() => {});
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [userPos]);

  return limit;
}