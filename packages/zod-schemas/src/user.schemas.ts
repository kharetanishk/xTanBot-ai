import { z } from "zod";

export const CreateUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, "Must be E.164 format e.g. +1234567890")
    .optional(),
  timezone: z.string().default("Asia/Kolkata"),
});

/** Sign-up body (API): profile fields + password (hashed before persistence). */
export const RegisterUserSchema = CreateUserSchema.extend({
  password: z.string().min(8).max(200),
});

export const LoginUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().optional().nullable(),
  timezone: z.string().optional(),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
  timezone: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type CreateUser = z.infer<typeof CreateUserSchema>;
export type RegisterUser = z.infer<typeof RegisterUserSchema>;
export type LoginUser = z.infer<typeof LoginUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
export type User = z.infer<typeof UserSchema>;
