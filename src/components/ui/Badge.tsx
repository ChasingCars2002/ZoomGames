import React from 'react';

type BadgeVariant = 'host' | 'player' | 'spectator' | 'bot' | 'ready' | 'not-ready';

interface BadgeProps {
  variant: BadgeVariant;
  children?: React.ReactNode;
}

const variantConfig: Record<BadgeVariant, { bg: string; text: string; label: string }> = {
  host: {
    bg: 'bg-neon-yellow/20 border-neon-yellow/40',
    text: 'text-neon-yellow',
    label: 'HOST',
  },
  player: {
    bg: 'bg-neon-cyan/20 border-neon-cyan/40',
    text: 'text-neon-cyan',
    label: 'PLAYER',
  },
  spectator: {
    bg: 'bg-neon-purple/20 border-neon-purple/40',
    text: 'text-neon-purple',
    label: 'SPECTATOR',
  },
  bot: {
    bg: 'bg-neon-green/20 border-neon-green/40',
    text: 'text-neon-green',
    label: 'BOT',
  },
  ready: {
    bg: 'bg-neon-green/20 border-neon-green/40',
    text: 'text-neon-green',
    label: 'READY',
  },
  'not-ready': {
    bg: 'bg-neon-pink/20 border-neon-pink/40',
    text: 'text-neon-pink',
    label: 'NOT READY',
  },
};

const Badge: React.FC<BadgeProps> = ({ variant, children }) => {
  const config = variantConfig[variant];

  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-display border',
        'select-none',
        config.bg,
        config.text,
      ].join(' ')}
    >
      {children ?? config.label}
    </span>
  );
};

export default Badge;
