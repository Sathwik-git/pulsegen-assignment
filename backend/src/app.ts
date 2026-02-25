import express from "express";
import cors from "cors";
import config from "./config";
import morgan from 'morgan';

const app = express();

app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "DELETE", "PUT", "PATCH"],
    allowedHeaders: ["content-type", "Authorization"],
  }),
);

if (config.nodeEnv === "development") {
  app.use(morgan("dev"));
}

app.use(express.json());

app.use("api/auth", authRoutes);
app.use("api/users", userRoutes);
app.use("api/videos", videoRoutes);

export default app;
