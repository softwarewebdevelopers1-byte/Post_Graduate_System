import mongoose, { Schema, Model } from "mongoose";

export interface ISupervisorAssignment {
  supervisorId: string;
  supervisorName: string;
  studentId: string;
  studentName: string;
  studentRegNo: string;
  assignedBy: string;
  assignedAt: Date;
  status: "active" | "completed" | "transferred";
  notes?: string[];
}

const SupervisorAssignmentSchema = new Schema<ISupervisorAssignment>({
  supervisorId: {
    type: String,
    required: true,
  },
  supervisorName: {
    type: String,
    required: true,
  },
  studentId: {
    type: String,
    required: true,
  },
  studentName: {
    type: String,
    required: true,
  },
  studentRegNo: {
    type: String,
    required: true,
  },
  assignedBy: {
    type: String,
    required: true,
  },
  assignedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["active", "completed", "transferred"],
    default: "active",
  },
  notes: {
    type: [String],
    default: [],
  },
});

// Compound index to prevent duplicate active assignments
SupervisorAssignmentSchema.index(
  { supervisorId: 1, studentId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);

export const SupervisorAssignmentModel =
  (mongoose.models.SupervisorAssignment as Model<ISupervisorAssignment>) ||
  mongoose.model<ISupervisorAssignment>(
    "SupervisorAssignment",
    SupervisorAssignmentSchema,
  );
