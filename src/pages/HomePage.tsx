import React, { useState, useCallback } from 'react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import { sanitizeNickname } from '../lib/security/sanitize';
import { isValidRoomCode } from '../lib/security/roomCodes';
import { checkRateLimit } from '../lib/security/rateLimit';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HomePageProps {
  onCreateRoom: (nickname: string) => void;
  onJoinRoom: (code: string, nickname: string) => void;
}

// ---------------------------------------------------------------------------
// HomePage
// ---------------------------------------------------------------------------

const HomePage: React.FC<HomePageProps> = ({ onCreateRoom, onJoinRoom }) => {
  // Create room state
  const [createNickname, setCreateNickname] = useState('');
  const [createError, setCreateError] = useState('');

  // Join room state
  const [joinCode, setJoinCode] = useState('');
  const [joinNickname, setJoinNickname] = useState('');
  const [joinError, setJoinError] = useState('');

  // Handle create room
  const handleCreate = useCallback(() => {
    setCreateError('');

    const sanitized = sanitizeNickname(createNickname);
    if (!sanitized || sanitized.length < 1) {
      setCreateError('Please enter a nickname (at least 1 character).');
      return;
    }

    const rateCheck = checkRateLimit('room_create');
    if (!rateCheck.allowed) {
      setCreateError(
        `Too many attempts. Try again in ${Math.ceil(rateCheck.retryAfter / 1000)}s.`
      );
      return;
    }

    onCreateRoom(sanitized);
  }, [createNickname, onCreateRoom]);

  // Handle join room
  const handleJoin = useCallback(() => {
    setJoinError('');

    const sanitized = sanitizeNickname(joinNickname);
    if (!sanitized || sanitized.length < 1) {
      setJoinError('Please enter a nickname (at least 1 character).');
      return;
    }

    const codeUpper = joinCode.toUpperCase().trim();
    if (!isValidRoomCode(codeUpper)) {
      setJoinError('Room code must be exactly 6 alphanumeric characters.');
      return;
    }

    onJoinRoom(codeUpper, sanitized);
  }, [joinCode, joinNickname, onJoinRoom]);

  // Handle room code input (uppercase, max 6 chars)
  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setJoinCode(val);
    setJoinError('');
  }, []);

  // Handle create nickname input
  const handleCreateNicknameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCreateNickname(e.target.value);
    setCreateError('');
  }, []);

  // Handle join nickname input
  const handleJoinNicknameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setJoinNickname(e.target.value);
    setJoinError('');
  }, []);

  // Enter key handlers
  const handleCreateKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleCreate();
    },
    [handleCreate]
  );

  const handleJoinKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleJoin();
    },
    [handleJoin]
  );

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 relative">
      {/* Animated background particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              backgroundColor:
                i % 3 === 0
                  ? 'rgba(245, 230, 66, 0.4)'
                  : i % 3 === 1
                  ? 'rgba(0, 229, 255, 0.3)'
                  : 'rgba(255, 45, 120, 0.3)',
              animation: `homeParticleFloat ${6 + Math.random() * 8}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      {/* Title */}
      <div className="relative z-10 text-center mb-10">
        <h1
          className="font-display text-6xl md:text-7xl text-neon-yellow drop-shadow-lg"
          style={{
            textShadow: '0 0 20px rgba(245, 230, 66, 0.5), 0 0 40px rgba(245, 230, 66, 0.3)',
            animation: 'titleFloat 4s ease-in-out infinite',
          }}
        >
          ZoomGames
        </h1>
        <p className="font-body text-lg text-white/60 mt-3 tracking-wide">
          Party Games for Zoom Calls
        </p>
      </div>

      {/* Create / Join cards */}
      <div className="relative z-10 flex flex-col md:flex-row gap-6 w-full max-w-2xl">
        {/* Create Room */}
        <Card glow="yellow" className="flex-1 p-6">
          <h2 className="font-display text-xl text-neon-yellow mb-4">Create Room</h2>
          <div className="flex flex-col gap-3">
            <Input
              label="Your Nickname"
              placeholder="Enter nickname..."
              value={createNickname}
              onChange={handleCreateNicknameChange}
              onKeyDown={handleCreateKeyDown}
              maxLength={20}
            />
            {createError && (
              <p className="text-neon-pink text-sm font-body">{createError}</p>
            )}
            <Button variant="primary" size="lg" onClick={handleCreate} className="w-full mt-1">
              Create Room
            </Button>
          </div>
        </Card>

        {/* Divider */}
        <div className="hidden md:flex items-center">
          <div className="w-px h-full bg-white/10" />
          <span className="font-body text-white/30 px-3 text-sm">OR</span>
          <div className="w-px h-full bg-white/10" />
        </div>
        <div className="flex md:hidden items-center justify-center">
          <div className="h-px flex-1 bg-white/10" />
          <span className="font-body text-white/30 px-3 text-sm">OR</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Join Room */}
        <Card glow="cyan" className="flex-1 p-6">
          <h2 className="font-display text-xl text-neon-cyan mb-4">Join Room</h2>
          <div className="flex flex-col gap-3">
            <Input
              label="Room Code"
              placeholder="e.g. ABC123"
              value={joinCode}
              onChange={handleCodeChange}
              onKeyDown={handleJoinKeyDown}
              maxLength={6}
              style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600 }}
            />
            <Input
              label="Your Nickname"
              placeholder="Enter nickname..."
              value={joinNickname}
              onChange={handleJoinNicknameChange}
              onKeyDown={handleJoinKeyDown}
              maxLength={20}
            />
            {joinError && (
              <p className="text-neon-pink text-sm font-body">{joinError}</p>
            )}
            <Button variant="secondary" size="lg" onClick={handleJoin} className="w-full mt-1">
              Join Room
            </Button>
          </div>
        </Card>
      </div>

      {/* Stats footer */}
      <div className="relative z-10 mt-8">
        <p className="font-body text-sm text-white/30">
          Active rooms: <span className="text-white/50">1</span>
          <span className="mx-2">|</span>
          Players online: <span className="text-white/50">3</span>
        </p>
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes titleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes homeParticleFloat {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
          25% { transform: translate(10px, -15px) scale(1.2); opacity: 0.6; }
          50% { transform: translate(-5px, -30px) scale(0.8); opacity: 0.4; }
          75% { transform: translate(-15px, -10px) scale(1.1); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default HomePage;
