import React from 'react';

interface HangmanFigureProps {
  wrongCount: number; // 0–6
  maxWrong: number;
  outcome: 'pending' | 'won' | 'lost';
}

/**
 * Gallows + figure SVG. Body parts appear one per wrong guess:
 * head, body, left arm, right arm, left leg, right leg.
 */
const HangmanFigure: React.FC<HangmanFigureProps> = ({ wrongCount, maxWrong, outcome }) => {
  const danger = wrongCount / maxWrong;
  const figureColor =
    outcome === 'won'
      ? '#39ff14'
      : outcome === 'lost'
        ? '#ff2d78'
        : danger >= 0.66
          ? '#ff2d78'
          : danger >= 0.33
            ? '#f5e642'
            : '#00e5ff';

  const part = (n: number) => wrongCount >= n;

  return (
    <svg
      viewBox="0 0 200 220"
      className={`w-full max-w-[200px] ${wrongCount === maxWrong - 1 && outcome === 'pending' ? 'animate-pulse' : ''}`}
      role="img"
      aria-label={`${wrongCount} of ${maxWrong} wrong guesses`}
    >
      {/* Gallows */}
      <g stroke="rgba(255,255,255,0.35)" strokeWidth="6" strokeLinecap="round" fill="none">
        <line x1="20" y1="210" x2="120" y2="210" />
        <line x1="60" y1="210" x2="60" y2="20" />
        <line x1="60" y1="20" x2="140" y2="20" />
        <line x1="140" y1="20" x2="140" y2="45" />
      </g>

      {/* Figure */}
      <g
        stroke={figureColor}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
        style={{ transition: 'stroke 0.4s ease' }}
      >
        {part(1) && <circle cx="140" cy="62" r="17" />}
        {part(2) && <line x1="140" y1="79" x2="140" y2="135" />}
        {part(3) && <line x1="140" y1="95" x2="115" y2="118" />}
        {part(4) && <line x1="140" y1="95" x2="165" y2="118" />}
        {part(5) && <line x1="140" y1="135" x2="118" y2="170" />}
        {part(6) && <line x1="140" y1="135" x2="162" y2="170" />}
      </g>

      {/* Face on game over */}
      {outcome === 'lost' && (
        <g stroke={figureColor} strokeWidth="2.5" strokeLinecap="round">
          <line x1="133" y1="57" x2="138" y2="62" />
          <line x1="138" y1="57" x2="133" y2="62" />
          <line x1="142" y1="57" x2="147" y2="62" />
          <line x1="147" y1="57" x2="142" y2="62" />
        </g>
      )}
      {outcome === 'won' && wrongCount >= 1 && (
        <g stroke={figureColor} strokeWidth="2.5" strokeLinecap="round" fill="none">
          <circle cx="135" cy="58" r="1.5" />
          <circle cx="145" cy="58" r="1.5" />
          <path d="M 134 67 Q 140 72 146 67" />
        </g>
      )}
    </svg>
  );
};

export default HangmanFigure;
