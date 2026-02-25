import app from "./app";
import http from "http";
import { Server } from "socket.io";
import config from "./config";

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
  server.listen(config.PORT, () => {
    console.log(`server running on port ${config.port}`);
  });
}

StartServer();

