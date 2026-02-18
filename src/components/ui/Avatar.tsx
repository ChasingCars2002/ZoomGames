import React from 'react';

type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  name: string;
  color?: string;
  size?: AvatarSize;
  isBot?: boolean;
}

const sizeDimensions: Record<AvatarSize, { container: string; text: string; botIcon: string }> = {
  sm: { container: 'w-8 h-8', text: 'text-sm', botIcon: 'text-[8px]' },
  md: { container: 'w-10 h-10', text: 'text-base', botIcon: 'text-[10px]' },
  lg: { container: 'w-14 h-14', text: 'text-xl', botIcon: 'text-xs' },
};

const defaultColors = [
  '#f5e642', // neon yellow
  '#ff2d78', // neon pink
  '#00e5ff', // neon cyan
  '#39ff14', // neon green
  '#bf40ff', // neon purple
];

function getColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return defaultColors[Math.abs(hash) % defaultColors.length];
}

const Avatar: React.FC<AvatarProps> = ({
  name,
  color,
  size = 'md',
  isBot = false,
}) => {
  const bgColor = color || getColorFromName(name);
  const initial = name.charAt(0).toUpperCase();
  const dims = sizeDimensions[size];

  return (
    <div
      className={[
        dims.container,
        'relative rounded-full flex items-center justify-center',
        'font-display text-navy-900 select-none shrink-0',
        dims.text,
      ].join(' ')}
      style={{ backgroundColor: bgColor }}
      title={name}
    >
      {initial}
      {isBot && (
        <span
          className={[
            'absolute -bottom-0.5 -right-0.5',
            'bg-navy-900 border border-neon-green rounded-full',
            'flex items-center justify-center',
            'w-4 h-4',
            dims.botIcon,
          ].join(' ')}
          title="Bot"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#39ff14"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-2.5 h-2.5"
          >
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="2" />
            <line x1="12" y1="7" x2="12" y2="11" />
            <circle cx="8" cy="16" r="1" fill="#39ff14" />
            <circle cx="16" cy="16" r="1" fill="#39ff14" />
          </svg>
        </span>
      )}
    </div>
  );
};

export default Avatar;
