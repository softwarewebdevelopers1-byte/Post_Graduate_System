import mongoose, { Schema, Model } from "mongoose";

// TypeScript Interface
export interface IUser {
  fullName: string;
  userNumber: string;
  password: string;
  role: string;
  isVerified: boolean;
  programme: string;
  department: string;
  status: string;
  stage?: string;
  atRisk?: boolean;
  notes?: string[];
  financialClearance?: boolean;
  deferralInfo?: {
    date?: Date;
    plannedResumption?: string; // Semester format
    actualResumption?: Date;
    reason?: string;
    stageAtDeferral?: string;
  };
  supervisors?: {
    sup1?: string;
    sup2?: string;
    sup3?: string;
  };
  documents?: {
    conceptNote?: string; // status: "pending", "approved", "rejected"
    proposal?: string;
    proposalScore?: number;
    thesis?: string;
    nacosti?: string;
    journalPaper?: string;
    mentorship?: string;
  };
  quarterlyReports?: Array<{
    id: string;
    quarter: number;
    year: number;
    status: string; // "pending", "approved", "returned"
    comment?: string;
    submittedAt?: Date;
    approvals: {
      sup1: string;
      sup2: string;
      sup3: string;
      dean: string;
      finance: string;
    };
    deadline?: Date;
  }>;
  automation?: {
    suggestedStage?: string;
    aiFlags?: string[];
    lastAutoCheck?: Date;
    atRiskScore?: number; // 0-100
  };
  corrections?: Array<{
    id: string;
    text: string;
    source: string; // "AI", "Presentation"
    completed: boolean;
    validation?: string;
    updatedAt?: Date;
  }>;
  assignmentStatus?: {
    sup1?: string; // "pending", "accepted", "rejected"
    sup2?: string;
    sup3?: string;
  };
}

//  Schema
const UserSchema = new Schema<IUser>({
  fullName: {
    type: String,
    required: true,
    trim: true,
  },

  userNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  password: {
    default: "student123",
    type: String,
    minlength: 6,
  },

  role: {
    type: String,
    default: "student",
  },

  isVerified: {
    type: Boolean,
    default: false,
  },
  programme: {
    type: String,
    required: true,
    lowercase: true,
  },
  department: {
    type: String,
    required: true,
    lowercase: true,
  },
  status: {
    type: String,
    default: "Active",
  },
  stage: {
    type: String,
    default: "Coursework",
  },
  atRisk: {
    type: Boolean,
    default: false,
  },
  notes: {
    type: [String],
    default: [],
  },
  financialClearance: {
    type: Boolean,
    default: false,
  },
  deferralInfo: {
    date: Date,
    plannedResumption: String,
    actualResumption: Date,
    reason: String,
    stageAtDeferral: String,
  },
  supervisors: {
    sup1: { type: String, default: "" },
    sup2: { type: String, default: "" },
    sup3: { type: String, default: "" },
  },
  documents: {
    conceptNote: { type: String, default: "pending" },
    proposal: { type: String, default: "pending" },
    proposalScore: { type: Number, default: 0 },
    thesis: { type: String, default: "pending" },
    nacosti: { type: String, default: "pending" },
    journalPaper: { type: String, default: "pending" },
    mentorship: { type: String, default: "pending" },
  },
  quarterlyReports: [{
    id: String,
    quarter: Number,
    year: Number,
    status: { type: String, default: "pending" },
    comment: String,
    submittedAt: { type: Date, default: Date.now },
    approvals: {
      sup1: { type: String, default: "pending" },
      sup2: { type: String, default: "pending" },
      sup3: { type: String, default: "pending" },
      dean: { type: String, default: "pending" },
      finance: { type: String, default: "pending" },
    },
    deadline: Date,
  }],
  automation: {
    suggestedStage: { type: String, default: "" },
    aiFlags: { type: [String], default: [] },
    lastAutoCheck: { type: Date, default: Date.now },
    atRiskScore: { type: Number, default: 0 },
  },
  corrections: [{
    id: String,
    text: String,
    source: String,
    completed: { type: Boolean, default: false },
    validation: String,
    updatedAt: { type: Date, default: Date.now },
  }],
  assignmentStatus: {
    sup1: { type: String, default: "pending" },
    sup2: { type: String, default: "pending" },
    sup3: { type: String, default: "pending" },
  },
}, { timestamps: true });

//  Model
export const UserModel =
  (mongoose.models.user as Model<IUser>) ||
  mongoose.model<IUser>("user", UserSchema);
