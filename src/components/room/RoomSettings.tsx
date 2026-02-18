import React, { useCallback } from 'react';
import { GameConfig } from '../../types';
import Card from '../ui/Card';

interface RoomSettingsProps {
  config: GameConfig;
  onChange: (config: GameConfig) => void;
  disabled?: boolean;
}

const RoomSettings: React.FC<RoomSettingsProps> = ({
  config,
  onChange,
  disabled = false,
}) => {
  const handleRoundsChange = useCallback(
    (value: number) => {
      onChange({ ...config, rounds: Math.min(20, Math.max(1, value)) });
    },
    [config, onChange]
  );

  const handleTimeLimitChange = useCallback(
    (value: number) => {
      onChange({ ...config, timeLimit: Math.min(120, Math.max(10, value)) });
    },
    [config, onChange]
  );

  const handleDifficultyChange = useCallback(
    (value: GameConfig['difficulty']) => {
      onChange({ ...config, difficulty: value });
    },
    [config, onChange]
  );

  const difficulties: { value: GameConfig['difficulty']; label: string; emoji: string }[] = [
    { value: 'easy', label: 'Easy', emoji: '🟢' },
    { value: 'medium', label: 'Medium', emoji: '🟡' },
    { value: 'hard', label: 'Hard', emoji: '🔴' },
  ];

  return (
    <Card className="glass">
      <h3 className="font-display text-sm text-white/60 uppercase tracking-wider mb-4">
        Game Settings
      </h3>

      <div className={[
        'flex flex-col gap-5',
        disabled ? 'opacity-60 pointer-events-none' : '',
      ].join(' ')}>
        {/* Rounds */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="font-body text-sm text-white/80">Rounds</label>
            <span className="font-mono text-sm text-neon-cyan font-bold">{config.rounds}</span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={config.rounds}
            onChange={(e) => handleRoundsChange(Number(e.target.value))}
            disabled={disabled}
            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-navy-700
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-5
              [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-neon-cyan
              [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,229,255,0.6)]
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-transform
              [&::-webkit-slider-thumb]:duration-150
              [&::-webkit-slider-thumb]:hover:scale-125
              [&::-moz-range-thumb]:w-5
              [&::-moz-range-thumb]:h-5
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-neon-cyan
              [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:shadow-[0_0_8px_rgba(0,229,255,0.6)]
              [&::-moz-range-thumb]:cursor-pointer
              [&::-moz-range-track]:bg-navy-700
              [&::-moz-range-track]:rounded-full
              [&::-moz-range-track]:h-2"
          />
          <div className="flex justify-between">
            <span className="font-body text-[10px] text-white/30">1</span>
            <span className="font-body text-[10px] text-white/30">20</span>
          </div>
        </div>

        {/* Time Limit */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="font-body text-sm text-white/80">Time Limit</label>
            <span className="font-mono text-sm text-neon-cyan font-bold">{config.timeLimit}s</span>
          </div>
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={config.timeLimit}
            onChange={(e) => handleTimeLimitChange(Number(e.target.value))}
            disabled={disabled}
            className="w-full h-2 rounded-full appearance-none cursor-pointer bg-navy-700
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-5
              [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-neon-cyan
              [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(0,229,255,0.6)]
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-transform
              [&::-webkit-slider-thumb]:duration-150
              [&::-webkit-slider-thumb]:hover:scale-125
              [&::-moz-range-thumb]:w-5
              [&::-moz-range-thumb]:h-5
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-neon-cyan
              [&::-moz-range-thumb]:border-0
              [&::-moz-range-thumb]:shadow-[0_0_8px_rgba(0,229,255,0.6)]
              [&::-moz-range-thumb]:cursor-pointer
              [&::-moz-range-track]:bg-navy-700
              [&::-moz-range-track]:rounded-full
              [&::-moz-range-track]:h-2"
          />
          <div className="flex justify-between">
            <span className="font-body text-[10px] text-white/30">10s</span>
            <span className="font-body text-[10px] text-white/30">120s</span>
          </div>
        </div>

        {/* Difficulty */}
        <div className="flex flex-col gap-2">
          <label className="font-body text-sm text-white/80">Difficulty</label>
          <div className="flex gap-2">
            {difficulties.map((diff) => (
              <button
                key={diff.value}
                onClick={() => handleDifficultyChange(diff.value)}
                disabled={disabled}
                className={[
                  'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl',
                  'font-display text-sm transition-all duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan',
                  config.difficulty === diff.value
                    ? 'bg-neon-cyan/20 border-2 border-neon-cyan/50 text-neon-cyan glow-cyan'
                    : 'bg-navy-700 border-2 border-white/10 text-white/60 hover:border-white/20 hover:text-white/80',
                ].join(' ')}
              >
                <span>{diff.emoji}</span>
                <span>{diff.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

export default RoomSettings;
