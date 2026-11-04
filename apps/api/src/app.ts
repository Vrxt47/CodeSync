import express, { type Application } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { requestLogger } from "./middleware/requestLogger";
import { notFoundMiddleware } from "./middleware/not-found.middleware";
import { errorMiddleware } from "./middleware/error.middleware";
import { apiRouter } from "./routes";

export function createApp(): Application {
  const app: Application = express();

  // Basic security headers
  app.use(helmet());

  // CORS configuration
  const allowedOrigins = Array.from(new Set([env.CLIENT_URL, env.CORS_ORIGIN]));
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
    })
  );

  // Body parsers and cookie parser
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true, limit: "5mb" }));
  app.use(cookieParser());

  // Request logging
  app.use(requestLogger);

  // Mount API router (/api/health, etc.)
  app.use("/api", apiRouter);

  // 404 Not Found Middleware
  app.use(notFoundMiddleware);

  // Centralized Error Handling Middleware
  app.use(errorMiddleware);

  return app;
}
