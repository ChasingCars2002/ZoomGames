import React, { useState, useRef, useEffect, useCallback } from 'react';
import { sanitizeMessage } from '../../lib/security/sanitize';

interface ChatMessage {
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
  isCorrect?: boolean;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSend,
  disabled = false,
  placeholder = 'Type a message...',
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const sanitized = sanitizeMessage(input);
      if (!sanitized || disabled) return;
      onSend(sanitized);
      setInput('');
    },
    [input, onSend, disabled]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const sanitized = sanitizeMessage(input);
        if (!sanitized || disabled) return;
        onSend(sanitized);
        setInput('');
      }
    },
    [input, onSend, disabled]
  );

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-navy-800/30 rounded-xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-white/5 shrink-0">
        <h3 className="font-display text-sm text-white/60 uppercase tracking-wider">
          Chat
        </h3>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2 min-h-0"
      >
        {messages.length === 0 && (
          <p className="text-center text-white/20 font-body text-sm py-8">
            No messages yet
          </p>
        )}
        {messages.map((msg, index) => (
          <div
            key={`${msg.playerId}-${msg.timestamp}-${index}`}
            className={[
              'animate-fade-in',
              msg.isCorrect ? 'bg-neon-green/10 rounded-lg px-2 py-1 -mx-2' : '',
            ].join(' ')}
          >
            <div className="flex items-baseline gap-2">
              <span className="font-display text-xs text-neon-cyan shrink-0">
                {msg.playerName}
              </span>
              <span className="font-body text-[10px] text-white/20 shrink-0">
                {formatTime(msg.timestamp)}
              </span>
            </div>
            <div className="flex items-start gap-1.5 mt-0.5">
              {msg.isCorrect && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#39ff14"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 mt-0.5"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              <p
                className={[
                  'font-body text-sm break-words',
                  msg.isCorrect
                    ? 'text-neon-green font-semibold'
                    : 'text-white/80',
                ].join(' ')}
              >
                {msg.text}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-3 py-2.5 border-t border-white/5 shrink-0"
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder}
            maxLength={200}
            className={[
              'flex-1 font-body text-sm text-white bg-navy-700 rounded-lg px-3 py-2',
              'placeholder:text-white/25 border border-white/10',
              'focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan/30',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-200',
            ].join(' ')}
          />
          <button
            type="submit"
            disabled={disabled || !input.trim()}
            className={[
              'shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
              'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30',
              'hover:bg-neon-cyan/30 hover:border-neon-cyan/50',
              'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-neon-cyan/20',
              'transition-all duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan',
            ].join(' ')}
            aria-label="Send message"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="none"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatPanel;
