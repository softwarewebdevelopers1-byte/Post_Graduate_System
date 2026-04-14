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
  year?: string;
  mentor?: string;
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
  deferralRequest?: {
    type?: "deferral" | "resumption";
    status?: "pending" | "approved" | "rejected";
    submittedAt?: Date;
    reviewedAt?: Date;
    reason?: string;
    plannedResumption?: string;
    reviewComment?: string;
    reviewedBy?: string;
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
    progressSummary?: string;
    objectivesAchieved?: string;
    challengesAndMitigation?: string;
    nextQuarterPlan?: string;
    approvals: {
      sup1: string;
      sup2: string;
      sup3: string;
      dean: string;
      finance: string;
    };
    reviewTrail?: Array<{
      role: string;
      actor: string;
      action: string;
      comment?: string;
      at?: Date;
    }>;
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
  complianceUploads?: Array<{
    id: string;
    type: string;
    title: string;
    url?: string;
    storagePath?: string;
    bucket?: string;
    mimeType?: string;
    fileSize?: number;
    note?: string;
    submittedAt?: Date;
  }>;
  thesisSubmissionIntent?: {
    thesisTitle?: string;
    submissionCategory?: string;
    targetSubmissionDate?: string;
    phoneNumber?: string;
    email?: string;
    supervisorName?: string;
    coSupervisorName?: string;
    notes?: string;
    submittedAt?: Date;
    updatedAt?: Date;
    status?: string;
  };
  conceptNoteWorkflow?: {
    subStage: string; // "slot_booking" | "awaiting_panel" | "document_upload" | "panel_review" | "completed"
    bookingRequestedAt?: Date;
    preferredDate?: string;
    preferredTime?: string;
    venue?: string;
    additionalNotes?: string;
    panelScheduledDate?: Date;
    panelMembers?: string[];
    uploadedFileUrl?: string;
    uploadedFileName?: string;
    uploadedAt?: Date;
    panelScore?: number;
    panelFeedback?: string;
    panelDecision?: string; // "pass" | "corrections" | "reject"
    correctionsList?: string[];
    reviewedAt?: Date;
    completedAt?: Date;
    attemptCount?: number;
  };
}

//  Schema
const ComplianceUploadSchema = new Schema(
  {
    id: { type: String },
    type: { type: String },
    title: { type: String },
    url: { type: String },
    storagePath: { type: String },
    bucket: { type: String },
    mimeType: { type: String },
    fileSize: { type: Number },
    note: { type: String },
    submittedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

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
  year: {
    type: String,
    default: "",
    trim: true,
  },
  mentor: {
    type: String,
    default: "",
    trim: true,
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
  deferralRequest: {
    type: {
      type: String,
      enum: ["deferral", "resumption"],
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: null,
    },
    submittedAt: Date,
    reviewedAt: Date,
    reason: String,
    plannedResumption: String,
    reviewComment: String,
    reviewedBy: String,
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
    progressSummary: { type: String, default: "" },
    objectivesAchieved: { type: String, default: "" },
    challengesAndMitigation: { type: String, default: "" },
    nextQuarterPlan: { type: String, default: "" },
    approvals: {
      sup1: { type: String, default: "pending" },
      sup2: { type: String, default: "pending" },
      sup3: { type: String, default: "pending" },
      dean: { type: String, default: "pending" },
      finance: { type: String, default: "pending" },
    },
    reviewTrail: [{
      role: String,
      actor: String,
      action: String,
      comment: String,
      at: { type: Date, default: Date.now },
    }],
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
  complianceUploads: {
    type: [ComplianceUploadSchema],
    default: [],
  },
  thesisSubmissionIntent: {
    thesisTitle: { type: String, default: "" },
    submissionCategory: { type: String, default: "Initial Submission" },
    targetSubmissionDate: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    email: { type: String, default: "" },
    supervisorName: { type: String, default: "" },
    coSupervisorName: { type: String, default: "" },
    notes: { type: String, default: "" },
    submittedAt: Date,
    updatedAt: Date,
    status: { type: String, default: "draft" },
  },
  conceptNoteWorkflow: {
    subStage: { type: String, default: "slot_booking" },
    bookingRequestedAt: Date,
    preferredDate: String,
    preferredTime: String,
    venue: String,
    additionalNotes: String,
    panelScheduledDate: Date,
    panelMembers: { type: [String], default: [] },
    uploadedFileUrl: String,
    uploadedFileName: String,
    uploadedAt: Date,
    panelScore: { type: Number, default: 0 },
    panelFeedback: String,
    panelDecision: String,
    correctionsList: { type: [String], default: [] },
    reviewedAt: Date,
    completedAt: Date,
    attemptCount: { type: Number, default: 0 },
  },
}, { timestamps: true });

//  Model
export const UserModel =
  (mongoose.models.user as Model<IUser>) ||
  mongoose.model<IUser>("user", UserSchema);
