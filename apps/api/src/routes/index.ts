import { Router } from "express";
import { healthRouter } from "./health.routes";
import { authRouter } from "../modules/auth/auth.routes";
import { workspaceRouter } from "../modules/workspaces/workspace.routes";
import { fileRouter } from "../modules/files/file.routes";
import { formattingRouter } from "../modules/formatting/formatting.routes";

export const apiRouter = Router();

// Register health check route
apiRouter.use("/health", healthRouter);

// Register authentication routes
apiRouter.use("/auth", authRouter);

// Register workspace routes
apiRouter.use("/workspaces", workspaceRouter);

// Register file routes
apiRouter.use("/files", fileRouter);

// Register code formatting route
apiRouter.use("/format", formattingRouter);
