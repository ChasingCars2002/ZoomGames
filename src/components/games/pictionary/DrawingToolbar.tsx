import React, { useState } from 'react';

// ---------------------------------------------------------------------------
// DrawingToolbar – Color palette, brush sizes, eraser, undo, clear
// ---------------------------------------------------------------------------

interface DrawingToolbarProps {
  currentColor: string;
  onColorChange: (color: string) => void;
  currentSize: number;
  onSizeChange: (size: number) => void;
  onClear: () => void;
  onUndo: () => void;
  isEraser: boolean;
  onToggleEraser: () => void;
}

const COLOR_PALETTE = [
  '#000000', // black
  '#ffffff', // white
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#92400e', // brown
  '#6b7280', // gray
  '#84cc16', // lime
  '#14b8a6', // teal
  '#1e3a5f', // navy
  '#7f1d1d', // maroon
];

const BRUSH_SIZES = [
  { label: 'S', size: 3 },
  { label: 'M', size: 8 },
  { label: 'L', size: 16 },
];

const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  currentColor,
  onColorChange,
  currentSize,
  onSizeChange,
  onClear,
  onUndo,
  isEraser,
  onToggleEraser,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClearClick = () => {
    if (showClearConfirm) {
      onClear();
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      // Auto-dismiss confirm after 3 seconds
      setTimeout(() => setShowClearConfirm(false), 3000);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 bg-navy-800/60 rounded-xl border border-white/5">
      {/* ---------- Color Palette ---------- */}
      <div className="flex flex-wrap gap-1.5">
        {COLOR_PALETTE.map((color) => (
          <button
            key={color}
            onClick={() => {
              onColorChange(color);
              // Switching color turns off eraser
              if (isEraser) onToggleEraser();
            }}
            className={[
              'w-7 h-7 rounded-md border-2 transition-all duration-150',
              'hover:scale-110 active:scale-95',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan',
              currentColor === color && !isEraser
                ? 'border-neon-yellow scale-110 shadow-[0_0_8px_rgba(245,230,66,0.5)]'
                : 'border-white/20 hover:border-white/40',
            ].join(' ')}
            style={{ backgroundColor: color }}
            aria-label={`Color ${color}`}
            title={color}
          />
        ))}
      </div>

      {/* ---------- Divider ---------- */}
      <div className="w-px h-8 bg-white/10 hidden sm:block" />

      {/* ---------- Brush Sizes ---------- */}
      <div className="flex items-center gap-2">
        {BRUSH_SIZES.map(({ label, size }) => (
          <button
            key={size}
            onClick={() => onSizeChange(size)}
            className={[
              'flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150',
              'hover:bg-white/10 active:scale-95',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan',
              currentSize === size && !isEraser
                ? 'bg-white/15 border border-neon-cyan/50'
                : 'bg-white/5 border border-transparent',
            ].join(' ')}
            aria-label={`Brush size ${label}`}
            title={`Size: ${size}px`}
          >
            <div
              className="rounded-full bg-white"
              style={{ width: size, height: size }}
            />
          </button>
        ))}
      </div>

      {/* ---------- Divider ---------- */}
      <div className="w-px h-8 bg-white/10 hidden sm:block" />

      {/* ---------- Eraser Toggle ---------- */}
      <button
        onClick={onToggleEraser}
        className={[
          'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-display transition-all duration-150',
          'hover:bg-white/10 active:scale-95',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan',
          isEraser
            ? 'bg-neon-pink/20 text-neon-pink border border-neon-pink/40'
            : 'bg-white/5 text-white/70 border border-transparent hover:text-white',
        ].join(' ')}
        title="Eraser"
      >
        {/* Eraser icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
          <path d="M22 21H7" />
          <path d="m5 11 9 9" />
        </svg>
        <span className="hidden sm:inline">Eraser</span>
      </button>

      {/* ---------- Undo ---------- */}
      <button
        onClick={onUndo}
        className={[
          'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-display transition-all duration-150',
          'bg-white/5 text-white/70 border border-transparent',
          'hover:bg-white/10 hover:text-white active:scale-95',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan',
        ].join(' ')}
        title="Undo last stroke"
      >
        {/* Undo icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
        <span className="hidden sm:inline">Undo</span>
      </button>

      {/* ---------- Clear ---------- */}
      <button
        onClick={handleClearClick}
        className={[
          'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-display transition-all duration-150',
          'active:scale-95',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan',
          showClearConfirm
            ? 'bg-neon-pink/20 text-neon-pink border border-neon-pink/40 hover:bg-neon-pink/30'
            : 'bg-white/5 text-white/70 border border-transparent hover:bg-white/10 hover:text-white',
        ].join(' ')}
        title={showClearConfirm ? 'Click again to confirm clear' : 'Clear canvas'}
      >
        {/* Trash icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
        <span className="hidden sm:inline">
          {showClearConfirm ? 'Confirm?' : 'Clear'}
        </span>
      </button>
    </div>
  );
};

export default DrawingToolbar;
