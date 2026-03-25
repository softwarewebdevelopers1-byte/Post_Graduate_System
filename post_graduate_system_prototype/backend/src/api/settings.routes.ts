import { Router, type Request, type Response } from "express";
import { SystemSettingsModel } from "../models/system-settings.model.js";

export const settingsRouter = Router();

// GET /api/settings
settingsRouter.get("/settings", async (req: Request, res: Response) => {
  try {
    let settings = await SystemSettingsModel.findOne();
    if (!settings) {
      // Initialize with defaults if none exist
      settings = await SystemSettingsModel.create({});
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: "Error fetching settings", error });
  }
});

// POST /api/settings/update
settingsRouter.post("/settings/update", async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    let settings = await SystemSettingsModel.findOne();
    
    if (!settings) {
      settings = new SystemSettingsModel(payload);
    } else {
      Object.assign(settings, payload);
      settings.updatedAt = new Date();
    }
    
    await settings.save();
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ message: "Error updating settings", error });
  }
});

// POST /api/settings/reset
settingsRouter.post("/settings/reset", async (req: Request, res: Response) => {
  try {
    await SystemSettingsModel.deleteMany({});
    const defaults = await SystemSettingsModel.create({});
    res.json({ success: true, settings: defaults });
  } catch (error) {
    res.status(500).json({ message: "Error resetting settings", error });
  }
});
