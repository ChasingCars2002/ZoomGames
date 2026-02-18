import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Transport } from '../lib/transport/Transport';
import { BroadcastTransport } from '../lib/transport/BroadcastTransport';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface TransportContextValue {
  transport: Transport | null;
}

const TransportContext = createContext<TransportContextValue>({ transport: null });

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface TransportProviderProps {
  roomCode: string;
  children: ReactNode;
}

export function TransportProvider({ roomCode, children }: TransportProviderProps) {
  const [transport, setTransport] = useState<Transport | null>(null);
  const transportRef = useRef<Transport | null>(null);

  useEffect(() => {
    // Create a new BroadcastTransport for this room code
    const instance = new BroadcastTransport(roomCode);
    transportRef.current = instance;
    setTransport(instance);

    return () => {
      // Clean up on unmount or when roomCode changes
      instance.destroy();
      transportRef.current = null;
      setTransport(null);
    };
  }, [roomCode]);

  return (
    <TransportContext.Provider value={{ transport }}>
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
