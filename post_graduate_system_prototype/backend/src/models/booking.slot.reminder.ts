import mongoose, { Model } from "mongoose";

interface BookingSlotReminder {
  ownerId: string;
  owner: string;
  fullName: string;
  department: string;
  programme: string;
  message: string;
  status: string;
  createdAt?: Date;
  expiresAt: Date;
}

const BookingSlotReminderSchema = new mongoose.Schema<BookingSlotReminder>(
  {
    ownerId: {
      type: String,
      required: true,
      index: true,
    },
    owner: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    department: {
      type: String,
      required: true,
    },
    programme: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      default: "pending",
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

export const bookingSlotReminderModel =
  (mongoose.models.bookingSlotReminder as Model<BookingSlotReminder>) ||
  mongoose.model<BookingSlotReminder>(
    "bookingSlotReminder",
    BookingSlotReminderSchema,
  );
