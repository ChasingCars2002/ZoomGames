import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// useTimer
// ---------------------------------------------------------------------------

interface UseTimerReturn {
  timeRemaining: number;
  isRunning: boolean;
  start: () => void;
  pause: () => void;
  reset: (newTime?: number) => void;
}

export function useTimer(
  initialTime: number,
  onTick?: (remaining: number) => void,
  onExpire?: () => void,
  autoStart = false,
): UseTimerReturn {
  const [timeRemaining, setTimeRemaining] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(autoStart);

  // Refs to avoid stale closures
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const timeRemainingRef = useRef(timeRemaining);
  timeRemainingRef.current = timeRemaining;

  // ---- start ----
  const start = useCallback(() => {
    if (timeRemainingRef.current > 0) {
      setIsRunning(true);
    }
  }, []);

  // ---- pause ----
  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  // ---- reset ----
  const reset = useCallback(
    (newTime?: number) => {
      const t = newTime ?? initialTime;
      setTimeRemaining(t);
      timeRemainingRef.current = t;
      setIsRunning(false);
    },
    [initialTime],
  );

  // ---- interval ----
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        const next = prev - 1;

        if (next <= 0) {
          setIsRunning(false);
          clearInterval(interval);
          onTickRef.current?.(0);
          onExpireRef.current?.();
          return 0;
        }

        onTickRef.current?.(next);
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  return { timeRemaining, isRunning, start, pause, reset };
}

export default useTimer;
