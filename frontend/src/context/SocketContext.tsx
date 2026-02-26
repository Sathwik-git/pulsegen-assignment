import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  subscribeToVideo: (videoId: string) => void;
  unsubscribeFromVideo: (videoId: string) => void;
  on: (event: string, callback: (...args: unknown[]) => void) => () => void;
  off: (event: string, callback: (...args: unknown[]) => void) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

const SOCKET_URL: string =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const { user } = useAuth();
  const [connected, setConnected] = useState<boolean>(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) {
      // Disconnect if logged out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    // Create socket connection
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socket.on("connect", () => {
      console.log("🔌 Socket connected");
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("🔌 Socket disconnected");
      setConnected(false);
    });

    socket.on("connect_error", (err: Error) => {
      console.warn("Socket connection error:", err.message);
    });

    socket.on("role:updated", (updatedUser: Record<string, unknown>) => {
      console.log("Role updated by admin:", updatedUser);
      // Dynamically update auth context — will trigger re-render
      const event = new CustomEvent("role:updated", { detail: updatedUser });
      window.dispatchEvent(event);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user]);

  /**
   * Subscribe to a video's processing events.
   */
  const subscribeToVideo = (videoId: string): void => {
    if (socketRef.current) {
      socketRef.current.emit("subscribe:video", videoId);
    }
  };

  /**
   * Unsubscribe from a video's processing events.
   */
  const unsubscribeFromVideo = (videoId: string): void => {
    if (socketRef.current) {
      socketRef.current.emit("unsubscribe:video", videoId);
    }
  };

  /**
   * Listen for a specific event. Returns a cleanup function.
   */
  const on = (
    event: string,
    callback: (...args: unknown[]) => void,
  ): (() => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback as (...args: unknown[]) => void);
      return () =>
        socketRef.current?.off(event, callback as (...args: unknown[]) => void);
    }
    return () => {};
  };

  /**
   * Remove listener for a specific event.
   */
  const off = (event: string, callback: (...args: unknown[]) => void): void => {
    if (socketRef.current) {
      socketRef.current.off(event, callback as (...args: unknown[]) => void);
    }
  };

  const value: SocketContextValue = {
    socket: socketRef.current,
    connected,
    subscribeToVideo,
    unsubscribeFromVideo,
    on,
    off,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) throw new Error("useSocket must be used within SocketProvider");
  return context;
}
