import mongoose, { Schema, Document } from "mongoose";

export interface ISystemSettings extends Document {
  minProposalScore: number;
  supervisorStudentLimit: number;
  externalReportWeight: number;
  autoCourseworkCompletion: boolean;
  supervisorLockdown: boolean;
  externalAutoReminder: boolean;
  updatedAt: Date;
}

const SystemSettingsSchema: Schema = new Schema({
  minProposalScore: { type: Number, default: 60 },
  supervisorStudentLimit: { type: Number, default: 8 },
  externalReportWeight: { type: Number, default: 40 },
  autoCourseworkCompletion: { type: Boolean, default: true },
  supervisorLockdown: { type: Boolean, default: false },
  externalAutoReminder: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
});

export const SystemSettingsModel = mongoose.model<ISystemSettings>("SystemSettings", SystemSettingsSchema);
