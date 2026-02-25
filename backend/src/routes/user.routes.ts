import { Router } from "express";
import { z } from "zod";
import {
  listUsers,
  updateUserRole,
  toggleUserStatus,
} from "../controllers/user.controller";
import { auth, adminOnly, validate } from "../middleware";
import config from "../config";

const router = Router();

// Zod schema for role update
export const updateRoleSchema = z.object({
  role: z.enum(
    [config.roles.VIEWER, config.roles.EDITOR, config.roles.ADMIN] as [
      string,
      ...string[],
    ],
    { required_error: "Invalid role" },
  ),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

// All routes require authentication + admin role
router.use(auth, adminOnly);

// GET /api/users
router.get("/", listUsers);

// PUT /api/users/:id/role
router.put("/:id/role", validate(updateRoleSchema), updateUserRole);

// PATCH /api/users/:id/status
router.patch("/:id/status", toggleUserStatus);

export default router;
