import React, { useEffect } from 'react';

interface RoundTransitionProps {
  round: number;
  totalRounds: number;
  message?: string;
  onComplete: () => void;
}

const RoundTransition: React.FC<RoundTransitionProps> = ({
  round,
  totalRounds,
  message,
  onComplete,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/90 backdrop-blur-md animate-fade-in">
      {/* Background pulse rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
        <div
          className="absolute w-[300px] h-[300px] rounded-full border-2 border-neon-cyan/20"
          style={{
            animation: 'ringPulse 2s ease-out infinite',
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full border border-neon-pink/10"
          style={{
            animation: 'ringPulse 2s ease-out 0.3s infinite',
          }}
        />
        <div
          className="absolute w-[700px] h-[700px] rounded-full border border-neon-yellow/5"
          style={{
            animation: 'ringPulse 2s ease-out 0.6s infinite',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative flex flex-col items-center gap-4 animate-bounce-in">
        {/* Round label */}
        <div className="font-body text-sm uppercase tracking-[0.3em] text-white/40">
          Round
        </div>

        {/* Round number */}
        <div className="flex items-baseline gap-3">
          <span className="font-display text-8xl text-neon-yellow text-glow-yellow">
            {round}
          </span>
          <span className="font-display text-3xl text-white/30">
            / {totalRounds}
          </span>
        </div>

        {/* Optional message */}
        {message && (
          <div
            className="font-display text-xl text-neon-cyan text-glow-cyan mt-2"
            style={{
              animation: 'messageSlideUp 0.5s ease-out 0.3s both',
            }}
          >
            {message}
          </div>
        )}

        {/* Progress dots */}
        <div className="flex items-center gap-2 mt-4">
          {Array.from({ length: totalRounds }).map((_, i) => (
            <div
              key={i}
              className={[
                'w-2.5 h-2.5 rounded-full transition-all duration-300',
                i < round
                  ? 'bg-neon-yellow shadow-[0_0_6px_rgba(245,230,66,0.5)]'
                  : i === round - 1
                    ? 'bg-neon-yellow scale-125 shadow-[0_0_10px_rgba(245,230,66,0.7)]'
                    : 'bg-white/15',
              ].join(' ')}
            />
          ))}
        </div>
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes ringPulse {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes messageSlideUp {
          0% { transform: translateY(10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default RoundTransition;
