import React from 'react';

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * A styled range input on a neon track. The fill grows from the left to the
 * thumb. Used by Mind Meld for spectrum guessing, but generic enough to reuse.
 */
const Slider: React.FC<SliderProps> = ({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  ariaLabel = 'Slider',
}) => {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="w-full py-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
        className="zg-slider w-full"
        style={{
          background: `linear-gradient(to right, #00e5ff 0%, #00e5ff ${pct}%, rgba(255,255,255,0.12) ${pct}%, rgba(255,255,255,0.12) 100%)`,
        }}
      />
      <style>{`
        .zg-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 10px;
          border-radius: 9999px;
          outline: none;
          cursor: pointer;
        }
        .zg-slider:disabled { cursor: not-allowed; opacity: 0.6; }
        .zg-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 26px;
          height: 26px;
          border-radius: 9999px;
          background: #00e5ff;
          border: 3px solid #0a0e27;
          box-shadow: 0 0 12px rgba(0, 229, 255, 0.7);
          transition: transform 0.1s ease;
        }
        .zg-slider:active::-webkit-slider-thumb { transform: scale(1.15); }
        .zg-slider::-moz-range-thumb {
          width: 26px;
          height: 26px;
          border-radius: 9999px;
          background: #00e5ff;
          border: 3px solid #0a0e27;
          box-shadow: 0 0 12px rgba(0, 229, 255, 0.7);
        }
      `}</style>
    </div>
  );
};

export default Slider;
