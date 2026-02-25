import { Router } from "express";
import { z } from "zod";
import { register, login, getMe } from "../controllers/auth.controller";
import { auth, validate } from "../middleware";

export const registerSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .trim()
    .min(1, "Name is required"),
  email: z.email("Valid email is required"),
  password: z
    .string({ error: "Password must be at least 6 characters" })
    .min(6, "Password must be at least 6 characters"),
  organisation: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.email("Valid email is required"),
  password: z
    .string({ error: "Password is required" })
    .min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

const router = Router();

router.post("/register", validate(registerSchema), register);

router.post("/login", validate(loginSchema), login);

router.get("/me", auth, getMe);

export default router;
