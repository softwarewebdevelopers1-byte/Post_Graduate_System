import mongoose, { Model } from "mongoose";

export interface INotification {
  recipientId: string;
  recipientRole: string;
  type: string;
  title: string;
  message: string;
  studentId?: string;
  studentName?: string;
  studentNumber?: string;
  reportId?: string;
  read: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const NotificationSchema = new mongoose.Schema<INotification>(
  {
    recipientId: {
      type: String,
      required: true,
      index: true,
    },
    recipientRole: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    studentId: {
      type: String,
      default: "",
    },
    studentName: {
      type: String,
      default: "",
    },
    studentNumber: {
      type: String,
      default: "",
    },
    reportId: {
      type: String,
      default: "",
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export const NotificationModel =
  (mongoose.models.notification as Model<INotification>) ||
  mongoose.model<INotification>("notification", NotificationSchema);
