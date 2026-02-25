import { Server as SocketIOServer, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import config from "./config";
import { JwtPayload } from "./types";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

const userSockets = new Map<string, Set<string>>();

export const initSocket = (io: SocketIOServer): void => {
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    console.log(`🔌 Socket connected: ${socket.id} (User: ${userId})`);

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    socket.join(`user:${userId}`);

    socket.on("subscribe:video", (videoId: string) => {
      socket.join(`video:${videoId}`);
      console.log(`📺 User ${userId} subscribed to video ${videoId}`);
    });

    socket.on("unsubscribe:video", (videoId: string) => {
      socket.leave(`video:${videoId}`);
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSockets.delete(userId);
        }
      }
    });
  });
};

export const emitProgress = (
  io: SocketIOServer,
  videoId: string,
  userId: string,
  data: Record<string, unknown>,
): void => {
  io.to(`video:${videoId}`).emit("video:progress", {
    videoId,
    ...data,
  });
  io.to(`user:${userId}`).emit("video:progress", {
    videoId,
    ...data,
  });
};

export const emitComplete = (
  io: SocketIOServer,
  videoId: string,
  userId: string,
  data: Record<string, unknown>,
): void => {
  io.to(`video:${videoId}`).emit("video:complete", {
    videoId,
    ...data,
  });
  io.to(`user:${userId}`).emit("video:complete", {
    videoId,
    ...data,
  });
};

export const emitError = (
  io: SocketIOServer,
  videoId: string,
  userId: string,
  error: string,
): void => {
  io.to(`video:${videoId}`).emit("video:error", {
    videoId,
    error,
  });
  io.to(`user:${userId}`).emit("video:error", {
    videoId,
    error,
  });
};
