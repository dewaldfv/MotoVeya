import { useRef, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

const THRESHOLD = 70;
const MAX_PULL = 120;

export default function PullToRefresh({ onRefresh, children }) {
  const scrollRef = useRef(null);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = useCallback((e) => {
    const el = scrollRef.current;
    if (el && el.scrollTop <= 0 && !refreshing) {
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    } else {
      pullingRef.current = false;
    }
  }, [refreshing]);

  const onTouchMove = useCallback((e) => {
    if (!pullingRef.current || refreshing) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) {
      setPull(Math.min(delta * 0.5, MAX_PULL));
    }
  }, [refreshing]);

  const onTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;
    if (pull >= THRESHOLD) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try {
        await onRefresh?.();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  }, [pull, onRefresh, refreshing]);

  const progress = Math.min(pull / THRESHOLD, 1);

  return (
    <div
      ref={scrollRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="h-screen overflow-y-auto"
      style={{ overscrollBehaviorY: 'none', WebkitOverflowScrolling: 'touch' }}
    >
      {(pull > 0 || refreshing) && (
        <div className="flex items-center justify-center" style={{ height: pull }}>
          <RefreshCw
            size={24}
            className={`text-muted-foreground ${refreshing ? 'animate-spin' : ''}`}
            style={{ opacity: refreshing ? 1 : progress }}
          />
        </div>
      )}
      {children}
    </div>
  );
}