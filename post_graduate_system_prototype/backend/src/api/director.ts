import { Router, type Request, type Response } from "express";
import { UserModel } from "../models/user.model.js";
import { SupervisorAssignmentModel } from "../models/supervisor-action.model.js";
import { SystemSettingsModel } from "../models/system-settings.model.js";
import { ReportModel } from "../models/report.model.js";
import { bookingsModel } from "../models/student.bookings.js";

export const DirectorRouter = Router();

// 1. GET /dashboard/stats
DirectorRouter.get("/dashboard/stats", async (req: Request, res: Response) => {
  try {
    const students = await UserModel.find({ role: "student" });
    const stats = {
      totalStudents: students.length,
      activeStudents: students.filter((s) => s.status === "Active").length,
      stalledStudents: students.filter((s) => s.atRisk).length,
      pendingClearances: students.filter((s) => !s.financialClearance).length,
      departmentStats: {
        CJM: students.filter((s) => s.department?.toUpperCase() === "CJM")
          .length,
        IHRS: students.filter((s) => s.department?.toUpperCase() === "IHRS")
          .length,
      },
      stageDistribution: students.reduce((acc: any, s) => {
        const stage = s.stage || "Coursework";
        acc[stage] = (acc[stage] || 0) + 1;
        return acc;
      }, {}),
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: "Error fetching stats", error });
  }
});

// 2. GET /students
DirectorRouter.get("/students", async (req: Request, res: Response) => {
  try {
    const { q, stage, department, status } = req.query;
    const filter: any = { role: "student" };

    if (q) filter.fullName = { $regex: q, $options: "i" };
    if (stage) filter.stage = stage;
    if (department) filter.department = department.toString().toLowerCase();
    if (status) filter.status = status;

    const students = await UserModel.find(filter);
    res.json(students);
  } catch (error) {
    res.status(500).json({ message: "Error fetching students", error });
  }
});

// 3. GET /students/:id
DirectorRouter.get("/students/:id", async (req: Request, res: Response) => {
  try {
    const student = await UserModel.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    res.json(student);
  } catch (error) {
    res.status(500).json({ message: "Error fetching student details", error });
  }
});

// 4. POST /students/:id/stage
DirectorRouter.post(
  "/students/:id/stage",
  async (req: Request, res: Response) => {
    try {
      const { stage, mode, reason } = req.body;
      const student = await UserModel.findById(req.params.id);
      if (!student)
        return res.status(404).json({ message: "Student not found" });

      // Block if student is deferred (Section 2.1)
      if (student.status === "Deferred") {
        return res
          .status(403)
          .json({
            message:
              "Pipeline tracking paused for deferred students. Please record a Resumption first.",
          });
      }

      // GATE ENFORCEMENT (Section 4.3)
      const reports = await ReportModel.find({ owner: student.userNumber });
      const approvedReports = reports.filter(
        (r) => r.status === "approved",
      ).length;

      // Block Proposal (School) if no reports
      if (stage === "Proposal (School)" && approvedReports === 0) {
        return res
          .status(403)
          .json({
            message:
              "Quarterly report required before School Proposal presentation.",
          });
      }

      // Block External Examination Submission if not ALL reports approved
      if (stage === "External Examination Submission") {
        if (approvedReports < 2) {
          // Masters Year 2 needs at least 2 reports according to Sem 3/4 mapping.
          return res
            .status(403)
            .json({
              message:
                "All quarterly reports must be approved before External Examination Submission.",
            });
        }
      }

      const updated = await UserModel.findByIdAndUpdate(
        req.params.id,
        { stage },
        { new: true },
      );
      res.json({ message: "Stage updated", student: updated });
    } catch (error) {
      res.status(500).json({ message: "Error updating stage", error });
    }
  },
);

