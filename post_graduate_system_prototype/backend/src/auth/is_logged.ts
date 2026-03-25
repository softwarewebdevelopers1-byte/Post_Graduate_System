import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import jwt from "jsonwebtoken";
import { UserModel } from "../models/user.model.js";

export let isLoggedRouter = Router();

export async function handleIsLogged(
  req: Request,
  res: Response,
  nxt: NextFunction,
) {
  try {
    // Get token from cookie
    const token = req.cookies?.userToken;

    // Get JWT secret from environment
    const jwtSecret = process.env.JWT_SECRET;

    // Check if token exists
    if (!token) {
      res.status(401).json({
        isLoggedIn: false,
        message: "No token provided",
      });
      return;
    }

    // Check if JWT secret exists
    if (!jwtSecret) {
      console.error("JWT_SECRET is not defined");
      res.status(500).json({
        isLoggedIn: false,
        message: "Server configuration error",
      });
      return;
    }

    // Verify the token
    jwt.verify(token, jwtSecret, async (err: any, decoded: any) => {
      if (err) {
        // Token is invalid or expired
        return res.status(401).json({
          isLoggedIn: false,
          message: "Invalid or expired token",
        });
      }

      try {
        // Fetch user from database using the ID from token
        const user = await UserModel.findById(decoded.id).select("-password");

        if (!user) {
          return res.status(401).json({
            isLoggedIn: false,
            message: "User not found",
          });
        }
        // Return user data
        if (user.role === "student") {
          return res.json({
            isLoggedIn: true,
            success: true,
            user: {
              id: user._id,
              fullName: user.fullName,
              programme: user.programme,
              department: user.department,
              userNumber: user.userNumber,
              role: user.role,
              supervisors: user.supervisors,
              token: token,
            },
          });
        }

        // Handle other roles
        return res.json({
          isLoggedIn: true,
          success: true,
          user: {
            id: user._id,
            fullName: user.fullName,
            role: user.role,
            token: token,
          },
        });
      } catch (dbError) {
        console.error("Database error:", dbError);
        return res.status(500).json({
          isLoggedIn: false,
          message: "Error fetching user data",
        });
      }
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      isLoggedIn: false,
      message: "Server error",
    });
  }
}
isLoggedRouter.post("/islogged", handleIsLogged);
isLoggedRouter.post("/is-logged", handleIsLogged);
isLoggedRouter.get("/is-logged", handleIsLogged);
