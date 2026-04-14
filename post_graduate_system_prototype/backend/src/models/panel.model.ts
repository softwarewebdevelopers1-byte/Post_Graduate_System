import mongoose, { Schema, Model, Document } from "mongoose";

// --- Panel Event ---
export interface IPanelEvent extends Document {
  studentId: mongoose.Types.ObjectId;
  stage: string;
  scheduledDate: Date;
  status: "pending" | "ongoing" | "completed";
  createdBy: mongoose.Types.ObjectId;
  transcriptUrl?: string;
  corrections: Array<{
    id: string;
    category: "critical" | "major" | "minor";
    description: string;
    status: "pending" | "fixed" | "approved";
    supervisorSignOff: boolean;
  }>;
  createdAt: Date;
}

const PanelEventSchema = new Schema<IPanelEvent>({
  studentId: { type: Schema.Types.ObjectId, ref: "user", required: true },
  stage: { type: String, required: true },
  scheduledDate: { type: Date, required: true },
  status: { type: String, enum: ["pending", "ongoing", "completed"], default: "pending" },
  createdBy: { type: Schema.Types.ObjectId, ref: "user", required: true },
  transcriptUrl: { type: String, required: false },
  corrections: [{
    category: { type: String, enum: ["critical", "major", "minor"] },
    description: String,
    status: { type: String, enum: ["pending", "fixed", "approved"], default: "pending" },
    supervisorSignOff: { type: Boolean, default: false }
  }],
  createdAt: { type: Date, default: Date.now }
});

export const PanelEventModel =
  (mongoose.models.PanelEvent as Model<IPanelEvent>) ||
  mongoose.model<IPanelEvent>("PanelEvent", PanelEventSchema);

// --- Panel Member ---
export interface IPanelMember extends Document {
  panelId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  email: string;
  type: "internal" | "external";
  role: "chair" | "member";
  hasSubmitted: boolean;
  assignedBy?: mongoose.Types.ObjectId;
  assignedAt: Date;
  status: "active" | "revoked";
  revokedAt?: Date;
  createdAt: Date;
}

const PanelMemberSchema = new Schema<IPanelMember>({
  panelId: { type: Schema.Types.ObjectId, ref: "PanelEvent", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "user", required: false },
  email: { type: String, required: true },
  type: { type: String, enum: ["internal", "external"], required: true },
  role: { type: String, enum: ["chair", "member"], default: "member" },
  hasSubmitted: { type: Boolean, default: false },
  assignedBy: { type: Schema.Types.ObjectId, ref: "user", required: false },
  assignedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ["active", "revoked"], default: "active" },
  revokedAt: { type: Date, required: false },
  createdAt: { type: Date, default: Date.now }
});

export const PanelMemberModel =
  (mongoose.models.PanelMember as Model<IPanelMember>) ||
  mongoose.model<IPanelMember>("PanelMember", PanelMemberSchema);

// --- Panel Evaluation ---
export interface IPanelEvaluation extends Document {
  panelMemberId: mongoose.Types.ObjectId;
  problemScore: number;
  objectivesScore: number;
  literatureScore: number;
  methodologyScore: number;
  presentationScore: number;
  criticalIssues: string;
  minorIssues: string;
  recommendations: string;
  verdict: "pass" | "revise";
  createdAt: Date;
}

const PanelEvaluationSchema = new Schema<IPanelEvaluation>({
  panelMemberId: { type: Schema.Types.ObjectId, ref: "PanelMember", required: true },
  problemScore: { type: Number, required: true },
  objectivesScore: { type: Number, required: true },
  literatureScore: { type: Number, required: true },
  methodologyScore: { type: Number, required: true },
  presentationScore: { type: Number, required: true },
  criticalIssues: { type: String, required: false },
  minorIssues: { type: String, required: false },
  recommendations: { type: String, required: false },
  verdict: { type: String, enum: ["pass", "revise"], required: true },
  createdAt: { type: Date, default: Date.now }
});

export const PanelEvaluationModel =
  (mongoose.models.PanelEvaluation as Model<IPanelEvaluation>) ||
  mongoose.model<IPanelEvaluation>("PanelEvaluation", PanelEvaluationSchema);

// --- Panel Result ---
export interface IPanelResult extends Document {
  panelId: mongoose.Types.ObjectId;
  averageScore: number;
  finalVerdict: "pass" | "revise";
  summaryFeedback: {
    critical: string[];
    minor: string[];
    recommendations: string[];
  };
  panelistBreakdown: Array<{
    name: string;
    type: string;
    score: number;
    verdict: string;
  }>;
  generatedAt: Date;
}

const PanelResultSchema = new Schema<IPanelResult>({
  panelId: { type: Schema.Types.ObjectId, ref: "PanelEvent", required: true },
  averageScore: { type: Number, required: true },
  finalVerdict: { type: String, enum: ["pass", "revise"], required: true },
  summaryFeedback: {
    critical: { type: [String], default: [] },
    minor: { type: [String], default: [] },
    recommendations: { type: [String], default: [] }
  },
  panelistBreakdown: [{
    name: String,
    type: String,
    score: Number,
    verdict: String
  }],
  generatedAt: { type: Date, default: Date.now }
});

export const PanelResultModel =
  (mongoose.models.PanelResult as Model<IPanelResult>) ||
  mongoose.model<IPanelResult>("PanelResult", PanelResultSchema);
