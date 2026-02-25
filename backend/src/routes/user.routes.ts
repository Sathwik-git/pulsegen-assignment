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

export const updateRoleSchema = z.object({
  role: z.enum(
    [config.roles.VIEWER, config.roles.EDITOR, config.roles.ADMIN] as [
      string,
      ...string[],
    ],
    { error: "Invalid role" },
  ),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

router.use(auth, adminOnly);

router.get("/", listUsers);

router.put("/:id/role", validate(updateRoleSchema), updateUserRole);

router.patch("/:id/status", toggleUserStatus);

export default router;
