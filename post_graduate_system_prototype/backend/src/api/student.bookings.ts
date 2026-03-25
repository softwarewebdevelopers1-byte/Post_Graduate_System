import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { handleIsLogged } from "../auth/is_logged.js";
import { bookingsModel } from "../models/student.bookings.js";
import { UserModel } from "../models/user.model.js";
export let studentBookings = Router();

studentBookings.post(
  "/presentations/request",
  async (req: Request, res: Response) => {
    let accessToken = req.cookies?.userToken;
    const jwtSecret = process.env.JWT_SECRET;
    if (!accessToken || !jwtSecret) {
      res.status(401).json({ message: "Unauthorized access" });
      return;
    }
    if (!req.body) {
      res.status(400).json({ message: "Invalid data" });
      return;
    }
    let {
      additionalNotes,
      preferredDate,
      preferredTime,
      presentationType,
      venue,
    } = req.body;
    if (!preferredDate || !preferredTime || !presentationType || !venue) {
      res.status(400).json({ message: "Invalid inputs" });
      return;
    }
    let load = jwt.verify(
      accessToken,
      jwtSecret as string,
      async (err: any, load: any) => {
        if (err) {
          res.status(401).json({ message: "Unauthorized" });
          return;
        }
        try {
          // Check if there is already a pending booking
          const pendingBooking = await bookingsModel.findOne({
            ownerId: load.id,
            status: "pending",
          });

          if (pendingBooking) {
            res.status(400).json({
              success: false,
              message:
                "You already have a pending booking. Please wait for approval or complete the current booking.",
              existingBooking: pendingBooking,
            });
            return;
          }

          // Create new booking
          const newBooking = await bookingsModel.create({
            owner: load.userNumber,
            ownerId: load.id,
            additionalNotes: additionalNotes,
            preferredDate: preferredDate,
            preferredTime: preferredTime,
            presentationType: presentationType,
            venue: venue,
            status: "pending",
          });

          res.status(200).json({
            success: true,
            message: "Booking request submitted successfully",
            booking: newBooking,
          });
        } catch (error) {
          res.status(500).json({ success: false, message: "Server error" });
          console.log(error);
        }
      },
    );
  },
);

// GET all bookings for a student
studentBookings.get(
  "/presentations/my-bookings",
  async (req: Request, res: Response) => {
    let accessToken = req.cookies?.userToken;
    const jwtSecret = process.env.JWT_SECRET;
    if (!accessToken || !jwtSecret) {
      res.status(401).json({ message: "Unauthorized access" });
      return;
    }

    jwt.verify(
      accessToken,
      jwtSecret as string,
      async (err: any, load: any) => {
        if (err) {
          res.status(401).json({ message: "Unauthorized" });
          return;
        }
        try {
          const bookings = await bookingsModel
            .find({ ownerId: load.id })
            .sort({ createdAt: -1 });
          res.status(200).json({
            success: true,
            bookings: bookings,
            hasPendingBooking: bookings.some(
              (b: any) => b.status === "pending",
            ),
          });
        } catch (error) {
          res.status(500).json({ success: false, message: "Server error" });
          console.log(error);
        }
      },
    );
  },
);
// @access  Private (Director/Admin/Chair)
studentBookings.get(
  "/presentations/booked-students",
  async (req: Request, res: Response) => {
    const accessToken = req.cookies?.userToken;
    const jwtSecret = process.env.JWT_SECRET;

    if (!accessToken || !jwtSecret) {
      res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
      return;
    }

    jwt.verify(
      accessToken,
      jwtSecret as string,
      async (err: any, load: any) => {
        if (err) {
          res.status(401).json({
            success: false,
            message: "Invalid or expired token",
          });
          return;
        }

        try {
          const allowedRoles = ["director", "admin", "chair"];
          if (!allowedRoles.includes(load.role)) {
            res.status(403).json({
              success: false,
              message: "Access denied",
            });
            return;
          }

          const bookings = await bookingsModel
            .find()
            .sort({ createdAt: -1 })
            .lean();

          const ownerIds = [
            ...new Set(
              bookings.map((booking) => booking.ownerId).filter(Boolean),
            ),
          ];

          const students = await UserModel.find({
            _id: { $in: ownerIds },
            role: "student",
          })
            .select("fullName userNumber stage programme department status")
            .lean();

          const studentMap = new Map(
            students.map((student) => [student._id.toString(), student]),
          );

          const bookedStudents = bookings
            .map((booking) => {
              const student = studentMap.get(booking.ownerId);
              if (!student) return null;

              return {
                bookingId: booking._id,
                studentId: student._id,
                name: student.fullName,
                regNo: student.userNumber,
                stage: student.stage || "Coursework",
                programme: student.programme,
                department: student.department,
                studentStatus: student.status,
                bookingStatus: booking.status,
                preferredDate: booking.preferredDate,
                preferredTime: booking.preferredTime,
                presentationType: booking.presentationType,
                venue: booking.venue,
                additionalNotes: booking.additionalNotes || "",
                createdAt: booking.createdAt,
                cancelledAt: booking.cancelledAt,
                cancellationReason: booking.cancellationReason,
              };
            })
            .filter(Boolean);

          res.status(200).json({
            success: true,
            count: bookedStudents.length,
            students: bookedStudents,
          });
        } catch (error) {
          console.error("Error fetching booked students:", error);
          res.status(500).json({
            success: false,
            message: "Server error",
          });
        }
      },
    );
  },
);
// GET booking status for a specific booking
studentBookings.get(
  "/presentations/:bookingId",
  async (req: Request, res: Response) => {
    let accessToken = req.cookies?.userToken;
    const jwtSecret = process.env.JWT_SECRET;
    if (!accessToken || !jwtSecret) {
      res.status(401).json({ message: "Unauthorized access" });
      return;
    }

    jwt.verify(
      accessToken,
      jwtSecret as string,
      async (err: any, load: any) => {
        if (err) {
          res.status(401).json({ message: "Unauthorized" });
          return;
        }
        try {
          const booking = await bookingsModel.findOne({
            _id: req.params.bookingId,
            ownerId: load.id,
          });

          if (!booking) {
            res
              .status(404)
              .json({ success: false, message: "Booking not found" });
            return;
          }

          res.status(200).json({
            success: true,
            booking: booking,
          });
        } catch (error) {
          res.status(500).json({ success: false, message: "Server error" });
          console.log(error);
        }
      },
    );
  },
);

