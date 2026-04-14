import { Router, type Request, type Response } from "express";
import { UserModel } from "../models/user.model.js";
import { PanelEventModel } from "../models/panel.model.js";
import { SupervisorAssignmentModel } from "../models/supervisor-action.model.js";
import { bookingsModel } from "../models/student.bookings.js";
import mongoose from "mongoose";

export const SupervisorRouter = Router();

async function resolveSupervisorIdentifiers(rawSupervisorId: string) {
  const identifiers = new Set<string>();
  if (rawSupervisorId) identifiers.add(rawSupervisorId);

  if (mongoose.Types.ObjectId.isValid(rawSupervisorId)) {
    const user = await UserModel.findById(rawSupervisorId).select("fullName userNumber");
    if (user?.fullName) identifiers.add(user.fullName);
    if (user?.userNumber) identifiers.add(user.userNumber);
    identifiers.add(String(rawSupervisorId));
  }

  return Array.from(identifiers).filter(Boolean);
}

function resolveSupervisorSlot(student: any, identifiers: string[]) {
  if (identifiers.includes(String(student?.supervisors?.sup1 || ""))) return "sup1";
  if (identifiers.includes(String(student?.supervisors?.sup2 || ""))) return "sup2";
  return null;
}

function requiredSupervisorRoles(student: any) {
  return ["sup1", "sup2"];
}

// 1. Fetch assigned students
// GET /supervisor/:id/students
SupervisorRouter.get("/supervisor/:id/students", async (req: Request, res: Response) => {
  try {
    const identifiers = await resolveSupervisorIdentifiers(String(req.params.id || ""));

    // Find students where this supervisor is sup1 or sup2
    const students = await UserModel.find({
      $or: [
        { "supervisors.sup1": { $in: identifiers } },
        { "supervisors.sup2": { $in: identifiers } }
      ],
      role: "student"
    } as any);
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: "Error fetching assigned students", error });
  }
});

