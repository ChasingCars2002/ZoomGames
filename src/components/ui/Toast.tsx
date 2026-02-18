import React, { useEffect } from 'react';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  visible: boolean;
  onDismiss?: () => void;
  duration?: number;
}

const typeConfig: Record<ToastType, { bg: string; border: string; icon: React.ReactNode }> = {
  success: {
    bg: 'bg-neon-green/10',
    border: 'border-neon-green/40',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#39ff14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  error: {
    bg: 'bg-neon-pink/10',
    border: 'border-neon-pink/40',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff2d78" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
  info: {
    bg: 'bg-neon-cyan/10',
    border: 'border-neon-cyan/40',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00e5ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  },
};

const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  visible,
  onDismiss,
  duration = 3000,
}) => {
  useEffect(() => {
    if (visible && onDismiss && duration > 0) {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, onDismiss, duration]);

  const config = typeConfig[type];

  return (
    <div
      className={[
        'fixed top-4 right-4 z-[100] max-w-sm',
        'transition-all duration-300 ease-out',
        visible
          ? 'translate-x-0 opacity-100'
          : 'translate-x-full opacity-0 pointer-events-none',
      ].join(' ')}
      role="alert"
    >
      <div
        className={[
          'flex items-center gap-3 px-4 py-3 rounded-xl border',
          'bg-surface/90 backdrop-blur-xl shadow-lg',
          config.border,
        ].join(' ')}
      >
        <span className="shrink-0">{config.icon}</span>
        <p className="font-body text-sm text-white">{message}</p>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 ml-2 text-white/40 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default Toast;
