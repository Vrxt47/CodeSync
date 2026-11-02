import type { z } from "zod";
import type {
  registerUserSchema,
  loginUserSchema,
  userIdParamSchema,
  updateUserSchema,
} from "./user.schema";

export type RegisterUserInput = z.infer<typeof registerUserSchema>;
export type LoginUserInput = z.infer<typeof loginUserSchema>;
export type UserIdParam = z.infer<typeof userIdParamSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
}
