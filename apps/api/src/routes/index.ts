import { Router } from "express";
import { healthRouter } from "./health.routes";
import { authRouter } from "../modules/auth/auth.routes";
import { workspaceRouter } from "../modules/workspaces/workspace.routes";

export const apiRouter = Router();

// Register health check route
apiRouter.use("/health", healthRouter);

// Register authentication routes
apiRouter.use("/auth", authRouter);

// Register workspace routes
apiRouter.use("/workspaces", workspaceRouter);
