import { z } from "zod";

export const registerUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name cannot exceed 100 characters"),
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .transform((val) => val.toLowerCase()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password cannot exceed 100 characters"),
  avatar: z.string().url("Avatar must be a valid URL").optional(),
});

export const loginUserSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .transform((val) => val.toLowerCase()),
  password: z.string().min(1, "Password is required"),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid("Invalid user ID"),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  avatar: z.string().url().optional().nullable(),
});
