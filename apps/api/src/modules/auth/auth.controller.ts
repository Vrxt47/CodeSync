import type { Request, Response, NextFunction, CookieOptions } from "express";
import { AuthService, ConcurrentRefreshError } from "./auth.service";
import { REFRESH_TOKEN_COOKIE } from "./auth.schema";
import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";

function getCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
  };
}

function getClearCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

export class AuthController {
  public static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.register(req.body);
      res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, getCookieOptions());

      res.status(201).json({
        success: true,
        message: "Registration successful",
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.login(req.body);
      res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, getCookieOptions());

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (!rawRefreshToken) {
      res.clearCookie(REFRESH_TOKEN_COOKIE, getClearCookieOptions());
      res.status(401).json({
        success: false,
        message: "Refresh token is missing",
        code: "REFRESH_TOKEN_MISSING",
      });
      return;
    }

    try {
      const result = await AuthService.refreshSession(rawRefreshToken);
      res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, getCookieOptions());

      res.status(200).json({
        success: true,
        message: "Session refreshed successfully",
        data: {
          user: result.user,
          accessToken: result.accessToken,
        },
      });
    } catch (error) {
      if (!(error instanceof ConcurrentRefreshError)) {
        res.clearCookie(REFRESH_TOKEN_COOKIE, getClearCookieOptions());
      }
      next(error);
    }
  }

  public static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
      await AuthService.logout(rawRefreshToken);
      res.clearCookie(REFRESH_TOKEN_COOKIE, getClearCookieOptions());

      res.status(200).json({
        success: true,
        message: "Logout successful",
      });
    } catch (error) {
      res.clearCookie(REFRESH_TOKEN_COOKIE, getClearCookieOptions());
      next(error);
    }
  }

  public static async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user || !req.user.id) {
        throw new AppError("Unauthenticated request", 401, "UNAUTHENTICATED");
      }

      const user = await AuthService.getCurrentUser(req.user.id);

      res.status(200).json({
        success: true,
        data: {
          user,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
