import React from 'react';

type ProgressColor = 'yellow' | 'pink' | 'cyan';
type ProgressHeight = 'sm' | 'md';

interface ProgressBarProps {
  progress: number;
  color?: ProgressColor;
  height?: ProgressHeight;
}

const colorClasses: Record<ProgressColor, { bar: string; glow: string }> = {
  yellow: {
    bar: 'bg-neon-yellow',
    glow: 'shadow-[0_0_12px_rgba(245,230,66,0.5)]',
  },
  pink: {
    bar: 'bg-neon-pink',
    glow: 'shadow-[0_0_12px_rgba(255,45,120,0.5)]',
  },
  cyan: {
    bar: 'bg-neon-cyan',
    glow: 'shadow-[0_0_12px_rgba(0,229,255,0.5)]',
  },
};

const heightClasses: Record<ProgressHeight, string> = {
  sm: 'h-1.5',
  md: 'h-3',
};

const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color = 'cyan',
  height = 'md',
}) => {
  const clamped = Math.max(0, Math.min(100, progress));
  const config = colorClasses[color];

  return (
    <div
      className={[
        'w-full rounded-full overflow-hidden bg-white/10',
        heightClasses[height],
      ].join(' ')}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={[
          'h-full rounded-full transition-all duration-500 ease-out',
          config.bar,
          config.glow,
        ].join(' ')}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};

export default ProgressBar;
