import mongoose, { Model } from "mongoose";
interface Bookings {
  owner: string;
  ownerId: string;
  slotId?: mongoose.Schema.Types.ObjectId | string | null;
  additionalNotes?: string;
  preferredDate: string;
  preferredTime: string;
  presentationType: string;
  venue: string;
  status: string;
  createdAt?: Date;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  cancelledBy: mongoose.Schema.Types.ObjectId | null;
  reminderRequestedAt: Date | null;
  reminderMessage: string | null;
}
let BookingSchema = new mongoose.Schema<Bookings>(
  {
    owner: String,
    ownerId: String,
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SeminarSlot",
      default: null,
    },
    additionalNotes: {
      type: String,
      required: false,
    },
    preferredDate: String,
    preferredTime: String,
    presentationType: String,
    venue: String,
    status: {
      type: String,
      default: "pending",
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      default: null,
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reminderRequestedAt: {
      type: Date,
      default: null,
    },
    reminderMessage: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true },
);
export let bookingsModel =
  (mongoose.models.bookings as Model<Bookings>) ||
  mongoose.model<Bookings>("bookings", BookingSchema);
