import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...rest }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="font-body text-sm text-white/70 pl-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            'w-full font-body text-white bg-navy-800 border rounded-xl px-4 py-2.5',
            'placeholder:text-white/30',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-neon-cyan focus:border-neon-cyan/50',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error
              ? 'border-neon-pink/60 focus:ring-neon-pink focus:border-neon-pink/50'
              : 'border-white/10 hover:border-white/20',
            className,
          ].join(' ')}
          {...rest}
        />
        {error && (
          <p className="font-body text-xs text-neon-pink pl-1">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
