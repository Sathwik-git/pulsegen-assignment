import { Request, Response, NextFunction } from "express";
import { User } from "../models";
import config from "../config";
import { Server as SocketIOServer } from "socket.io";

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

    // Admin sees only their own organisation users (multi-tenant)
    if (!req.user!.organisation) {
      // No org — only return themselves
      filter._id = req.user!._id;
    } else {
      filter.organisation = req.user!.organisation;
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

    // Only allow updating users in the same organisation
    if (!req.user!.organisation) {
      res.status(403).json({
        success: false,
        message: "You must belong to an organisation to manage users.",
      });
      return;
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, organisation: req.user!.organisation },
      { role },
      { new: true, runValidators: true },
    ).select("-password");

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found in your organisation.",
      });
      return;
    }

    // Notify the affected user in real-time via Socket.IO
    const io: SocketIOServer = req.app.get("io");
    if (io) {
      io.to(`user:${user._id.toString()}`).emit("role:updated", {
        role: user.role,
        name: user.name,
        email: user.email,
        _id: user._id,
        isActive: user.isActive,
        organisation: user.organisation,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
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

    // Only allow toggling users in the same organisation
    if (!req.user!.organisation) {
      res.status(403).json({
        success: false,
        message: "You must belong to an organisation to manage users.",
      });
      return;
    }

    const user = await User.findOne({
      _id: req.params.id,
      organisation: req.user!.organisation,
    });
    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found in your organisation.",
      });
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
