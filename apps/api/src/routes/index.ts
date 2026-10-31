import { Router } from "express";
import { healthRouter } from "./health.routes";

export const apiRouter = Router();

// Register health check route
apiRouter.use("/health", healthRouter);

// Future module routes will be registered here (e.g., /auth, /workspaces, /execution)
