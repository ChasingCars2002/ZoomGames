import React from 'react';

export interface SpectrumMarker {
  id: string;
  value: number; // 0-100
  name: string;
  color?: string;
  isMe?: boolean;
}

interface SpectrumBarProps {
  leftLabel: string;
  rightLabel: string;
  markers?: SpectrumMarker[];
  /** When set (0-100), reveals the target zone and exact target line. */
  target?: number | null;
}

/**
 * The labeled spectrum: a gradient track with the pole labels at each end.
 * During the reveal it shows the target band (±4 bullseye, ±10 close) plus a
 * pin for every guesser.
 */
const SpectrumBar: React.FC<SpectrumBarProps> = ({
  leftLabel,
  rightLabel,
  markers = [],
  target = null,
}) => {
  const showTarget = target !== null && target >= 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="font-display text-sm text-neon-pink">{leftLabel}</span>
        <span className="font-display text-sm text-neon-cyan">{rightLabel}</span>
      </div>

      <div className="relative h-12 rounded-full overflow-visible">
        {/* Track */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-neon-pink/40 via-white/10 to-neon-cyan/40" />

        {/* Target zones */}
        {showTarget && (
          <>
            <div
              className="absolute top-0 bottom-0 bg-neon-green/15 border-x border-neon-green/30"
              style={{
                left: `${Math.max(0, target! - 10)}%`,
                width: `${Math.min(100, target! + 10) - Math.max(0, target! - 10)}%`,
              }}
            />
            <div
              className="absolute top-0 bottom-0 bg-neon-green/35"
              style={{
                left: `${Math.max(0, target! - 4)}%`,
                width: `${Math.min(100, target! + 4) - Math.max(0, target! - 4)}%`,
              }}
            />
            <div
              className="absolute top-[-6px] bottom-[-6px] w-1 bg-neon-green rounded-full"
              style={{ left: `calc(${target}% - 2px)` }}
            />
          </>
        )}

        {/* Guess markers */}
        {markers.map((m, i) => (
          <div
            key={m.id}
            className="absolute -top-1 flex flex-col items-center"
            style={{ left: `calc(${m.value}% - 8px)`, zIndex: 10 + i }}
          >
            <div
              className="w-4 h-4 rounded-full border-2 border-navy-900"
              style={{ background: m.color ?? '#f5e642' }}
              title={`${m.name}: ${m.value}`}
            />
            <span
              className={`mt-1 text-[10px] font-body whitespace-nowrap ${m.isMe ? 'text-neon-cyan font-bold' : 'text-white/60'}`}
            >
              {m.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpectrumBar;
