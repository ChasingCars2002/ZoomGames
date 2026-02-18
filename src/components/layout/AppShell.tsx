import React from 'react';

interface AppShellProps {
  children: React.ReactNode;
}

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="relative min-h-screen bg-navy-900 flex items-center justify-center overflow-hidden">
      {/* Animated stars background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Gradient orbs */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
          style={{
            background: 'radial-gradient(circle, rgba(0,229,255,0.4) 0%, transparent 70%)',
            top: '-10%',
            right: '-5%',
            animation: 'floatOrb1 12s ease-in-out infinite',
          }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full opacity-15 blur-[100px]"
          style={{
            background: 'radial-gradient(circle, rgba(255,45,120,0.4) 0%, transparent 70%)',
            bottom: '-10%',
            left: '-5%',
            animation: 'floatOrb2 15s ease-in-out infinite',
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-10 blur-[80px]"
          style={{
            background: 'radial-gradient(circle, rgba(245,230,66,0.4) 0%, transparent 70%)',
            top: '40%',
            left: '30%',
            animation: 'floatOrb3 10s ease-in-out infinite',
          }}
        />

        {/* Star particles */}
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: `${Math.random() * 2 + 1}px`,
              height: `${Math.random() * 2 + 1}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.5 + 0.1,
              animation: `starTwinkle ${Math.random() * 4 + 2}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Main container */}
      <div className="relative z-10 max-w-[1280px] w-full min-h-[720px] max-h-[90vh] overflow-hidden flex flex-col">
        {children}
      </div>

      {/* Inline keyframes for background animations */}
      <style>{`
        @keyframes floatOrb1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-30px, 20px) scale(1.05); }
          66% { transform: translate(20px, -15px) scale(0.95); }
        }
        @keyframes floatOrb2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(25px, -20px) scale(1.1); }
          66% { transform: translate(-15px, 25px) scale(0.9); }
        }
        @keyframes floatOrb3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-20px, -20px) scale(1.08); }
        }
        @keyframes starTwinkle {
          0%, 100% { opacity: 0.1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.5); }
        }
      `}</style>
    </div>
  );
};

export default AppShell;
