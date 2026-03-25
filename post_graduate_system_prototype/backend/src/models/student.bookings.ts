import mongoose, { Model } from "mongoose";
interface Bookings {
  owner: string;
  ownerId: string;
  additionalNotes?: string;
  preferredDate: string;
  preferredTime: string;
  presentationType: string;
  venue: string;
  status: string;
  createdAt?: Date;
  cancelledAt: Date;
  cancellationReason: string;
  cancelledBy: mongoose.Schema.Types.ObjectId;
}
let BookingSchema = new mongoose.Schema<Bookings>(
  {
    owner: String,
    ownerId: String,
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
  },
  { timestamps: true },
);
export let bookingsModel =
  (mongoose.models.bookings as Model<Bookings>) ||
  mongoose.model<Bookings>("bookings", BookingSchema);
