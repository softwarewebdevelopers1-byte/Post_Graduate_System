import { Router, type Request, type Response } from "express";
import { StorageClient } from "@supabase/storage-js";
import { UserModel } from "../models/user.model.js";
import multer from "multer";
import fs from "fs";
import path from "path";
import { readFile } from "fs/promises";
import jwt from "jsonwebtoken";

export const ConceptNoteRouter = Router();

// ── Multer: temp disk storage for PDF before Supabase upload ─────────────────
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(process.cwd(), "uploads", "concept-notes");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `cn-${suffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
});

/** Helper: decode JWT from cookie */
const decodeToken = (req: Request): Promise<any> =>
  new Promise((resolve, reject) => {
    const token = req.cookies?.userToken;
    const secret = process.env.JWT_SECRET;
    if (!token || !secret) return reject(new Error("Unauthorized"));
    jwt.verify(token, secret, (err: any, payload: any) => {
      if (err) reject(err);
      else resolve(payload);
    });
  });

const CONCEPT_NOTE_STAGES = [
  "Concept Note (Department)",
  "Concept Note (School)",
];

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/concept-note/:userId/status
// Returns the student's full conceptNoteWorkflow sub-stage data
// ─────────────────────────────────────────────────────────────────────────────
ConceptNoteRouter.get(
  "/concept-note/:userId/status",
  async (req: Request, res: Response) => {
    try {
      const student = await UserModel.findById(req.params.userId).select(
        "fullName userNumber stage conceptNoteWorkflow status"
      );
      if (!student)
        return res.status(404).json({ message: "Student not found" });

      const workflow = student.conceptNoteWorkflow || { subStage: "slot_booking" };
      return res.json({
        success: true,
        stage: student.stage,
        subStage: workflow.subStage ?? "slot_booking",
        workflow,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/concept-note/:userId/book-slot
// Student submits a presentation slot request
// ─────────────────────────────────────────────────────────────────────────────
ConceptNoteRouter.post(
  "/concept-note/:userId/book-slot",
  async (req: Request, res: Response) => {
    try {
      const decoded = await decodeToken(req);
      const student = await UserModel.findById(req.params.userId);
      if (!student)
        return res.status(404).json({ message: "Student not found" });

      // Gate: Must be at a Concept Note stage
      if (!CONCEPT_NOTE_STAGES.includes(student.stage || "")) {
        return res.status(403).json({
          message: `Slot booking is only available at the Concept Note stage. Current stage: ${student.stage}`,
        });
      }

      // Gate: cannot rebook if already past slot_booking
      const current = student.conceptNoteWorkflow?.subStage ?? "slot_booking";
      if (current !== "slot_booking") {
        return res.status(400).json({
          message: `Booking already submitted. Current sub-stage: ${current}`,
          subStage: current,
        });
      }

      const { preferredDate, preferredTime, venue, additionalNotes } = req.body;
      if (!preferredDate || !preferredTime || !venue) {
        return res.status(400).json({
          message: "preferredDate, preferredTime, and venue are required.",
        });
      }

      student.conceptNoteWorkflow = {
        ...(student.conceptNoteWorkflow || {}),
        subStage: "awaiting_panel",
        bookingRequestedAt: new Date(),
        preferredDate,
        preferredTime,
        venue,
        additionalNotes: additionalNotes || "",
      } as any;

      student.markModified("conceptNoteWorkflow");
      await student.save();

      return res.status(200).json({
        success: true,
        message: "Slot booking request submitted. Awaiting panel scheduling by Director.",
        subStage: "awaiting_panel",
      });
    } catch (err: any) {
      if (err.message === "Unauthorized")
        return res.status(401).json({ message: "Unauthorized" });
      return res.status(500).json({ message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/concept-note/:userId/upload
// Student uploads concept note PDF to Supabase Storage
// Gate: subStage must be "document_upload"
// ─────────────────────────────────────────────────────────────────────────────
ConceptNoteRouter.post(
  "/concept-note/:userId/upload",
  upload.single("conceptNoteFile"),
  async (req: Request, res: Response) => {
    let filePath: string | null = null;
    try {
      await decodeToken(req);
      const student = await UserModel.findById(req.params.userId);
      if (!student)
        return res.status(404).json({ message: "Student not found" });

      const subStage = student.conceptNoteWorkflow?.subStage ?? "slot_booking";

      // Gate: upload only allowed when panel has been scheduled (document_upload sub-stage)
      if (subStage !== "document_upload") {
        if (req.file?.path && fs.existsSync(req.file.path))
          fs.unlinkSync(req.file.path);
        return res.status(403).json({
          message:
            subStage === "awaiting_panel"
              ? "Please wait for the Director to schedule your panel before uploading your concept note."
              : subStage === "slot_booking"
              ? "Please book a presentation slot first."
              : `Upload is not available at sub-stage: ${subStage}`,
          subStage,
        });
      }

      if (!req.file)
        return res.status(400).json({ message: "No PDF file uploaded." });

      filePath = req.file.path;

      const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const PROJECT_REF = process.env.SUPABASE_URL;
      if (!SERVICE_KEY || !PROJECT_REF) {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(500).json({ message: "Missing Supabase credentials" });
      }

      const STORAGE_URL = `https://${PROJECT_REF}.supabase.co/storage/v1`;
      const storageClient = new StorageClient(STORAGE_URL, {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      });

      const fileName = `concept-notes/${req.params.userId}-${Date.now()}-${req.file.originalname}`;
      const fileBuffer = await readFile(filePath);

      const { error: uploadError } = await storageClient
        .from("campusHub_PDF")
        .upload(fileName, fileBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);

      if (uploadError) {
        return res.status(500).json({
          message: "Failed to upload to Supabase",
          details: uploadError.message,
        });
      }

      const { data } = storageClient
        .from("campusHub_PDF")
        .getPublicUrl(fileName);

      // Advance sub-stage to panel_review
      student.conceptNoteWorkflow = {
        ...(student.conceptNoteWorkflow || {}),
        subStage: "panel_review",
        uploadedFileUrl: data.publicUrl,
        uploadedFileName: req.file.originalname,
        uploadedAt: new Date(),
      } as any;

      // Also sync the documents field
      if (!student.documents) student.documents = {} as any;
      student.documents!.conceptNote = "uploaded";

      student.markModified("conceptNoteWorkflow");
      student.markModified("documents");
      await student.save();

      return res.status(200).json({
        success: true,
        message: "Concept note uploaded. Panel will now review your document.",
        subStage: "panel_review",
        fileUrl: data.publicUrl,
      });
    } catch (err: any) {
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      if (err.message === "Unauthorized")
        return res.status(401).json({ message: "Unauthorized" });
      return res.status(500).json({ message: err.message });
    }
  }
);
