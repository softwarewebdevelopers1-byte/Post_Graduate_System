import express from "express";
import cookies from "cookie-parser";
import type { Request, Response } from "express";
import { ConnectToDataBase } from "./Database/databaseConnect.js";
import dotenv from "dotenv";
import cors from "cors";
import { UserLoginRouter } from "./auth/login.js";
import { UserSignUpRouter } from "./auth/admin_signUp_User.js";
import { DirectorRouter } from "./api/director.js";
import { SupervisorRouter } from "./api/supervisor.js";
import { isLoggedRouter } from "./auth/is_logged.js";
import { studentBookings } from "./api/student.bookings.js";
import { SeminarSlotRouter } from "./api/seminar.slots.js";
import { reportRouter } from "./api/report.routes.js";
import { settingsRouter } from "./api/settings.routes.js";
dotenv.config();
let app = express();

// allowing cookies
app.use(cookies());
// Enable CORS before defining routes so preflight and responses include headers
app.use(
  cors({
    origin: [
      "http://localhost:5500",
      "https://post-graduate-system-prototype.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
// Note: explicit `app.options("*", ...)` can cause path parsing errors with this
// router/path-to-regexp version, so rely on the global `cors` middleware above.

app.use(express.json());
// login route
app.use("/api/user/login", UserLoginRouter);
// signup route
app.use("/api/user/signUp", UserSignUpRouter);
// director routes
app.use("/api", DirectorRouter);
// supervisor routes
app.use("/api", SupervisorRouter);
// checking if user is logged
app.use("/api", isLoggedRouter);
// handling student bookings
app.use("/api", studentBookings);
// handling seminar slots
app.use("/api/slots", SeminarSlotRouter);
// uploading quartely reports
app.use("/api", reportRouter);
// system settings
app.use("/api", settingsRouter);
// handling unknown route
app.use((req: Request, res: Response): void => {
  res.status(500).json({ message: "No route found" });
});
// connecting to database
ConnectToDataBase();

let port = process.env.LOCALPORT || process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server started at port ${port}`);
});
