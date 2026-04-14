import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { UserModel } from "../models/user.model.js";

export const UserSignUpRouter = Router();

UserSignUpRouter.post(
  "/",
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.body) {
        res.status(400).json({ message: "body is empty" });
        return;
      }
      const { fullName, userNumber, password, programme, role, department, year, mentor, supervisors } = req.body;

      // 1. Validate required fields
      if (!fullName || !userNumber || !password || !programme || !department) {
        res.status(400).json({ message: "All fields are required" });
        return;
      }

      // 2. Check if user already exists
      const existingUser = await UserModel.findOne({ userNumber: userNumber });
      if (existingUser) {
        res.status(409).json({ message: "userNumber already registered" });
        return;
      }

      // 3. Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // 4. Create user
      const newUser = await UserModel.create({
        fullName,
        userNumber,
        password: hashedPassword,
        programme,
        department,
        year: year || "",
        mentor: mentor || "",
        role: role || "student",
        isVerified: false,
        supervisors: {
          sup1: supervisors?.sup1 || "",
          sup2: supervisors?.sup2 || "",
          sup3: supervisors?.sup3 || "",
        },
      });

      // 5. Respond with success
      res.status(201).json({
        message: "User registered successfully",
        user: {
          id: newUser._id,
          fullName: newUser.fullName,
          userNumber: newUser.userNumber,
          role: newUser.role,
          programme: newUser.programme,
          year: newUser.year,
          mentor: newUser.mentor,
          isVerified: newUser.isVerified,
        },
      });
      return;
    } catch (error) {
      console.error("Sign up error:", error);
      res.status(500).json({ message: "Server error" });
      return;
    }
  },
);
