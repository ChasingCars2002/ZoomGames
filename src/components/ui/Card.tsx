import React from 'react';

type GlowColor = 'yellow' | 'pink' | 'cyan' | 'none';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: GlowColor;
}

const glowClasses: Record<GlowColor, string> = {
  yellow: 'border-neon-yellow/30 glow-yellow',
  pink: 'border-neon-pink/30 glow-pink',
  cyan: 'border-neon-cyan/30 glow-cyan',
  none: 'border-white/10',
};

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  glow = 'none',
}) => {
  return (
    <div
      className={[
        'bg-surface/80 backdrop-blur-xl border rounded-2xl p-6',
        glowClasses[glow],
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
};

export default Card;
