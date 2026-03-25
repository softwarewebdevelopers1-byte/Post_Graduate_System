import { Schema, model, type Document } from "mongoose";

export interface ISeminarSlot extends Document {
  date: string;
  startTime: string;
  endTime: string;
  level: "Departmental" | "School" | "Inter-School";
  venue: string;
  department: "CMJ" | "IHRS" | "Both";
  maxPresenters: number;
  presenters: Schema.Types.ObjectId[];
  status: "Open" | "Full" | "Closed";
  createdAt?: Date;
  updatedAt?: Date;
}

const SeminarSlotSchema = new Schema<ISeminarSlot>(
  {
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    level: {
      type: String,
      enum: ["Departmental", "School", "Inter-School"],
      required: true,
    },
    venue: { type: String, required: true },
    department: {
      type: String,
      enum: ["CMJ", "IHRS", "Both"],
      default: "Both",
    },
    maxPresenters: { type: Number, default: 3 },
    presenters: [{ type: Schema.Types.ObjectId, ref: "User" }],
    status: {
      type: String,
      enum: ["Open", "Full", "Closed"],
      default: "Open",
    },
  },
  { timestamps: true }
);

export const SeminarSlotModel = model<ISeminarSlot>("SeminarSlot", SeminarSlotSchema);