// CANCEL a booking
// @route   PUT /api/presentations/:bookingId/cancel
// @desc    Cancel a pending booking
// @access  Private (Student can cancel their own pending bookings)
studentBookings.put(
  "/presentations/:bookingId/cancel",
  async (req: Request, res: Response) => {
    let accessToken = req.cookies?.userToken;
    const jwtSecret = process.env.JWT_SECRET;

    if (!accessToken || !jwtSecret) {
      res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
      return;
    }

    jwt.verify(
      accessToken,
      jwtSecret as string,
      async (err: any, load: any) => {
        if (err) {
          res.status(401).json({
            success: false,
            message: "Invalid or expired token",
          });
          return;
        }

        try {
          const { bookingId } = req.params;

          // Find the booking
          const booking = await bookingsModel.findOne({
            _id: bookingId,
            ownerId: load.id,
          });
          console.log(booking);

          if (!booking) {
            res.status(404).json({
              success: false,
              message: "Booking not found",
            });
            return;
          }

          // Check if booking can be cancelled (only pending bookings can be cancelled)
          if (booking.status !== "pending") {
            res.status(400).json({
              success: false,
              message: `Cannot cancel booking with status: ${booking.status}. Only pending bookings can be cancelled.`,
              currentStatus: booking.status,
            });
            return;
          }

          // Update booking status to cancelled
          booking.status = "cancelled";
          booking.cancelledAt = new Date();
          booking.cancellationReason =
            req.body.reason || "Cancelled by student";

          await booking.save();

          res.status(200).json({
            success: true,
            message: "Booking cancelled successfully",
            booking: {
              id: booking._id,
              status: booking.status,
              cancelledAt: booking.cancelledAt,
              cancellationReason: booking.cancellationReason,
            },
          });
        } catch (error) {
          console.error("Error cancelling booking:", error);
          res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
          });
        }
      },
    );
  },
);

// GET students who have booked presentations
// @route   GET /api/presentations/booked-students
// @desc    Return booked presentation requests enriched with student details

// GET all bookings for admin
studentBookings.get(
  "/presentations/admin/all",
  async (req: Request, res: Response) => {
    try {
      const bookings = await bookingsModel.find().sort({ createdAt: -1 });
      res.status(200).json({ success: true, bookings });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// Optional: Admin route to cancel any booking
// @route   PUT /api/presentations/admin/:bookingId/cancel
// @desc    Admin can cancel any booking (for administrative purposes)
// @access  Private (Admin only)
studentBookings.put(
  "/presentations/admin/:bookingId/cancel",
  async (req: Request, res: Response) => {
    let accessToken = req.cookies?.userToken;
    const jwtSecret = process.env.JWT_SECRET;

    if (!accessToken || !jwtSecret) {
      res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
      return;
    }

    jwt.verify(
      accessToken,
      jwtSecret as string,
      async (err: any, load: any) => {
        if (err) {
          res.status(401).json({
            success: false,
            message: "Invalid or expired token",
          });
          return;
        }

        // Check if user has admin role
        // You'll need to fetch the user from database to verify role
        // This is a simplified version - you should check the user's role from the database
        try {
          // Assuming you have a User model to check roles
          // const user = await UserModel.findById(load.id);
          // if (user.role !== 'admin' && user.role !== 'chair') {
          //   return res.status(403).json({ success: false, message: "Admin access required" });
          // }

          const { bookingId } = req.params;
          const { reason } = req.body;

          const booking = await bookingsModel.findById(bookingId);

          if (!booking) {
            res.status(404).json({
              success: false,
              message: "Booking not found",
            });
            return;
          }

          // Admin can cancel any booking regardless of status
          const previousStatus = booking.status;
          booking.status = "cancelled";
          booking.cancelledAt = new Date();
          booking.cancellationReason =
            reason || `Cancelled by admin (Previous status: ${previousStatus})`;
          booking.cancelledBy = load.id;

          await booking.save();

          res.status(200).json({
            success: true,
            message: "Booking cancelled successfully by admin",
            booking: {
              id: booking._id,
              previousStatus: previousStatus,
              status: booking.status,
              cancelledAt: booking.cancelledAt,
              cancellationReason: booking.cancellationReason,
            },
          });
        } catch (error) {
          console.error("Error cancelling booking by admin:", error);
          res.status(500).json({
            success: false,
            message: "Server error. Please try again later.",
          });
        }
      },
    );
  },
);
