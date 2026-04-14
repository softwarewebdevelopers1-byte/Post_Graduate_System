import { Router, type Request, type Response } from "express";
import { SeminarSlotModel } from "../models/seminar.slot.js";

export const SeminarSlotRouter = Router();

function deriveOpenStatus(slot: { status: string; presenters: unknown[]; maxPresenters: number }) {
  if (slot.status === "Closed") {
    return "Closed";
  }

  return slot.presenters.length >= slot.maxPresenters ? "Full" : "Open";
}

// Create slot
SeminarSlotRouter.post(
  "/admin/create",
  async (req: Request, res: Response) => {
    try {
      const { date, startTime, endTime, level, venue, department, maxPresenters } = req.body;
      const parsedMaxPresenters = Number(maxPresenters) || 3;

      if (!date || !startTime || !endTime || !level || !venue || !department) {
        return res.status(400).json({ success: false, message: "All slot fields are required" });
      }

      if (parsedMaxPresenters < 1) {
        return res.status(400).json({ success: false, message: "Slot capacity must be at least 1" });
      }

      const slot = await SeminarSlotModel.create({
        date,
        startTime,
        endTime,
        level,
        venue,
        department,
        maxPresenters: parsedMaxPresenters,
      });
      res.status(201).json({ success: true, slot });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: "Error creating slot" });
    }
  }
);

// Get all slots
SeminarSlotRouter.get(
  "/all",
  async (req: Request, res: Response) => {
    try {
      const department = String(req.query.department || "")
        .trim()
        .toUpperCase();
      const normalizedDepartment = department === "CJM" ? "CMJ" : department;
      const filter = normalizedDepartment
        ? { department: { $in: [normalizedDepartment, "Both"] } }
        : {};

      const slots = await SeminarSlotModel.find(filter).sort({ date: 1 });

      for (const slot of slots) {
        const nextStatus = deriveOpenStatus(slot);
        if (slot.status !== nextStatus) {
          slot.status = nextStatus as "Open" | "Full" | "Closed";
          await slot.save();
        }
      }

      res.status(200).json({ success: true, slots });
    } catch (error) {
      res.status(500).json({ success: false, message: "Error fetching slots" });
    }
  }
);

// Toggle slot status
SeminarSlotRouter.patch(
  "/:id/status",
  async (req: Request, res: Response) => {
    try {
        const slot = await SeminarSlotModel.findById(req.params.id);
        if (!slot) return res.status(404).json({ success: false });
        slot.status = slot.status === "Closed"
          ? (slot.presenters.length >= slot.maxPresenters ? "Full" : "Open")
          : "Closed";
        await slot.save();
        res.json({ success: true, status: slot.status });
    } catch (e) {
        res.status(500).json({ success: false });
    }
  }
);

// Delete slot (Optional for admin)
SeminarSlotRouter.delete(
  "/:id",
  async (req: Request, res: Response) => {
    try {
        await SeminarSlotModel.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false });
    }
  }
);
