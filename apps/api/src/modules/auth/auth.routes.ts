import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AuthController } from "./auth.controller";
import { registerSchema, loginSchema } from "./auth.schema";
import { validate } from "../../middleware/validate.middleware";
import { authMiddleware } from "../../middleware/auth.middleware";

export const authRouter = Router();

// Stricter rate limiting for authentication endpoints to prevent brute-force attacks
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication requests, please try again later.",
    code: "RATE_LIMIT_EXCEEDED",
  },
  // Skip rate limiting in test environment
  skip: () => process.env.NODE_ENV === "test",
});

// 1. POST /api/auth/register
authRouter.post(
  "/register",
  authRateLimiter,
  validate({ body: registerSchema }),
  AuthController.register
);

// 2. POST /api/auth/login
authRouter.post("/login", authRateLimiter, validate({ body: loginSchema }), AuthController.login);

// 3. POST /api/auth/refresh
authRouter.post("/refresh", authRateLimiter, AuthController.refresh);

// 4. POST /api/auth/logout
authRouter.post("/logout", AuthController.logout);

// 5. GET /api/auth/me (Protected)
authRouter.get("/me", authMiddleware, AuthController.me);