// 2. Accept / Reject student assignment
// POST /students/:id/assign
SupervisorRouter.post("/students/:id/assign", async (req: Request, res: Response) => {
  try {
    const studentId = req.params.id;
    const { supervisorId, action } = req.body; // action: "accepted" | "rejected"

    if (!["accepted", "rejected"].includes(String(action || ""))) {
      return res.status(400).json({ message: "Action must be accepted or rejected" });
    }

    const student = await UserModel.findById(studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const identifiers = await resolveSupervisorIdentifiers(String(supervisorId || ""));
    const slot = resolveSupervisorSlot(student, identifiers);

    if (!slot) return res.status(403).json({ message: "Supervisor not assigned to this student" });

    const update: any = {};
    update[`assignmentStatus.${slot}`] = action;
    const supervisor = mongoose.Types.ObjectId.isValid(String(supervisorId || ""))
      ? await UserModel.findById(String(supervisorId)).select("fullName userNumber")
      : null;
    const supervisorName =
      String(supervisor?.fullName || "").trim() ||
      identifiers.find((value) => value === String(student?.supervisors?.[slot as "sup1" | "sup2"] || "")) ||
      String(supervisorId || "").trim() ||
      "Supervisor";

    if (action === "rejected") {
      update[`supervisors.${slot}`] = "";
      update.$push = {
        notes: `Director alert: ${supervisorName} rejected supervision assignment for ${student.fullName} (${student.userNumber}) on ${new Date().toLocaleDateString()}.`,
      };

      await SupervisorAssignmentModel.findOneAndUpdate(
        {
          studentId: student._id.toString(),
          status: "active" as const,
          $or: [
            { supervisorId: String(supervisor?._id || supervisorId || "") },
            { supervisorName },
          ],
        } as any,
        {
          $set: { status: "transferred" as const },
          $push: { notes: `Rejected by ${supervisorName} on ${new Date().toLocaleDateString()}` },
        },
        { new: true },
      );
    }

    const updatedStudent = await UserModel.findByIdAndUpdate(studentId, update, { new: true });
    res.json({
      message: action === "rejected"
        ? "Assignment rejected and director notified"
        : `Assignment ${action}`,
      student: updatedStudent,
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating assignment status", error });
  }
});

SupervisorRouter.get("/supervisor/:id/presentations", async (req: Request, res: Response) => {
  try {
    const identifiers = await resolveSupervisorIdentifiers(String(req.params.id || ""));

    const students = await UserModel.find({
      $or: [
        { "supervisors.sup1": { $in: identifiers } },
        { "supervisors.sup2": { $in: identifiers } }
      ],
      role: "student"
    } as any).select("_id fullName userNumber programme department stage status assignmentStatus supervisors");

    const eligibleStudents = students.filter((student: any) => {
      const slot = resolveSupervisorSlot(student, identifiers);
      if (!slot) return false;
      return String(student?.assignmentStatus?.[slot] || "").toLowerCase() !== "rejected";
    });

    if (!eligibleStudents.length) {
      return res.json({ success: true, count: 0, presentations: [] });
    }

    const studentIds = eligibleStudents.map((student: any) => String(student._id));
    const bookings = await bookingsModel.find({
      ownerId: { $in: studentIds }
    }).sort({ createdAt: -1 }).lean();

    const studentMap = new Map(
      eligibleStudents.map((student: any) => [String(student._id), student]),
    );

    const presentations = bookings.map((booking: any) => {
      const student = studentMap.get(String(booking.ownerId || ""));
      if (!student) return null;

      const slot = resolveSupervisorSlot(student, identifiers);
      const assignmentStatus = slot
        ? String(student?.assignmentStatus?.[slot] || "pending")
        : "pending";

      return {
        bookingId: booking._id,
        studentId: student._id,
        studentName: student.fullName,
        studentReg: student.userNumber,
        programme: student.programme,
        department: student.department,
        stage: student.stage || "Coursework",
        studentStatus: student.status || "Active",
        assignmentStatus,
        preferredDate: booking.preferredDate,
        preferredTime: booking.preferredTime,
        presentationType: booking.presentationType,
        venue: booking.venue,
        bookingStatus: booking.status,
        additionalNotes: booking.additionalNotes || "",
        createdAt: booking.createdAt,
      };
    }).filter(Boolean);

    res.json({
      success: true,
      count: presentations.length,
      presentations,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching supervisor presentations", error });
  }
});

// 3. Approve / Return pipeline stages
// POST /students/:id/stage/:stageName/approve
SupervisorRouter.post("/students/:id/stage/:stageName/approve", async (req: Request, res: Response) => {
  try {
    const { id, stageName } = req.params;
    const { action, comment } = req.body; // action: "approved" | "returned"

    // Check if documents are complete (for Thesis/Draft)
    // Simplified: update status in the documents map
    const fieldMapping: any = {
      "conceptNote": "documents.conceptNote",
      "proposal": "documents.proposal",
      "thesis": "documents.thesis"
    };

    const targetField = (fieldMapping as any)[stageName as string];
    const update: any = {};
    if (targetField) update[targetField] = action === "approved" ? "approved" : "rejected";

    // --- Formal Governance Check ---
    // Rule: Block sign-off if there are outstanding critical/major panel corrections
    const studentPanels = await PanelEventModel.find({ studentId: String(id || "") });
    const outstandingCorrections = studentPanels.flatMap((p: any) => 
      (p.corrections || []).filter((c: any) => 
        (c.category === "critical" || c.category === "major") && c.status !== "approved"
      )
    );

    if (outstandingCorrections.length > 0) {
      return res.status(400).json({ 
        message: "Sign-off blocked. Candidate has unresolved Critical or Major corrections from a previous panel session.", 
        outstandingCount: outstandingCorrections.length 
      });
    }

    // If approved, maybe advance stage?
    const student = await UserModel.findByIdAndUpdate(id, { $set: update }, { new: true });
    res.json({ message: `Stage ${action}`, student });
  } catch (error) {
    res.status(500).json({ message: "Error approving stage", error });
  }
});

// 4. Fetch/Update corrections
// GET /students/:id/corrections
SupervisorRouter.get("/students/:id/corrections", async (req: Request, res: Response) => {
  try {
    const student = await UserModel.findById(req.params.id);
    res.json(student?.corrections || []);
  } catch (error) {
    res.status(500).json({ message: "Error fetching corrections", error });
  }
});

// POST /students/:id/corrections
SupervisorRouter.post("/students/:id/corrections", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { correctionId, completed, validation, text, source } = req.body;

    if (correctionId) {
      // Update existing
      await UserModel.updateOne(
        { _id: id, "corrections.id": correctionId },
        { 
          $set: { 
            "corrections.$.completed": completed,
            "corrections.$.validation": validation,
            "corrections.$.updatedAt": new Date()
          } 
        }
      );
    } else {
      // Add new
      await UserModel.findByIdAndUpdate(id, {
        $push: { 
          corrections: { 
            id: Math.random().toString(36).substr(2, 9),
            text, 
            source, 
            completed: false, 
            updatedAt: new Date() 
          } 
        }
      });
    }

    const student = await UserModel.findById(id);
    res.json({ message: "Corrections updated", student });
  } catch (error) {
    res.status(500).json({ message: "Error updating corrections", error });
  }
});

// 5. Documents / Quarterly Reports
SupervisorRouter.get("/students/:id/documents", async (req: Request, res: Response) => {
  try {
    const student = await UserModel.findById(req.params.id);
    res.json(student?.documents || {});
  } catch (error) {
    res.status(500).json({ message: "Error fetching documents", error });
  }
});

SupervisorRouter.get("/students/:id/qreports", async (req: Request, res: Response) => {
  try {
    const student = await UserModel.findById(req.params.id);
    res.json(student?.quarterlyReports || []);
  } catch (error) {
    res.status(500).json({ message: "Error fetching quarterly reports", error });
  }
});

SupervisorRouter.get("/supervisor/:id/qreports", async (req: Request, res: Response) => {
  try {
    const identifiers = await resolveSupervisorIdentifiers(String(req.params.id || ""));
    const { status, q } = req.query;

    const students = await UserModel.find({
      $or: [
        { "supervisors.sup1": { $in: identifiers } },
        { "supervisors.sup2": { $in: identifiers } },
      ],
      role: "student",
      quarterlyReports: { $exists: true, $ne: [] },
    } as any).select("fullName userNumber programme department supervisors quarterlyReports");

    let reports = students.flatMap((student) => {
      const supervisorRole = resolveSupervisorSlot(student, identifiers) || "sup1";

      return (student.quarterlyReports || []).map((report) => ({
        studentId: String(student._id),
        studentName: student.fullName,
        studentNumber: student.userNumber,
        programme: student.programme,
        department: student.department,
        supervisorRole,
        canReview: report.approvals?.[supervisorRole as keyof typeof report.approvals] === "pending",
        report,
      }));
    });

    if (status) {
      const statusText = String(status).toLowerCase();
      reports = reports.filter((entry) =>
        String(entry.report?.status || "").toLowerCase().includes(statusText),
      );
    }

    if (q) {
      const queryText = String(q).toLowerCase();
      reports = reports.filter((entry) =>
        [
          entry.studentName,
          entry.studentNumber,
          entry.programme,
          entry.department,
          entry.report?.progressSummary,
          entry.report?.objectivesAchieved,
          entry.report?.challengesAndMitigation,
          entry.report?.nextQuarterPlan,
          `Q${entry.report?.quarter || ""} ${entry.report?.year || ""}`,
        ]
          .join(" ")
          .toLowerCase()
          .includes(queryText),
      );
    }

    reports.sort((a, b) => {
      if ((b.report?.year || 0) !== (a.report?.year || 0)) {
        return (b.report?.year || 0) - (a.report?.year || 0);
      }
      if ((b.report?.quarter || 0) !== (a.report?.quarter || 0)) {
        return (b.report?.quarter || 0) - (a.report?.quarter || 0);
      }
      return String(a.studentName || "").localeCompare(String(b.studentName || ""));
    });

    res.json({ success: true, reports });
  } catch (error) {
    res.status(500).json({ message: "Error fetching supervisor quarterly reports", error });
  }
});

// 6. Analytics: Workload & Bottlenecks
SupervisorRouter.get("/supervisor/:id/analytics", async (req: Request, res: Response) => {
  try {
    const identifiers = await resolveSupervisorIdentifiers(String(req.params.id || ""));

    const students = await UserModel.find({
      $or: [
        { "supervisors.sup1": { $in: identifiers } },
        { "supervisors.sup2": { $in: identifiers } }
      ],
      role: "student"
    } as any);

    const analytics = {
      totalManaged: students.length,
      stageDistribution: students.reduce((acc: any, s) => {
        acc[s.stage || "Coursework"] = (acc[s.stage || "Coursework"] || 0) + 1;
        return acc;
      }, {}),
      bottlenecks: students.filter(s => s.atRisk).length,
      pendingAssignments: students.filter(s => {
        const slot = resolveSupervisorSlot(s, identifiers) || "sup1";
        return s.assignmentStatus?.[slot as keyof typeof s.assignmentStatus] === "pending";
      }).length,
      pendingQReports: students.filter(s => s.quarterlyReports?.some(r => r.status === "pending")).length
    };
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ message: "Error fetching analytics", error });
  }
});

// 7. Role-based Q-Report Approval
SupervisorRouter.post("/students/:id/qreports/:reportId/approve", async (req: Request, res: Response) => {
  try {
    const { id, reportId } = req.params;
    const { supervisorId, role, action, comment } = req.body; // role: sup1 or sup2
    const identifiers = await resolveSupervisorIdentifiers(String(supervisorId || ""));

    const student = await UserModel.findById(id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const reportIndex = student.quarterlyReports?.findIndex(r => r.id === reportId);
    if (reportIndex === undefined || reportIndex === -1) return res.status(404).json({ message: "Report not found" });

    const report = student.quarterlyReports?.[reportIndex];
    const supervisorSlot = resolveSupervisorSlot(student, identifiers);

    if (!supervisorSlot || supervisorSlot !== role) {
      return res.status(403).json({ message: "Supervisor is not assigned to this report slot" });
    }

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    report.approvals[role as keyof typeof report.approvals] = action === "approved" ? "approved" : "returned";
    report.comment = comment || "";
    report.reviewTrail = [
      ...(report.reviewTrail || []),
      {
        role,
        actor: supervisorSlot.toUpperCase(),
        action,
        comment: comment || "",
        at: new Date(),
      },
    ];

    if (action === "returned") {
      report.status = "returned";
      report.approvals.dean = "pending";
    } else {
      const requiredRoles = requiredSupervisorRoles(student);
      const allSupervisorsApproved = requiredRoles.every(
        (requiredRole) =>
          report.approvals[requiredRole as keyof typeof report.approvals] === "approved",
      );
      report.status = allSupervisorsApproved ? "pending_dean" : "pending";
    }

    student.markModified("quarterlyReports");
    await student.save();
    res.json({ message: `Report ${action} by ${role}`, student });
  } catch (error) {
    res.status(500).json({ message: "Error approving quarterly report", error });
  }
});

import { SystemSettingsModel } from "../models/system-settings.model.js";

// 8. Smart Stage Suggestion & Global Rule Application
SupervisorRouter.post("/students/:id/automation/suggest", async (req: Request, res: Response) => {
  try {
    const student = await UserModel.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const settings = await SystemSettingsModel.findOne();
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

    const currentStageIdx = STAGES.indexOf(student.stage || "Coursework");
    let suggestedStage = student.stage;
    let aiFlags = [];

    const score = student.documents?.proposalScore || 0;
    const threshold = settings?.minProposalScore || 60;
    if (student.stage === "Proposal (School)" && score < threshold) {
       aiFlags.push(`Warning: Proposal score below required ${threshold}% threshold.`);
    }

    // 2. Lifecycle Stage Access Rules
    if (settings?.autoCourseworkCompletion && student.stage === "Coursework" && student.financialClearance) {
      suggestedStage = "Concept Note (Department)";
      aiFlags.push("Auto-advancing: Coursework verified + Financial clearance detected.");
    }

    // Standard progression suggestions based on document status
    if (student.stage === "Concept Note (Department)" && student.documents?.conceptNote === "approved") {
      suggestedStage = "Concept Note (School)";
    } else if (student.stage === "Proposal (Department)" && student.documents?.proposal === "approved") {
      suggestedStage = "Proposal (School)";
    }

    // Check for bottlenecks
    if (student.status === "Active" && student.atRisk) {
       aiFlags.push("High risk of delay - bottleneck detected");
    }

    const updatedStudent = await UserModel.findByIdAndUpdate(req.params.id, {
      $set: {
        "automation.suggestedStage": suggestedStage,
        "automation.aiFlags": aiFlags,
        "automation.lastAutoCheck": new Date()
      }
    }, { new: true });

    res.json({ message: "Auto-check complete", student: updatedStudent });
  } catch (error) {
    res.status(500).json({ message: "Error running automation check", error });
  }
});
