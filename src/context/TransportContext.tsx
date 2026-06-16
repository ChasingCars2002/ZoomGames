import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Transport } from '../lib/transport/Transport';
import { PeerJSTransport } from '../lib/transport/PeerJSTransport';
import { BroadcastTransport } from '../lib/transport/BroadcastTransport';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface TransportContextValue {
  transport: Transport | null;
  isTransportReady: boolean;
  roomCode: string;
}

const TransportContext = createContext<TransportContextValue>({
  transport: null,
  isTransportReady: false,
  roomCode: '',
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface TransportProviderProps {
  roomCode: string;
  isHost: boolean;
  children: ReactNode;
}

export function TransportProvider({ roomCode, isHost, children }: TransportProviderProps) {
  const [transport, setTransport] = useState<Transport | null>(null);
  const [isTransportReady, setIsTransportReady] = useState(false);
  const transportRef = useRef<Transport | null>(null);

  useEffect(() => {
    setIsTransportReady(false);
    setTransport(null);

    let cancelled = false;
    const instance = new PeerJSTransport(roomCode, isHost);
    transportRef.current = instance;

    instance.ready
      .then(() => {
        if (cancelled) return;
        setTransport(instance);
        setIsTransportReady(true);
      })
      .catch((err) => {
        console.error('[TransportContext] PeerJS init failed', err);
        if (cancelled) return;
        // Cross-device transport is unavailable (offline, or a network that
        // blocks WebRTC/CDNs). Fall back to BroadcastChannel so same-browser
        // play and the screen-share & verbal mode still work.
        instance.destroy();
        const fallback = new BroadcastTransport(roomCode);
        transportRef.current = fallback;
        setTransport(fallback);
        setIsTransportReady(true);
      });

    return () => {
      cancelled = true;
      transportRef.current?.destroy();
      transportRef.current = null;
      setTransport(null);
      setIsTransportReady(false);
    };
  }, [roomCode, isHost]);

  return (
    <TransportContext.Provider value={{ transport, isTransportReady, roomCode }}>
      {children}
    </TransportContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTransportContext(): TransportContextValue {
  const ctx = useContext(TransportContext);
  if (ctx === undefined) {
    throw new Error('useTransportContext must be used within a TransportProvider');
  }
  return ctx;
}

export default TransportContext;
