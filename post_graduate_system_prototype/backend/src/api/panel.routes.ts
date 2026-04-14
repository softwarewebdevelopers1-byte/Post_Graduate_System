import { Router, type Request, type Response } from "express";
import { PanelEventModel, PanelMemberModel, PanelEvaluationModel, PanelResultModel } from "../models/panel.model.js";
import { UserModel } from "../models/user.model.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createRequire } from "module";
import path from "path";
import fs from "fs";
import multer from "multer";
import mammoth from "mammoth";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

export const PanelRouter = Router();

// --- Transcript Upload Configuration ---
const uploadTranscript = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

async function extractTextFromBuffer(buffer: Buffer, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  
  if (ext === ".pdf") {
    // Ensure we have the executable function
    let pdfExtractor = pdf;
    if (typeof pdf !== 'function' && pdf && typeof (pdf as any).default === 'function') {
      pdfExtractor = (pdf as any).default;
    }
    
    if (typeof pdfExtractor !== 'function') {
      throw new Error("PDF parser extraction failed: function not found");
    }

    const data = await pdfExtractor(buffer);
    return data.text;
  } else if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer: buffer });
    return result.value;
  } else if (ext === ".txt") {
    return buffer.toString("utf-8");
  }
  return "";
}

const STAGES = [
  "Coursework",
  "Concept Note (Department)",
  "Concept Note (School)",
  "Proposal (Department)",
  "Proposal (School)",
  "PG School Approval",
  "Fieldwork / NACOSTI",
  "Thesis Draft (Department)",
  "Thesis Draft (School)",
  "External Examination Submission",
  "Under External Examination",
  "Final Defence",
  "Graduation Clearance",
];

// 1. Create Panel Event (Director Only)
// POST /api/panels
PanelRouter.post("/panels", async (req: Request, res: Response) => {
  try {
    const { studentId, stage, scheduledDate, panelists, createdBy, chairEmail } = req.body;

    // Rules Enforcement: Min 3 members
    if (!panelists || panelists.length < 3) {
      return res.status(400).json({ message: "Formal rule: Panels must consist of at least 3 members (Chair + 2 Members)." });
    }

    // --- Panelist Conflict Detection ---
    const newDate = new Date(scheduledDate);
    const windowStart = new Date(newDate.getTime() - (2 * 60 * 60 * 1000));
    const windowEnd = new Date(newDate.getTime() + (2 * 60 * 60 * 1000));

    const overlappingMembers = await PanelMemberModel.find({
      email: { $in: panelists.map((p: any) => p.email) }
    }).populate("panelId");

    const conflicts = overlappingMembers.filter((m: any) => {
      const panel = m.panelId;
      if (!panel) return false;
      const pDate = new Date(panel.scheduledDate);
      return pDate >= windowStart && pDate <= windowEnd;
    });

    if (conflicts.length > 0) {
      const conflictList = conflicts.map((m: any) => m.email).join(", ");
      return res.status(409).json({ 
        message: "Conflict Detected: One or more panelists are already booked for another session at this time.", 
        conflicts: conflictList 
      });
    }

    // Create the Panel Event
    const panelEvent = new PanelEventModel({
      studentId,
      stage,
      scheduledDate,
      status: "pending",
      createdBy,
      corrections: [] // Initialize empty checklist
    });
    await panelEvent.save();

    // Create Panel Members
    const memberPromises = panelists.map((p: any) => {
      // Logic: If this panelist matches the chairEmail, assign role 'chair'
      const isChair = p.email === chairEmail;
      
      return new PanelMemberModel({
        panelId: panelEvent._id,
        userId: p.userId || null,
        email: p.email,
        type: p.type, // "internal" | "external"
        role: isChair ? "chair" : "member",
        hasSubmitted: false,
        assignedBy: createdBy, // Metadata for audit
        assignedAt: new Date(),
        status: "active"
      }).save();
    });

    await Promise.all(memberPromises);

    // ── Concept Note Workflow: advance sub-stage to "document_upload" ──────────
    const cnStages = ["Concept Note (Department)", "Concept Note (School)"];
    if (cnStages.includes(stage)) {
      const stud = await UserModel.findById(studentId);
      if (stud) {
        const subStage = stud.conceptNoteWorkflow?.subStage;
        // Only advance if student is at awaiting_panel (slot booking done)
        if (!subStage || subStage === "awaiting_panel" || subStage === "slot_booking") {
          stud.conceptNoteWorkflow = {
            ...(stud.conceptNoteWorkflow || {}),
            subStage: "document_upload",
            panelScheduledDate: new Date(scheduledDate),
            panelMembers: panelists.map((p: any) => p.email || p.userId || ""),
          } as any;
          stud.markModified("conceptNoteWorkflow");
          await stud.save();
        }
      }
    }

    res.status(201).json({ message: "Panel created successfully with formal roles", panelEvent });
  } catch (error) {
    res.status(500).json({ message: "Error creating panel", error });
  }
});

