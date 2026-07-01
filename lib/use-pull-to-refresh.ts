import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const THRESHOLD = 64;

export function usePullToRefresh() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    } else {
      startY.current = 0;
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === 0) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && containerRef.current?.scrollTop === 0) {
      setPullY(Math.min(dy * 0.45, THRESHOLD + 16));
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (pullY >= THRESHOLD) {
      setRefreshing(true);
      router.refresh();
      setTimeout(() => setRefreshing(false), 900);
    }
    setPullY(0);
    startY.current = 0;
  }, [pullY, router]);

  return { containerRef, pullY, refreshing, onTouchStart, onTouchMove, onTouchEnd };
}
