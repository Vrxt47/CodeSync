import type { z } from "zod";
import type { registerSchema, loginSchema } from "./auth.schema";

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  createdAt: Date;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}