// GET all panels (Director)
PanelRouter.get("/panels", async (req: Request, res: Response) => {
  try {
    const panels = await PanelEventModel.find()
      .populate("studentId", "fullName userNumber programme stage")
      .sort({ createdAt: -1 });
    
    // For each panel, fetch members to show progress
    const panelsWithProgress = await Promise.all(panels.map(async (p) => {
      const members = await PanelMemberModel.find({ panelId: p._id });
      return {
        ...p.toObject(),
        members: members.map(m => ({
          _id: m._id,
          type: m.type,
          role: m.role,
          status: m.status,
          hasSubmitted: m.hasSubmitted,
          email: m.email
        }))
      };
    }));

    res.json(panelsWithProgress);
  } catch (error) {
    res.status(500).json({ message: "Error fetching panels", error });
  }
});

// 2. Fetch Panels for User
// GET /api/panels/my/:userId
PanelRouter.get("/panels/my/:userId", async (req: Request, res: Response) => {
  try {
    const userId = String(req.params.userId || "");
    const user = await UserModel.findById(userId);
    const email = user?.userNumber || ""; // Assuming userNumber or some field is used for email mapping

    // Find memberships by userId or email (for external if they use the same system)
    const memberships = await PanelMemberModel.find({
      $or: [{ userId: userId }, { email: email }]
    });

    const panelIds = memberships.map(m => m.panelId);
    
    // Fetch panel events and populate student info
    const panels = await PanelEventModel.find({ _id: { $in: panelIds } })
      .populate("studentId", "fullName userNumber programme stage")
      .sort({ scheduledDate: 1 });

    // Combine with submission status
    const result = panels.map(p => {
      const membership = memberships.find(m => m.panelId.toString() === p._id.toString());
      return {
        ...p.toObject(),
        hasSubmitted: membership?.hasSubmitted || false,
        memberId: membership?._id,
        role: membership?.role || "member", // Dynamic role per presentation
        membershipStatus: membership?.status || "active" // Gating field
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: "Error fetching user panels", error });
  }
});

// NEW: GET Eligible Panelists (Supervisors, Directors, PG Faculty)
PanelRouter.get("/users/eligible-panelists", async (req: Request, res: Response) => {
  try {
    const users = await UserModel.find({
      role: { $in: ["supervisor", "director", "pg_dean", "faculty", "admin"] }
    }).select("fullName userNumber role department isVerified");
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching eligible panelists", error });
  }
});

// NEW: Reassign Panelist
PanelRouter.post("/panels/:panelId/reassign", async (req: Request, res: Response) => {
  try {
    const { panelId } = req.params;
    const { oldMemberId, newMember, role, assignedBy } = req.body; 
    // newMember payload: { userId, email, type }

    // 1. Revoke old member if provided
    if (oldMemberId) {
      await PanelMemberModel.findByIdAndUpdate(oldMemberId, { 
        status: "revoked", 
        revokedAt: new Date() 
      });
    }

    // 2. Create new membership
    const membership = new PanelMemberModel({
      panelId,
      userId: newMember.userId || null,
      email: newMember.email,
      type: newMember.type,
      role: role || "member",
      hasSubmitted: false,
      assignedBy: assignedBy,
      assignedAt: new Date(),
      status: "active"
    });
    await membership.save();

    res.json({ message: "Panelist reassigned successfully", membership });
  } catch (error) {
    console.error("Reassign error:", error);
    res.status(500).json({ message: "Error reassigning panelist", error });
  }
});

// NEW: Manually Revoke Panelist
PanelRouter.post("/panels/:panelId/revoke", async (req: Request, res: Response) => {
  try {
    const { memberId } = req.body;
    await PanelMemberModel.findByIdAndUpdate(memberId, { 
      status: "revoked", 
      revokedAt: new Date() 
    });
    res.json({ message: "Panelist privileges revoked" });
  } catch (error) {
    console.error("Revoke error:", error);
    res.status(500).json({ message: "Error revoking privileges", error });
  }
});

// GET Panel History for a specific Student
PanelRouter.get("/panels/student/:studentId", async (req: Request, res: Response) => {
  try {
    const studentId = String(req.params.studentId || "");
    const panels = await PanelEventModel.find({ studentId })
      .populate("studentId", "fullName userNumber programme stage")
      .sort({ createdAt: -1 });

    const panelsWithResults = await Promise.all(panels.map(async (p) => {
      const result = await PanelResultModel.findOne({ panelId: p._id });
      return { ...p.toObject(), result };
    }));

    res.json(panelsWithResults);
  } catch (error) {
    res.status(500).json({ message: "Error fetching student panel history", error });
  }
});

// 3. Submit Evaluation
// POST /api/panels/evaluate
PanelRouter.post("/panels/evaluate", async (req: Request, res: Response) => {
  try {
    const { memberId, scores, structuredFeedback, verdict } = req.body;

    // 0. Status & Duplicate Check
    const existingMember = await PanelMemberModel.findById(memberId).populate("panelId");
    if (!existingMember) return res.status(404).json({ message: "Member not found" });
    
    const panel = existingMember.panelId as any;
    if (panel.status === "completed") {
      return res.status(403).json({ message: "Board session is closed. No further evaluations can be submitted." });
    }

    if (existingMember.hasSubmitted) {
      return res.status(400).json({ message: "Evaluation already submitted for this panelist." });
    }

    // 1. Save Evaluation
    const evaluation = new PanelEvaluationModel({
      panelMemberId: memberId,
      problemScore: scores.problemScore,
      objectivesScore: scores.objectivesScore,
      literatureScore: scores.literatureScore,
      methodologyScore: scores.methodologyScore,
      presentationScore: scores.presentationScore,
      criticalIssues: structuredFeedback.criticalIssues,
      minorIssues: structuredFeedback.minorIssues,
      recommendations: structuredFeedback.recommendations,
      verdict
    });
    await evaluation.save();

    // 2. Update Member Status & Event Status
    const member = await PanelMemberModel.findByIdAndUpdate(memberId, { hasSubmitted: true }, { new: true });
    if (!member) return res.status(404).json({ message: "Member not found" });

    const panelId = member.panelId;
    await PanelEventModel.findByIdAndUpdate(panelId, { status: "ongoing" });

    // 3. Check for Aggregation
    const allMembers = await PanelMemberModel.find({ panelId });
    const allSubmitted = allMembers.every(m => m.hasSubmitted);

    if (allSubmitted) {
      await aggregatePanelResults(panelId);
    }

    res.json({ message: "Evaluation submitted successfully", evaluation });
  } catch (error) {
    res.status(500).json({ message: "Error submitting evaluation", error });
  }
});

// 4. Fetch Panel Results
// GET /api/panels/:panelId/results
PanelRouter.get("/panels/:panelId/results", async (req: Request, res: Response) => {
  try {
    const panelId = String(req.params.panelId || "");
    const result = await PanelResultModel.findOne({ panelId });
    if (result) {
      return res.json(result);
    }

    // If final results aren't generated yet, compute real-time progress
    const members = await PanelMemberModel.find({ panelId });
    const memberIds = members.map(m => m._id);
    const evaluations = await PanelEvaluationModel.find({ panelMemberId: { $in: memberIds } });

    if (evaluations.length === 0) {
      return res.status(404).json({ message: "Evaluation still in progress. No members have submitted yet." });
    }

    // Calculate Average Score so far
    let totalScore = 0;
    evaluations.forEach(e => {
      totalScore += (e.problemScore + e.objectivesScore + e.literatureScore + e.methodologyScore + e.presentationScore) / 5;
    });
    const averageScore = totalScore / evaluations.length;

    // Calculate Majority Verdict so far
    const passCount = evaluations.filter(e => e.verdict === "pass").length;
    const reviseCount = evaluations.filter(e => e.verdict === "revise").length;
    const majorityVerdict = passCount >= reviseCount ? "pass" : "revise";
    const finalVerdict = (averageScore >= 60 && majorityVerdict === "pass") ? "pass" : "revise";

    const summaryFeedback = {
      critical: evaluations.map(e => e.criticalIssues).filter(Boolean),
      minor: evaluations.map(e => e.minorIssues).filter(Boolean),
      recommendations: evaluations.map(e => e.recommendations).filter(Boolean)
    };

    const panelistBreakdown = await Promise.all(evaluations.map(async (e) => {
      const mem = members.find(m => m._id.toString() === e.panelMemberId.toString());
      let name = mem?.email || "Unknown";
      if (mem?.userId) {
        const u = await UserModel.findById(mem.userId);
        if (u) name = u.fullName;
      }
      const score = (e.problemScore + e.objectivesScore + e.literatureScore + e.methodologyScore + e.presentationScore) / 5;
      return { name, type: mem?.type || "internal", score, verdict: e.verdict };
    }));

    // Return the real-time calculated result without saving it
    res.json({
      averageScore,
      finalVerdict,
      summaryFeedback,
      panelistBreakdown,
      status: "in_progress" // Let the frontend know this is real-time
    });

  } catch (error) {
    res.status(500).json({ message: "Error fetching results", error });
  }
});


// 5. CHAIR WORKFLOW: Upload Transcript & Extract Corrections
// POST /api/panels/transcript
// Handles multipart/form-data with file
PanelRouter.post("/panels/transcript", uploadTranscript.single("transcriptFile"), async (req: Request, res: Response) => {
  try {
    const { panelId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No transcript file uploaded." });
    }

    // 1. Extract Text
    const transcriptText = await extractTextFromBuffer(file.buffer, file.originalname);
    if (!transcriptText || transcriptText.trim().length < 50) {
       return res.status(400).json({ message: "Failed to extract meaningful text from transcript. Please ensure it is a valid document." });
    }

    // 2. AI Extraction using Gemini
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: "AI services not configured. Missing API Key." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
      You are an academic governance assistant for a postgraduate system. 
      Analyze the following transcript from a research presentation board session.
      Your task is to extract a list of formal corrections, issues, and recommendations raised by the panelists.
      Categorize each as "critical", "major", or "minor".
      
      Return ONLY a JSON array of objects in this format:
      [
        { "category": "critical" | "major" | "minor", "description": "Short clear description of the issue" }
      ]

      Transcript:
      ${transcriptText.substring(0, 15000)}
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Clean JSON response (more robust)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    let suggestedCorrections = [];
    if (jsonMatch) {
      try {
        suggestedCorrections = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error("AI Parse Error:", responseText);
        return res.status(500).json({ message: "AI failed to generate structured corrections.", raw: responseText });
      }
    } else {
      console.error("AI No JSON found:", responseText);
      return res.status(500).json({ message: "AI failed to return structured corrections JSON.", raw: responseText });
    }

    // 3. No longer saving transcript URL to disk as per user request

    res.json({ 
      message: "Transcript processed by AI successfully", 
      suggestedCorrections,
      extractedAt: new Date()
    });
  } catch (error) {
    console.error("Transcript processing error:", error);
    res.status(500).json({ message: "Error processing transcript", error });
  }
});

// 6. CHAIR WORKFLOW: Finalize & Publish Corrections Checklist
// POST /api/panels/:panelId/checklist
PanelRouter.post("/panels/:panelId/checklist", async (req: Request, res: Response) => {
  try {
    const { corrections } = req.body; // Array of {category, description}
    const panelId = String(req.params.panelId || "");

    const panel = await PanelEventModel.findById(panelId);
    if (!panel) return res.status(404).json({ message: "Panel not found" });

    if (panel.status === "completed") {
      return res.status(403).json({ message: "Board session is closed. Corrections checklist cannot be modified." });
    }

    // Store as formal trackable objects
    panel.corrections = corrections.map((c: any) => ({
      category: c.category,
      description: c.description,
      status: "pending",
      supervisorSignOff: false
    }));

    await panel.save();

    res.json({ message: "Formal Correction Checklist published to student portal", corrections: panel.corrections });
  } catch (error) {
    res.status(500).json({ message: "Error publishing checklist", error });
  }
});

// 7. STUDENT WORKFLOW: Mark Correction as Fixed
// PATCH /api/panels/:panelId/corrections/:correctionId/fix
PanelRouter.patch("/panels/:panelId/corrections/:correctionId/fix", async (req: Request, res: Response) => {
  try {
    const panelId = String(req.params.panelId || "");
    const correctionId = String(req.params.correctionId || "");
    const panel = await PanelEventModel.findById(panelId);
    if (!panel) return res.status(404).json({ message: "Panel not found" });

    const correction = (panel.corrections as any[]).find(
      (item: any) => String(item._id || item.id) === correctionId,
    ) as any;
    if (!correction) return res.status(404).json({ message: "Correction item not found" });

    correction.status = "fixed";
    await panel.save();

    res.json({ message: "Correction marked as fixed. Pending supervisor review.", correction });
  } catch (error) {
    res.status(500).json({ message: "Error updating correction", error });
  }
});

// 8. SUPERVISOR WORKFLOW: Approve Correction
// PATCH /api/panels/:panelId/corrections/:correctionId/approve
PanelRouter.patch("/panels/:panelId/corrections/:correctionId/approve", async (req: Request, res: Response) => {
  try {
    const panelId = String(req.params.panelId || "");
    const correctionId = String(req.params.correctionId || "");
    const panel = await PanelEventModel.findById(panelId);
    if (!panel) return res.status(404).json({ message: "Panel not found" });

    const correction = (panel.corrections as any[]).find(
      (item: any) => String(item._id || item.id) === correctionId,
    ) as any;
    if (!correction) return res.status(404).json({ message: "Correction item not found" });

    correction.status = "approved";
    correction.supervisorSignOff = true;
    await panel.save();

    // --- Finance ERP Integration Trigger ---
    // Rule: If all corrections for the latest panel are approved, trigger Finance Clearance request
    const allApproved = panel.corrections.every((c: any) => c.status === "approved");
    if (allApproved) {
      await UserModel.findByIdAndUpdate(panel.studentId, { 
        $set: { financialClearance: false } // Reset to false to trigger a new Finance review cycle
      });
      console.log(`[Finance ERP] Triggered clearance request for Student ID: ${panel.studentId}`);
    }

    res.json({ message: "Correction officially approved. Dynamic academic record updated.", correction, allApproved });
  } catch (error) {
    res.status(500).json({ message: "Error approving correction", error });
  }
});

// Helper: Aggregation Logic
async function aggregatePanelResults(panelId: any) {
  // Prevent duplicate result generation
  const existingResult = await PanelResultModel.findOne({ panelId });
  if (existingResult) return;

  const members = await PanelMemberModel.find({ panelId });
  const memberIds = members.map(m => m._id);
  
  const evaluations = await PanelEvaluationModel.find({ panelMemberId: { $in: memberIds } });
  if (evaluations.length === 0) return;

  // Calculate Average Score
  let totalScore = 0;
  evaluations.forEach(e => {
    totalScore += (e.problemScore + e.objectivesScore + e.literatureScore + e.methodologyScore + e.presentationScore) / 5;
  });
  const averageScore = totalScore / evaluations.length;

  // Calculate Majority Verdict
  const passCount = evaluations.filter(e => e.verdict === "pass").length;
  const reviseCount = evaluations.filter(e => e.verdict === "revise").length;
  const majorityVerdict = passCount >= reviseCount ? "pass" : "revise";

  // Hybrid Final Decision
  const finalVerdict = (averageScore >= 60 && majorityVerdict === "pass") ? "pass" : "revise";

  // Aggregate Structured Feedback
  const summaryFeedback = {
    critical: evaluations.map(e => e.criticalIssues).filter(Boolean),
    minor: evaluations.map(e => e.minorIssues).filter(Boolean),
    recommendations: evaluations.map(e => e.recommendations).filter(Boolean)
  };

  // Build Panelist Breakdown
  const panelistBreakdown = await Promise.all(evaluations.map(async (e) => {
    const mem = members.find(m => m._id.toString() === e.panelMemberId.toString());
    let name = mem?.email || "Unknown";
    if (mem?.userId) {
      const u = await UserModel.findById(mem.userId);
      if (u) name = u.fullName;
    }
    const score = (e.problemScore + e.objectivesScore + e.literatureScore + e.methodologyScore + e.presentationScore) / 5;
    return { name, type: mem?.type || "internal", score, verdict: e.verdict };
  }));

  // Save Panel Result
  const panelResult = new PanelResultModel({
    panelId,
    averageScore,
    finalVerdict,
    summaryFeedback,
    panelistBreakdown
  });
  await panelResult.save();

  // Update Panel Event status
  await PanelEventModel.findByIdAndUpdate(panelId, { status: "completed" });

  // --- AUTOMATIC ROLE REVOCATION (Section 5) ---
  // When a presentation completes, all panelist privileges are revoked for audit trail
  await PanelMemberModel.updateMany(
    { panelId },
    { $set: { status: "revoked", revokedAt: new Date() } }
  );

  // 5. TRIGGER SYSTEM INTEGRATION
  const panelEvent = await PanelEventModel.findById(panelId);
  if (panelEvent) {
    const student = await UserModel.findById(panelEvent.studentId);
    if (student) {
      const cnStages = ["Concept Note (Department)", "Concept Note (School)"];
      const isConceptNote = cnStages.includes(student.stage || "");

      if (finalVerdict === "pass") {
        // Advance pipeline stage
        const currentIdx = STAGES.indexOf(student.stage || "Coursework");
        if (currentIdx !== -1 && currentIdx < STAGES.length - 1) {
          const nextStage = STAGES[currentIdx + 1];
          if (nextStage) student.stage = nextStage;
        }
        // Mark concept note workflow as completed
        if (isConceptNote) {
          student.conceptNoteWorkflow = {
            ...(student.conceptNoteWorkflow || {}),
            subStage: "completed",
            panelDecision: "pass",
            panelScore: averageScore,
            reviewedAt: new Date(),
            completedAt: new Date(),
          } as any;
          student.documents = student.documents || {} as any;
          student.documents!.conceptNote = "approved";
          student.markModified("documents");
        }
      } else {
        // Revise — loop student back to document_upload
        if (isConceptNote) {
          const prevAttempts = student.conceptNoteWorkflow?.attemptCount ?? 0;
          student.conceptNoteWorkflow = {
            ...(student.conceptNoteWorkflow || {}),
            subStage: "document_upload",
            panelDecision: "corrections",
            panelScore: averageScore,
            panelFeedback: summaryFeedback.critical.join(" | ") || "Revisions required.",
            correctionsList: [
              ...summaryFeedback.critical,
              ...summaryFeedback.minor,
              ...summaryFeedback.recommendations,
            ].flat().filter(Boolean),
            reviewedAt: new Date(),
            attemptCount: prevAttempts + 1,
            // Reset upload fields so student can re-upload
            uploadedFileUrl: undefined,
            uploadedFileName: undefined,
            uploadedAt: undefined,
          } as any;
          student.documents = student.documents || {} as any;
          student.documents!.conceptNote = "corrections_required";
          student.markModified("documents");
        }
      }

      student.markModified("conceptNoteWorkflow");
      await student.save();
    }
  }
}
