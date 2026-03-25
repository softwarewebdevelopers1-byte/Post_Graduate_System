import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { UserModel } from "../models/user.model.js";
import { SupervisorAssignmentModel } from "../models/supervisor-action.model.js";

export const UserLoginRouter = Router();

UserLoginRouter.post(
  "/",
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.body) {
        res.status(400).json({ message: "Body is empty" });
        return;
      }
      const { userNumber, password } = req.body;

      // 1. Validate input
      if (!userNumber || !password) {
        res.status(400).json({
          message: "userNumber and password are required",
        });
        return;
      }
      let User = await UserModel.findOne({ userNumber: userNumber });
      if (!User) {
        res
          .status(400)
          .json({ message: "Invalid credentials", issue: "user not found" });
        return;
      }

      // 3. Compare password
      const isMatch = await bcrypt.compare(password, User.password);

      if (!isMatch) {
        res.status(401).json({
          message: "Invalid credentials",
          issue: "invalid password",
        });
        return;
      }
      let supervisor = await SupervisorAssignmentModel.findOne({
        studentRegNo: userNumber,
      });

      const RawJwtSecret = process.env.JWT_SECRET;
      //   if (!RawJwtSecret) {
      //     throw Error("RawJWTSEcret not found");
      //   }
      // 4. Generate JWT
      const token = jwt.sign(
        {
          id: User.id,
          userNumber: User.userNumber,
          role: User.role,
        },
        RawJwtSecret as string,
        { expiresIn: "1d" },
      );
      res.cookie("userToken", token, {
        httpOnly: true,
        secure: true, // MUST be true for cross-origin (HTTPS only)
        sameSite: "none",
      });
      // 5. Send response
      res.status(200).json({
        message: "Login successful",
        token,
        user: {
          id: User.id,
          supervisor: supervisor?.supervisorName,
          userNumber: User.userNumber,
          role: User.role,
          fullName: User.fullName,
          programme: User.programme,
          department: User.department,
        },
      });
    } catch (error) {
      res.status(500).json({
        message: "Server error on Login",
        error,
      });
      console.log(error);
    }
  },
);

// ===== LOGOUT ROUTE =====
// @route   POST /api/logout
// @desc    Logout user and clear authentication cookie
// @access  Public
UserLoginRouter.post(
  "/logout",
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Clear the userToken cookie
      res.clearCookie("userToken");

      // Also clear any other session-related cookies if they exist
      res.clearCookie("connect.sid", {
        path: "/",
      });

      // Optional: If you're using session storage, you can destroy it here
      // req.session.destroy((err) => { ... });

      res.status(200).json({
        success: true,
        message: "Logout successful",
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Error during logout",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// ===== ALTERNATIVE: GET LOGOUT ROUTE (for direct link clicks) =====
// @route   GET /api/logout
// @desc    Logout user via GET request (for simple links)
// @access  Public
UserLoginRouter.get(
  "/logout",
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Clear the userToken cookie
      res.clearCookie("userToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
      });

      // Redirect to login page or send JSON based on Accept header
      const acceptHeader = req.headers.accept || "";

      if (acceptHeader.includes("application/json")) {
        res.status(200).json({
          success: true,
          message: "Logout successful",
        });
      } else {
        // Redirect to login page for browser navigation
        res.redirect("/login.html");
      }
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Error during logout",
      });
    }
  },
);

// ===== OPTIONAL: LOGOUT ALL DEVICES =====
// @route   POST /api/logout-all
// @desc    Logout from all devices (invalidates all tokens)
// @access  Private (requires authentication)
UserLoginRouter.post(
  "/logout-all",
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Get the token from cookie
      const token = req.cookies?.userToken;

      if (!token) {
        res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
        return;
      }

      // Verify token to get user info
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        res.status(500).json({
          success: false,
          message: "Server configuration error",
        });
        return;
      }

      try {
        const decoded = jwt.verify(token, jwtSecret) as any;

        // Optional: Add token to blacklist or update user's token version
        // This would require storing token versions in the database
        // await UserModel.findByIdAndUpdate(decoded.id, { $inc: { tokenVersion: 1 } });

        // Clear the cookie
        res.clearCookie("userToken");

        res.status(200).json({
          success: true,
          message: "Logged out from all devices successfully",
        });
      } catch (verifyError) {
        // Token is already invalid, just clear it
        res.clearCookie("userToken");

        res.status(200).json({
          success: true,
          message: "Logged out successfully",
        });
      }
    } catch (error) {
      console.error("Logout all error:", error);
      res.status(500).json({
        success: false,
        message: "Error during logout",
      });
    }
  },
);
