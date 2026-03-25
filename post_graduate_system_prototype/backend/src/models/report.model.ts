import mongoose, { Model } from "mongoose";

// Define status enum as a type and constant
export const ReportStatus = {
  PENDING: "pending",
  UNDER_REVIEW: "under_review",
  APPROVED: "approved",
  REJECTED: "rejected",
} as const;

export type ReportStatusType = (typeof ReportStatus)[keyof typeof ReportStatus];

interface ReportsStructure {
  owner?: string;
  ownerId?: mongoose.Types.ObjectId;
  reportUrl: string;
  reportingQuarter: string;
  quarter?: number; // Add quarter field
  year?: number; // Add year field
  researchActivities: string;
  challengesEncountered: string;
  plannedActivities: string;
  status: ReportStatusType;
}

let ReportSchema = new mongoose.Schema<ReportsStructure>(
  {
    owner: {
      type: String,
      default: null,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      unique:false
    },
    reportUrl: {
      type: String,
    },
    reportingQuarter: {
      type: String,
      required: true,
    },
    quarter: {
      type: Number,
      default: null,
    },
    year: {
      type: Number,
      default: null,
    },
    researchActivities: {
      type: String,
      required: true,
    },
    challengesEncountered: {
      type: String,
      default: "",
    },
    plannedActivities: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ReportStatus),
      default: ReportStatus.PENDING,
    },
  },
  {
    timestamps: true,
  },
);

export let ReportModel =
  (mongoose.models.reports as Model<ReportsStructure>) ||
  mongoose.model<ReportsStructure>("reports", ReportSchema);
