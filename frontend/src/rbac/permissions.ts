/**
 * Frontend RBAC - Permissions & Role Definitions
 * Mirrors backend role hierarchy: admin > editor > viewer
 */
import type { UserRole } from "../types";

/**
 * All granular permissions used across the frontend.
 */
export type Permission =
  | "video:upload"
  | "video:edit"
  | "video:delete"
  | "video:reprocess"
  | "video:view"
  | "video:list"
  | "user:list"
  | "user:update-role"
  | "user:toggle-status"
  | "admin:access";

/**
 * Role → permissions mapping (matches backend RBAC middleware).
 */
const rolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    "video:upload",
    "video:edit",
    "video:delete",
    "video:reprocess",
    "video:view",
    "video:list",
    "user:list",
    "user:update-role",
    "user:toggle-status",
    "admin:access",
  ],
  editor: [
    "video:upload",
    "video:edit",
    "video:delete",
    "video:reprocess",
    "video:view",
    "video:list",
  ],
  viewer: ["video:view", "video:list"],
};

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

/**
 * Check if a role has ALL of the specified permissions.
 */
export function hasAllPermissions(
  role: UserRole,
  permissions: Permission[],
): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

/**
 * Check if a role has ANY of the specified permissions.
 */
export function hasAnyPermission(
  role: UserRole,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/**
 * Role display metadata.
 */
export const roleConfig: Record<
  UserRole,
  { label: string; color: string; bgColor: string; description: string }
> = {
  admin: {
    label: "Admin",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
    description: "Full access to all features",
  },
  editor: {
    label: "Editor",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    description: "Can upload, edit, and manage videos",
  },
  viewer: {
    label: "Viewer",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    description: "Can view videos only",
  },
};
