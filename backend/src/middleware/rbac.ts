import { Request, Response, NextFunction } from "express";
import config from "../config";


const rbac = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${allowedRoles.join(", ")}. Your role: ${req.user.role}.`,
      });
      return;
    }

    next();
  };
};


const adminOnly = rbac(config.roles.ADMIN);
const editorAndAbove = rbac(config.roles.ADMIN, config.roles.EDITOR);
const allRoles = rbac(
  config.roles.ADMIN,
  config.roles.EDITOR,
  config.roles.VIEWER,
);

export { rbac, adminOnly, editorAndAbove, allRoles };
