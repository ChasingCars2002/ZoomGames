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

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface TransportContextValue {
  transport: Transport | null;
  isTransportReady: boolean;
}

const TransportContext = createContext<TransportContextValue>({
  transport: null,
  isTransportReady: false,
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
  const transportRef = useRef<PeerJSTransport | null>(null);

  useEffect(() => {
    setIsTransportReady(false);
    setTransport(null);

    const instance = new PeerJSTransport(roomCode, isHost);
    transportRef.current = instance;

    instance.ready
      .then(() => {
        setTransport(instance);
        setIsTransportReady(true);
      })
      .catch((err) => {
        console.error('[TransportContext] PeerJS init failed', err);
      });

    return () => {
      instance.destroy();
      transportRef.current = null;
      setTransport(null);
      setIsTransportReady(false);
    };
  }, [roomCode, isHost]);

  return (
    <TransportContext.Provider value={{ transport, isTransportReady }}>
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
