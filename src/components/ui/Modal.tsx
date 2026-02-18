import React, { useEffect, useCallback } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-navy-900/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className={[
          'relative w-full max-w-lg',
          'bg-surface/90 backdrop-blur-xl border border-white/10 rounded-2xl',
          'shadow-2xl animate-bounce-in',
          'p-6',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h2 className="font-display text-xl text-white text-glow-cyan">
              {title}
            </h2>
          )}
          <button
            onClick={onClose}
            className={[
              'ml-auto flex items-center justify-center w-8 h-8 rounded-lg',
              'text-white/50 hover:text-white hover:bg-white/10',
              'transition-all duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan',
            ].join(' ')}
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
