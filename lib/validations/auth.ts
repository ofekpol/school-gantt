import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1).max(256),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const ResetPasswordSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