// 4.1 POST /students/:id/status
DirectorRouter.post(
  "/students/:id/status",
  async (req: Request, res: Response) => {
    try {
      const { status, reason, plannedResumption } = req.body;
      const student = await UserModel.findById(req.params.id);
      if (!student)
        return res.status(404).json({ message: "Student not found" });

      const update: any = { status };

      // Deferral Snapshot (Section 2.1)
      if (status === "Deferred") {
        update.deferralInfo = {
          date: new Date(),
          reason: reason || "Administrative",
          plannedResumption,
          stageAtDeferral: student.stage || "Coursework",
        };
      } else if (status === "Resumed") {
        update["deferralInfo.actualResumption"] = new Date();
      }

      const updated = await UserModel.findByIdAndUpdate(
        req.params.id,
        { $set: update },
        { new: true },
      );
      res.json({ message: "Status updated", student: updated });
    } catch (error) {
      res.status(500).json({ message: "Error updating status", error });
    }
  },
);

// Update student documents (e.g., NACOSTI)
DirectorRouter.post(
  "/students/:id/documents",
  async (req: Request, res: Response) => {
    try {
      const { type, status } = req.body;
      const student = await UserModel.findById(req.params.id);
      if (!student) return res.status(404).json({ message: "Not found" });

      if (!student.documents) {
        student.documents = {
          conceptNote: "pending",
          proposal: "pending",
          thesis: "pending",
          nacosti: "pending",
          journalPaper: "pending",
          mentorship: "pending",
        };
      }

      if (type === "nacosti") {
        student.documents.nacosti = status;
        student.markModified("documents");
      } else if (type === "thesis") {
        student.documents.thesis = status;
        student.markModified("documents");

        // Auto-advance stage if thesis is approved
        if (status === "approved") {
          student.stage = "Graduation";
        }
      }

      await student.save();
      res.json({ success: true, student });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Error updating documents" });
    }
  },
);

