/**
 * usePermissions Hook
 * Provides role-based permission checks using the current authenticated user.
 */
import { useMemo, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  roleConfig,
  type Permission,
} from "./permissions";
import type { UserRole } from "../types";

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role as UserRole | undefined;

  /** Check a single permission */
  const can = useCallback(
    (permission: Permission): boolean => {
      if (!role) return false;
      return hasPermission(role, permission);
    },
    [role],
  );

  /** Check if user has ALL of the given permissions */
  const canAll = useCallback(
    (permissions: Permission[]): boolean => {
      if (!role) return false;
      return hasAllPermissions(role, permissions);
    },
    [role],
  );

  /** Check if user has ANY of the given permissions */
  const canAny = useCallback(
    (permissions: Permission[]): boolean => {
      if (!role) return false;
      return hasAnyPermission(role, permissions);
    },
    [role],
  );

  /** Check if user has a specific role */
  const isRole = useCallback(
    (targetRole: UserRole): boolean => role === targetRole,
    [role],
  );

  /** Check if user has any of the given roles */
  const isAnyRole = useCallback(
    (roles: UserRole[]): boolean => !!role && roles.includes(role),
    [role],
  );

  /** Role display info */
  const roleInfo = useMemo(() => (role ? roleConfig[role] : null), [role]);

  return {
    role,
    can,
    canAll,
    canAny,
    isRole,
    isAnyRole,
    roleInfo,
    isAdmin: role === "admin",
    isEditor: role === "editor",
    isViewer: role === "viewer",
  };
}
