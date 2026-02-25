import { Request, Response, NextFunction } from "express";
import { User } from "../models";
import config from "../config";


export const listUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const role = req.query.role as string | undefined;
    const organisation = req.query.organisation as string | undefined;

    const filter: Record<string, unknown> = {};
    if (role) filter.role = role;

    // Admin sees their own organisation users (multi-tenant)
    if (req.user!.role !== config.roles.ADMIN) {
      filter.organisation = req.user!.organisation;
    } else if (organisation) {
      filter.organisation = organisation;
    }

    const users = await User.find(filter)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};


export const updateUserRole = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { role } = req.body;

    // Prevent self-demotion
    if (req.params.id === req.user!.id.toString()) {
      res.status(400).json({
        success: false,
        message: "Cannot change your own role.",
      });
      return;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true },
    ).select("-password");

    if (!user) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    res.json({
      success: true,
      message: `User role updated to ${role}.`,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};


export const toggleUserStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (req.params.id === req.user!.id.toString()) {
      res.status(400).json({
        success: false,
        message: "Cannot deactivate your own account.",
      });
      return;
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found." });
      return;
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${user.isActive ? "activated" : "deactivated"}.`,
      data: {
        user: { id: user._id, name: user.name, isActive: user.isActive },
      },
    });
  } catch (error) {
    next(error);
  }
};