// Specialized route for thesis outcome with remarks
DirectorRouter.post(
  "/students/:id/thesis/outcome",
  async (req: Request, res: Response) => {
    try {
      const { status, remarks } = req.body; // status: "approved" | "rejected"
      const student = await UserModel.findById(req.params.id);
      if (!student)
        return res.status(404).json({ message: "Student not found" });

      if (!student.documents) {
        student.documents = {
          conceptNote: "pending",
          proposal: "pending",
          thesis: "pending",
          nacosti: "pending",
          journalPaper: "pending",
          mentorship: "pending",
        };
      }

      student.documents.thesis = status;
      student.markModified("documents");

      if (remarks) {
        student.notes = student.notes || [];
        student.notes.push(
          `Thesis ${status}: ${remarks} (Date: ${new Date().toLocaleDateString()})`,
        );
      }

      if (status === "approved") {
        student.stage = "Graduation";
        student.status = "Completed";

        // Update booking status to completed
        await bookingsModel.findOneAndUpdate(
          {
            ownerId: student._id.toString(),
            status: { $in: ["cancelled", "pending", "confirmed"] },
          },
          { $set: { status: "completed" } },
        );
      } else if (status === "rejected") {
        // Update booking status to cancelled/rejected
        await bookingsModel.findOneAndUpdate(
          {
            ownerId: student._id.toString(),
            status: { $in: ["pending", "confirmed"] },
          },
          {
            $set: {
              status: "cancelled",
              cancellationReason: remarks || "Thesis rejected by director",
            },
          },
        );
      }

      await student.save();
      res.json({
        success: true,
        message: `Thesis ${status} successfully`,
        student,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error updating thesis outcome", error });
    }
  },
);

// 5. POST /students/:id/supervisors
DirectorRouter.post(
  "/students/:id/supervisors",
  async (req: Request, res: Response) => {
    try {
      const { sup1, sup2, sup3 } = req.body;
      const studentToUpdate = await UserModel.findById(req.params.id);
      if (!studentToUpdate)
        return res.status(404).json({ message: "Student not found" });

      // SUPERVISOR COUNT ENFORCEMENT (Section 6.3)
      if (studentToUpdate.programme === "msc" && sup3) {
        return res
          .status(400)
          .json({
            message:
              "Masters students only require 2 supervisors. Please remove Supervisor 3.",
          });
      }
      if (studentToUpdate.programme === "phd" && (!sup1 || !sup2 || !sup3)) {
        return res
          .status(400)
          .json({
            message:
              "PhD students require exactly 3 supervisors. Please assign Supervisor 3.",
          });
      }

      const settings = await SystemSettingsModel.findOne();
      if (settings?.supervisorLockdown) {
        const STAGES = [
          "Coursework",
          "Concept Note (Department)",
          "Concept Note (School)",
          "Proposal (Department)",
          "Proposal (School)",
          "PG Approval",
          "Fieldwork",
          "Thesis Development",
          "External Examination",
          "Defense",
          "Graduation",
        ];
        const currentStageIdx = STAGES.indexOf(
          studentToUpdate.stage || "Coursework",
        );
        const fieldworkIdx = STAGES.indexOf("Fieldwork");

        if (currentStageIdx > fieldworkIdx) {
          return res
            .status(403)
            .json({
              message: "Supervisor assignment locked after Fieldwork stage.",
            });
        }
      }

      const student = await UserModel.findByIdAndUpdate(
        req.params.id,
        {
          supervisors: { sup1, sup2, sup3 },
        },
        { new: true },
      );
      res.json({ message: "Supervisors assigned", student });
    } catch (error) {
      res.status(500).json({ message: "Error assigning supervisors", error });
    }
  },
);

// 6. POST /students/:id/flag
DirectorRouter.post(
  "/students/:id/flag",
  async (req: Request, res: Response) => {
    try {
      const { atRisk, note } = req.body;
      const student = await UserModel.findByIdAndUpdate(
        req.params.id,
        {
          atRisk,
          $push: { notes: note },
        },
        { new: true },
      );
      res.json({ message: "Student flag updated", student });
    } catch (error) {
      res.status(500).json({ message: "Error flagging student", error });
    }
  },
);

// 7. GET /pipeline
DirectorRouter.get("/pipeline", async (req: Request, res: Response) => {
  try {
    const students = await UserModel.find({ role: "student" });
    // Structure for the Kanban board
    const pipeline = students.map((s) => ({
      id: s._id,
      name: s.fullName,
      regNo: s.userNumber,
      stage: s.stage || "Coursework",
      atRisk: s.atRisk,
      department: s.department,
    }));
    res.json(pipeline);
  } catch (error) {
    res.status(500).json({ message: "Error fetching pipeline", error });
  }
});
// 8. GET /supervisors
DirectorRouter.get("/supervisors", async (req: Request, res: Response) => {
  try {
    const { q, department, status } = req.query;
    const filter: any = { role: "supervisor" };

    if (q) filter.fullName = { $regex: q, $options: "i" };
    if (department) filter.department = department.toString().toLowerCase();
    if (status) filter.status = status;

    const supervisors = await UserModel.find(filter);
    res.json(supervisors);
  } catch (error) {
    res.status(500).json({ message: "Error fetching supervisors", error });
  }
});
// 9. POST /supervisors/:id/assign - FIXED to handle registration number
DirectorRouter.post(
  "/supervisors/:id/assign",
  async (req: Request, res: Response) => {
    try {
      const { studentId } = req.body;
      const supervisorId = req.params.id;

      if (!studentId) {
        return res.status(400).json({ message: "Student ID is required" });
      }

      // Get supervisor details
      const supervisor = await UserModel.findOne({
        _id: supervisorId,
        role: "supervisor",
      });

      if (!supervisor) {
        return res.status(404).json({ message: "Supervisor not found" });
      }

      // Get student details - try by _id first, then by userNumber
      let student;

      // Check if the input is a valid MongoDB ObjectId (24 character hex string)
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(studentId);

      if (isValidObjectId) {
        // Try to find by _id
        student = await UserModel.findOne({
          _id: studentId,
          role: "student",
        });
      }

      // If not found by _id or invalid ObjectId, try by userNumber
      if (!student) {
        student = await UserModel.findOne({
          userNumber: studentId,
          role: "student",
        });
      }

      if (!student) {
        return res.status(404).json({
          message:
            "Student not found. Please check the student ID or registration number.",
        });
      }

      // Check if student already has an active supervisor
      const existingAssignment = await SupervisorAssignmentModel.findOne({
        studentId: student._id.toString(),
        status: "active" as const,
      });

      if (existingAssignment) {
        return res.status(400).json({
          message: "Student already has an active supervisor assignment",
        });
      }
      const existsInactiveStudent = await SupervisorAssignmentModel.findOne({
        studentId: student._id.toString(),
        status: { $ne: "active" },
      });
      if (existsInactiveStudent) {
        await SupervisorAssignmentModel.findOneAndUpdate(
          {
            studentId: student._id.toString(),
          },

          {
            $set: {
              status: "active",
              supervisorName: supervisor.fullName,
              supervisorId: supervisor._id,
            },
          },
        );
      }
      // Check supervisor workload (dynamic cap)
      const settings = await SystemSettingsModel.findOne();
      const cap = settings?.supervisorStudentLimit || 8;

      const activeAssignments = await SupervisorAssignmentModel.countDocuments({
        supervisorId: supervisor._id.toString() as string,
        status: "active" as const,
      });

      if (activeAssignments >= cap) {
        return res.status(400).json({
          message: `Supervisor has reached maximum workload (${cap} students)`,
        });
      }
      let assignment;
      // Create the assignment
      if (!existsInactiveStudent) {
        assignment = await SupervisorAssignmentModel.create({
          supervisorId: supervisor._id.toString(),
          supervisorName: supervisor.fullName,
          studentId: student._id.toString(),
          studentName: student.fullName,
          studentRegNo: student.userNumber,
          assignedBy: "director",
          status: "active" as const,
          notes: [`Assigned on ${new Date().toLocaleDateString()}`],
        });
      }

      // Also update the student's supervisors field
      await UserModel.findByIdAndUpdate(student._id, {
        $set: {
          "supervisors.sup1": supervisor.fullName,
        },
      });

      res.json({
        message: "Student assigned successfully",
        assignment,
        workload: activeAssignments + 1,
        student: {
          id: student._id,
          name: student.fullName,
          regNo: student.userNumber,
        },
      });
    } catch (error) {
      console.error("Error assigning student:", error);
      res
        .status(500)
        .json({ message: "Error assigning student to supervisor", error });
    }
  },
);

// 10. POST /supervisors/:id/remove - FIXED
// 10. POST /supervisors/:id/remove - FIXED to handle registration number
DirectorRouter.post(
  "/supervisors/:id/remove",
  async (req: Request, res: Response) => {
    try {
      const { studentId } = req.body;
      const supervisorId = req.params.id;

      if (!studentId) {
        return res.status(400).json({ message: "Student ID is required" });
      }

      // First find the student (by _id or userNumber)
      let student;
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(studentId);

      if (isValidObjectId) {
        student = await UserModel.findOne({
          _id: studentId,
          role: "student",
        });
      }

      if (!student) {
        student = await UserModel.findOne({
          userNumber: studentId,
          role: "student",
        });
      }

      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      // Find and update the active assignment
      const assignment = await SupervisorAssignmentModel.findOneAndUpdate(
        {
          supervisorId: supervisorId as string,
          studentId: student._id.toString(),
          status: "active" as const,
        },
        {
          status: "transferred" as const,
          $push: { notes: `Removed on ${new Date().toLocaleDateString()}` },
        },
        { new: true },
      );

      if (!assignment) {
        return res.status(404).json({ message: "Active assignment not found" });
      }

      // Remove supervisor from student's record
      await UserModel.findByIdAndUpdate(student._id, {
        $set: {
          "supervisors.sup1": "",
        },
      });

      res.json({
        message: "Student removed successfully",
        assignment,
      });
    } catch (error) {
      console.error("Error removing student:", error);
      res
        .status(500)
        .json({ message: "Error removing student from supervisor", error });
    }
  },
);

// 11. POST /supervisors/:id/balance - FIXED
DirectorRouter.post(
  "/supervisors/:id/balance",
  async (req: Request, res: Response) => {
    try {
      const supervisorId = req.params.id;

      // Get all supervisors with their workloads
      const supervisors = await UserModel.find({
        role: "supervisor",
        status: "Active",
      });

      // Get workload counts for all supervisors - FIXED
      const workloads = await Promise.all(
        supervisors.map(async (sup) => {
          const count = await SupervisorAssignmentModel.countDocuments({
            supervisorId: sup._id.toString() as string,
            status: "active" as const,
          });
          return {
            supervisorId: sup._id.toString(),
            supervisorName: sup.fullName,
            workload: count,
          };
        }),
      );

      // Find the target supervisor's workload
      const targetSupervisor = workloads.find(
        (w) => w.supervisorId === supervisorId,
      );

      if (!targetSupervisor) {
        return res.status(404).json({ message: "Supervisor not found" });
      }

      // Calculate average workload
      const totalWorkload = workloads.reduce((sum, w) => sum + w.workload, 0);
      const averageWorkload = totalWorkload / workloads.length;

      // Get assignments for this supervisor - FIXED
      const assignments = await SupervisorAssignmentModel.find({
        supervisorId: supervisorId as string,
        status: "active" as const,
      });

      res.json({
        message: "Workload balance information",
        supervisor: {
          id: supervisorId,
          name: targetSupervisor.supervisorName,
          currentWorkload: targetSupervisor.workload,
          averageWorkload: Math.round(averageWorkload * 10) / 10,
          totalSupervisors: workloads.length,
          totalStudents: totalWorkload,
          assignments: assignments.map((a) => ({
            studentId: a.studentId,
            studentName: a.studentName,
            studentRegNo: a.studentRegNo,
            assignedAt: a.assignedAt,
          })),
        },
        recommendation:
          targetSupervisor.workload > averageWorkload + 2
            ? "Consider redistributing some students"
            : "Workload is balanced",
      });
    } catch (error) {
      console.error("Error getting balance info:", error);
      res
        .status(500)
        .json({ message: "Error getting workload balance", error });
    }
  },
);

// 12. GET /supervisors/:id/workload - FIXED
DirectorRouter.get(
  "/supervisors/:id/workload",
  async (req: Request, res: Response) => {
    try {
      const supervisorId = req.params.id;

      // FIXED: Add type assertions
      const assignments = await SupervisorAssignmentModel.find({
        supervisorId: supervisorId as string,
        status: "active" as const,
      });

      const completed = await SupervisorAssignmentModel.countDocuments({
        supervisorId: supervisorId as string,
        status: "completed" as const,
      });

      const transferred = await SupervisorAssignmentModel.countDocuments({
        supervisorId: supervisorId as string,
        status: "transferred" as const,
      });

      res.json({
        supervisorId,
        current: assignments.length,
        completed,
        transferred,
        total: assignments.length + completed + transferred,
        students: assignments.map((a) => ({
          id: a.studentId,
          name: a.studentName,
          regNo: a.studentRegNo,
          assignedAt: a.assignedAt,
        })),
      });
    } catch (error) {
      console.error("Error getting workload:", error);
      res
        .status(500)
        .json({ message: "Error fetching supervisor workload", error });
    }
  },
);

// Also update the GET /supervisors route to include workload data
DirectorRouter.get("/supervisors", async (req: Request, res: Response) => {
  try {
    const { q, department, status } = req.query;
    const filter: any = { role: "supervisor" };

    if (q) filter.fullName = { $regex: q, $options: "i" };
    if (department) filter.department = department.toString().toLowerCase();
    if (status) filter.status = status;

    const supervisors = await UserModel.find(filter);

    // Enhance supervisor data with workload information
    const enhancedSupervisors = await Promise.all(
      supervisors.map(async (sup) => {
        const studentCount = await SupervisorAssignmentModel.countDocuments({
          supervisorId: sup._id.toString() as string,
          status: "active" as const,
        });

        return {
          id: sup._id,
          _id: sup._id,
          fullName: sup.fullName,
          userNumber: sup.userNumber,
          department: sup.department,
          status: sup.status,
          isVerified: sup.isVerified,
          studentCount,
          pendingApprovals: 0, // You can implement this logic separately
        };
      }),
    );

    res.json(enhancedSupervisors);
  } catch (error) {
    res.status(500).json({ message: "Error fetching supervisors", error });
  }
});
