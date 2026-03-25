import { Router, type Request, type Response } from "express";
import { SeminarSlotModel } from "../models/seminar.slot.js";

export const SeminarSlotRouter = Router();

// Create slot
SeminarSlotRouter.post(
  "/admin/create",
  async (req: Request, res: Response) => {
    try {
      const { date, startTime, endTime, level, venue, department, maxPresenters } = req.body;
      const slot = await SeminarSlotModel.create({
        date,
        startTime,
        endTime,
        level,
        venue,
        department,
        maxPresenters: Number(maxPresenters) || 3,
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
      const slots = await SeminarSlotModel.find().sort({ date: 1 });
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
        slot.status = slot.status === "Closed" ? "Open" : "Closed";
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
