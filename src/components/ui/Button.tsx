import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-neon-yellow text-navy-900 hover:glow-yellow active:bg-neon-yellow/90 disabled:bg-neon-yellow/40 disabled:text-navy-900/60',
  secondary:
    'bg-neon-cyan text-navy-900 hover:glow-cyan active:bg-neon-cyan/90 disabled:bg-neon-cyan/40 disabled:text-navy-900/60',
  danger:
    'bg-neon-pink text-white hover:glow-pink active:bg-neon-pink/90 disabled:bg-neon-pink/40 disabled:text-white/60',
  ghost:
    'bg-transparent text-white border border-white/20 hover:bg-white/10 hover:border-white/40 disabled:text-white/30 disabled:border-white/10',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-7 py-3.5 text-lg',
};

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  children,
  ...rest
}) => {
  return (
    <button
      disabled={disabled}
      className={[
        'font-display rounded-xl transition-all duration-200 ease-out',
        'select-none cursor-pointer',
        'hover:scale-105 active:scale-95',
        'disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
};

export default Button;
