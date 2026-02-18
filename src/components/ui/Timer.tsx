import React, { useMemo } from 'react';

type TimerSize = 'sm' | 'md' | 'lg';

interface TimerProps {
  timeRemaining: number;
  totalTime: number;
  size?: TimerSize;
  showSeconds?: boolean;
}

const sizeDimensions: Record<TimerSize, { width: number; stroke: number; fontSize: string }> = {
  sm: { width: 48, stroke: 3, fontSize: 'text-sm' },
  md: { width: 80, stroke: 5, fontSize: 'text-xl' },
  lg: { width: 120, stroke: 6, fontSize: 'text-3xl' },
};

const Timer: React.FC<TimerProps> = ({
  timeRemaining,
  totalTime,
  size = 'md',
  showSeconds = true,
}) => {
  const { width, stroke, fontSize } = sizeDimensions[size];
  const radius = (width - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const fraction = totalTime > 0 ? Math.max(0, Math.min(1, timeRemaining / totalTime)) : 0;
  const offset = circumference * (1 - fraction);

  const strokeColor = useMemo(() => {
    if (fraction > 0.6) return '#39ff14'; // green
    if (fraction > 0.3) return '#f5e642'; // yellow
    return '#ff2d78'; // red/pink
  }, [fraction]);

  const glowFilter = useMemo(() => {
    if (fraction > 0.6) return 'drop-shadow(0 0 4px rgba(57,255,20,0.6))';
    if (fraction > 0.3) return 'drop-shadow(0 0 4px rgba(245,230,66,0.6))';
    return 'drop-shadow(0 0 4px rgba(255,45,120,0.6))';
  }, [fraction]);

  const displayTime = Math.max(0, Math.ceil(timeRemaining));

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width, height: width }}>
      <svg
        width={width}
        height={width}
        className="-rotate-90"
        style={{ filter: glowFilter }}
      >
        {/* Background circle */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
        />
        {/* Progress circle */}
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-linear"
        />
      </svg>
      {showSeconds && (
        <span
          className={[
            'absolute font-display',
            fontSize,
            fraction <= 0.3 ? 'text-neon-pink' : fraction <= 0.6 ? 'text-neon-yellow' : 'text-neon-green',
          ].join(' ')}
        >
          {displayTime}
        </span>
      )}
    </div>
  );
};

export default Timer;
