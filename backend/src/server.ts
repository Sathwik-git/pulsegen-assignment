import app from "./app";
import http from "http";
import { Server } from "socket.io";
import config from "./config";
import { initSocket } from "./socket";
import connectDB from "./config/db";

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);
initSocket(io);

export async function StartServer() {
  await connectDB();
  server.listen(config.port,'0.0.0.0', () => {
    console.log(`server running on port ${config.port}`);
  });
}

StartServer();

