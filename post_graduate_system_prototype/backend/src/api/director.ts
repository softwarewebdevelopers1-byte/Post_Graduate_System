import { Router, type Request, type Response } from "express";
import { UserModel } from "../models/user.model.js";
import { NotificationModel } from "../models/notification.model.js";
import { SupervisorAssignmentModel } from "../models/supervisor-action.model.js";
import { SystemSettingsModel } from "../models/system-settings.model.js";
import { ReportModel } from "../models/report.model.js";
import { bookingsModel } from "../models/student.bookings.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import fs from "fs";
import { readFile } from "fs/promises";
import { StorageClient } from "@supabase/storage-js";

export const DirectorRouter = Router();

const complianceStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "compliance");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `compliance-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const complianceUpload = multer({
  storage: complianceStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
      return;
    }
    cb(new Error("Only PDF files are allowed"));
  },
});

const getAuthUser = (req: Request, res: Response): Promise<any | null> => {
  return new Promise((resolve) => {
    const token = req.cookies?.userToken;
    const jwtSecret = process.env.JWT_SECRET;

    if (!token || !jwtSecret) {
      res.status(401).json({ message: "Unauthorized access" });
      resolve(null);
      return;
    }

    jwt.verify(token, jwtSecret, (err: any, decoded: any) => {
      if (err) {
        res.status(401).json({ message: "Invalid or expired token" });
        resolve(null);
        return;
      }
      resolve(decoded);
    });
  });
};

function buildSupabaseStorageClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;

  if (!serviceKey || !supabaseUrl) {
    throw new Error("Missing Supabase credentials");
  }

  const baseUrl = supabaseUrl.startsWith("http")
    ? supabaseUrl.replace(/\/+$/, "")
    : `https://${supabaseUrl}.supabase.co`;

  const storageUrl = `${baseUrl}/storage/v1`;
  return new StorageClient(storageUrl, {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  });
}
function complianceBucketName() {
  return (
    process.env.SUPABASE_COMPLIANCE_BUCKET ||
    process.env.SUPABASE_BUCKET ||
    "campusHub_PDF"
  );
}
function localComplianceFileUrl(req: Request, fileName: string) {
  const protocol = req.headers["x-forwarded-proto"]?.toString() || req.protocol;
  const host = req.get("host") || "";
  return `${protocol}://${host}/uploads/compliance/${encodeURIComponent(fileName)}`;
}

async function enrichComplianceUpload(entry: any, storageClient?: StorageClient | null) {
  const upload = entry?.upload || entry;
  const bucket = upload?.bucket || complianceBucketName();
  const storagePath = upload?.storagePath || "";
  let resolvedUrl = upload?.url || "";

  if (storageClient && storagePath) {
    const { data, error } = await storageClient
      .from(bucket)
      .createSignedUrl(storagePath, 60 * 60);

    if (!error && data?.signedUrl) {
      resolvedUrl = data.signedUrl;
    }
  }

  const enrichedUpload = {
    ...upload,
    url: resolvedUrl,
    bucket,
  };

  if (entry?.upload) {
    return { ...entry, upload: enrichedUpload };
  }

  return enrichedUpload;
}

function latestComplianceUploadByType(uploads: any[] = [], matcher: (type: string) => boolean) {
  return [...uploads]
    .filter((entry: any) => matcher(String(entry?.type || "")))
    .sort(
      (a: any, b: any) =>
        new Date(b?.submittedAt || 0).getTime() - new Date(a?.submittedAt || 0).getTime(),
    )[0] || null;
}

async function attachComplianceDocuments(student: any, storageClient?: StorageClient | null) {
  if (!student) return student;

  const rawUploads = Array.isArray(student.complianceUploads) ? student.complianceUploads : [];
  const uploads = await Promise.all(
    rawUploads.map((entry: any) => enrichComplianceUpload(entry, storageClient)),
  );

  const latestProposal = latestComplianceUploadByType(uploads, (type) =>
    type.toLowerCase().includes("proposal"),
  );
  const latestNacosti = latestComplianceUploadByType(uploads, (type) =>
    type.toLowerCase().includes("nacosti"),
  );
  const latestOther = latestComplianceUploadByType(uploads, (type) =>
    type.toLowerCase().includes("other"),
  );

  const baseDocuments = student.documents?.toObject?.() || student.documents || {};

  return {
    ...student.toObject(),
    complianceUploads: uploads,
    documents: {
      ...baseDocuments,
      proposalFile: latestProposal
        ? {
            status: "Submitted",
            url: latestProposal.url,
            title: latestProposal.title,
          }
        : null,
      nacostiPermit: latestNacosti
        ? {
            status: "Submitted",
            url: latestNacosti.url,
            title: latestNacosti.title,
          }
        : null,
      otherCompliance: latestOther
        ? {
            status: "Submitted",
            url: latestOther.url,
            title: latestOther.title,
          }
        : null,
    },
  };
}

function requiredSupervisorRoles(student: any) {
  return ["sup1", "sup2"];
}

function nextQuarterForStudent(student: any) {
  const reports = Array.isArray(student?.quarterlyReports) ? student.quarterlyReports : [];
  if (!reports.length) return 1;

  const highestQuarter = reports.reduce((max: number, report: any) => {
    return Math.max(max, Number(report?.quarter || 0));
  }, 0);

  const latestForHighest = reports.find((report: any) => Number(report?.quarter || 0) === highestQuarter);
  if (latestForHighest && latestForHighest.status !== "approved") {
    return highestQuarter;
  }

  return highestQuarter + 1;
}

async function createQuarterlyReportNotifications(student: any, report: any) {
  const supervisorNames = [student?.supervisors?.sup1, student?.supervisors?.sup2, student?.supervisors?.sup3]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const supervisors = supervisorNames.length
    ? await UserModel.find({
        role: "supervisor",
        fullName: { $in: supervisorNames },
      }).select("_id role fullName")
    : [];

  const directors = await UserModel.find({
    role: { $in: ["director", "admin"] },
  }).select("_id role fullName");

  const notifications = [
    ...supervisors.map((user) => ({
      recipientId: String(user._id),
      recipientRole: String(user.role || "supervisor"),
      type: "quarterly_report_submitted",
      title: "Quarterly Report Submitted",
      message: `${student.fullName} (${student.userNumber}) submitted Q${report.quarter} ${report.year}. Your review is required.`,
      studentId: String(student._id),
      studentName: student.fullName,
      studentNumber: student.userNumber,
      reportId: String(report.id || ""),
      read: false,
    })),
    ...directors.map((user) => ({
      recipientId: String(user._id),
      recipientRole: String(user.role || "director"),
      type: "quarterly_report_submitted",
      title: "Quarterly Report Submitted",
      message: `${student.fullName} (${student.userNumber}) submitted Q${report.quarter} ${report.year}. Supervisor and director visibility updated.`,
      studentId: String(student._id),
      studentName: student.fullName,
      studentNumber: student.userNumber,
      reportId: String(report.id || ""),
      read: false,
    })),
  ];

  if (notifications.length) {
    await NotificationModel.insertMany(notifications);
  }
}

// 1. GET /dashboard/stats
DirectorRouter.get("/dashboard/stats", async (req: Request, res: Response) => {
  try {
    const decoded = await getAuthUser(req, res);
    if (!decoded) return;
    const students = await UserModel.find({ role: "student" });
    const notifications = await NotificationModel.find({
      recipientId: String(decoded.id),
      recipientRole: { $in: ["director", "admin"] },
      read: false,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
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
      alerts: notifications.map((notification: any) => ({
        title: notification.title,
        message: notification.message,
        severity: "warning",
        href: notification.studentId
          ? `./student-details.html?id=${encodeURIComponent(notification.studentId)}`
          : "./reports.html",
      })),
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

    let storageClient: StorageClient | null = null;
    try {
      storageClient = buildSupabaseStorageClient();
    } catch (error) {
      console.error("Student details compliance storage setup error:", error);
    }

    const resolvedStudent = await attachComplianceDocuments(student, storageClient);
    res.json(resolvedStudent);
  } catch (error) {
    res.status(500).json({ message: "Error fetching student details", error });
  }
});

DirectorRouter.put("/students/:id", async (req: Request, res: Response) => {
  try {
    const { fullName, userNumber, programme, department, year, mentor, supervisor, supervisor2 } = req.body;
    const student = await UserModel.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    if (!fullName || !userNumber || !programme || !department || !year) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    const existingUser = await UserModel.findOne({
      userNumber,
      _id: { $ne: req.params.id },
    });

    if (existingUser) {
      return res.status(409).json({ message: "userNumber already registered" });
    }

    const nextSup1 = String(supervisor || "").trim();
    const nextSup2 = String(supervisor2 || "").trim();
    const currentSup1 = String(student.supervisors?.sup1 || "").trim();
    const currentSup2 = String(student.supervisors?.sup2 || "").trim();

    student.fullName = fullName;
    student.userNumber = userNumber;
    student.programme = String(programme).toLowerCase();
    student.department = String(department).toLowerCase();
    student.year = year;
    student.mentor = mentor || "";
    student.supervisors = {
      ...student.supervisors,
      sup1: nextSup1 || student.supervisors?.sup1 || "",
      sup2: nextSup2 || student.supervisors?.sup2 || "",
    };
    student.assignmentStatus = {
      ...student.assignmentStatus,
      sup1: nextSup1
        ? (nextSup1 !== currentSup1 ? "pending" : student.assignmentStatus?.sup1 || "pending")
        : student.assignmentStatus?.sup1 || "pending",
      sup2: nextSup2
        ? (nextSup2 !== currentSup2 ? "pending" : student.assignmentStatus?.sup2 || "pending")
        : student.assignmentStatus?.sup2 || "pending",
    };

    await student.save();
    res.json({ message: "Student updated successfully", student });
  } catch (error) {
    res.status(500).json({ message: "Error updating student", error });
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
      const mentorshipCompleted =
        String(student.documents?.mentorship || "").toLowerCase() === "approved";
      const mentorAssigned = Boolean(String(student.mentor || "").trim());
      const supervisor1Assigned = Boolean(String(student.supervisors?.sup1 || "").trim());
      const supervisor2Assigned = Boolean(String(student.supervisors?.sup2 || "").trim());
      const supervisor1Accepted =
        String(student.assignmentStatus?.sup1 || "").toLowerCase() === "accepted";
      const supervisor2Accepted =
        String(student.assignmentStatus?.sup2 || "").toLowerCase() === "accepted";

      if (stage === "Concept Note (Department)") {
        if (!mentorAssigned) {
          return res.status(403).json({
            message: "Assign a mentor before moving the student to Concept Note (Department).",
          });
        }

        if (!mentorshipCompleted) {
          return res.status(403).json({
            message: "Mentorship must be marked approved before Concept Note (Department).",
          });
        }
      }

      if (["Concept Note (School)", "Proposal (Department)", "Proposal (School)"].includes(stage)) {
        if (!supervisor1Assigned || !supervisor2Assigned) {
          return res.status(403).json({
            message: "Both supervisors must be assigned before this stage can be reached.",
          });
        }

        if (!supervisor1Accepted || !supervisor2Accepted) {
          return res.status(403).json({
            message: "Both supervisors must accept the assignment before this stage can be reached.",
          });
        }
      }

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

DirectorRouter.post(
  "/students/me/deferral-request",
  async (req: Request, res: Response) => {
    try {
      const decoded = await getAuthUser(req, res);
      if (!decoded) return;

      const { reason, plannedResumption } = req.body;
      if (!reason || !plannedResumption) {
        return res.status(400).json({
          message: "Reason and planned resumption are required",
        });
      }

      const student = await UserModel.findById(decoded.id);
      if (!student || student.role !== "student") {
        return res.status(404).json({ message: "Student not found" });
      }

      if (student.status === "Deferred") {
        return res.status(400).json({ message: "Student is already deferred" });
      }

      if (student.deferralRequest?.status === "pending") {
        return res.status(400).json({ message: "There is already a pending deferral request" });
      }

      student.deferralRequest = {
        type: "deferral",
        status: "pending",
        submittedAt: new Date(),
        reason,
        plannedResumption,
        reviewComment: "",
        reviewedBy: "",
      };

      await student.save();
      return res.status(201).json({
        success: true,
        message: "Deferral request submitted",
        student,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error submitting deferral request", error });
    }
  },
);

DirectorRouter.get(
  "/students/me/qreports",
  async (req: Request, res: Response) => {
    try {
      const decoded = await getAuthUser(req, res);
      if (!decoded) return;

      const student = await UserModel.findById(decoded.id).select(
        "role programme status quarterlyReports supervisors",
      );
      if (!student || student.role !== "student") {
        return res.status(404).json({ message: "Student not found" });
      }

      const reports = [...(student.quarterlyReports || [])].sort((a, b) => {
        if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
        return (b.quarter || 0) - (a.quarter || 0);
      });

      return res.json({
        success: true,
        reports,
        nextQuarter: nextQuarterForStudent(student),
        programme: student.programme,
        status: student.status,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error fetching quarterly reports", error });
    }
  },
);

DirectorRouter.get(
  "/qreports/board",
  async (req: Request, res: Response) => {
    try {
      const decoded = await getAuthUser(req, res);
      if (!decoded) return;
      if (!["director", "admin"].includes(decoded.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { status, q } = req.query;
      const students = await UserModel.find({
        role: "student",
        quarterlyReports: { $exists: true, $ne: [] },
      }).select("fullName userNumber programme department quarterlyReports");

      let reports = students.flatMap((student) =>
        (student.quarterlyReports || []).map((report) => ({
          studentId: String(student._id),
          studentName: student.fullName,
          studentNumber: student.userNumber,
          programme: student.programme,
          department: student.department,
          report,
        })),
      );

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

      return res.json({ success: true, reports });
    } catch (error) {
      return res.status(500).json({ message: "Error fetching quarterly reports board", error });
    }
  },
);

DirectorRouter.post(
  "/students/me/qreports",
  async (req: Request, res: Response) => {
    try {
      const decoded = await getAuthUser(req, res);
      if (!decoded) return;

      const student = await UserModel.findById(decoded.id);
      if (!student || student.role !== "student") {
        return res.status(404).json({ message: "Student not found" });
      }

      if (student.status === "Deferred") {
        return res.status(403).json({
          message: "Quarterly reporting is paused while the student is deferred",
        });
      }

      const {
        quarter,
        year,
        progressSummary,
        objectivesAchieved,
        challengesAndMitigation,
        nextQuarterPlan,
      } = req.body || {};

      if (!progressSummary || !objectivesAchieved || !challengesAndMitigation || !nextQuarterPlan) {
        return res.status(400).json({ message: "All quarterly report fields are required" });
      }

      const reportQuarter = Number(quarter) || nextQuarterForStudent(student);
      const reportYear = Number(year) || new Date().getFullYear();
      const existingIndex = student.quarterlyReports?.findIndex(
        (report) => report.quarter === reportQuarter && report.year === reportYear,
      ) ?? -1;
      const roles = requiredSupervisorRoles(student);

      if (existingIndex >= 0) {
        const existingReport = student.quarterlyReports?.[existingIndex];
        if (existingReport?.status && existingReport.status !== "returned") {
          return res.status(400).json({
            message: `A report for Q${reportQuarter} ${reportYear} already exists`,
          });
        }

        if (student.quarterlyReports && existingReport) {
          existingReport.status = "pending";
          existingReport.comment = "";
          existingReport.submittedAt = new Date();
          existingReport.progressSummary = progressSummary;
          existingReport.objectivesAchieved = objectivesAchieved;
          existingReport.challengesAndMitigation = challengesAndMitigation;
          existingReport.nextQuarterPlan = nextQuarterPlan;
          existingReport.approvals = {
            sup1: roles.includes("sup1") ? "pending" : "approved",
            sup2: roles.includes("sup2") ? "pending" : "approved",
            sup3: "approved",
            dean: "pending",
            finance: "pending",
          };
          existingReport.reviewTrail = [
            ...(existingReport.reviewTrail || []),
            {
              role: "student",
              actor: student.fullName,
              action: "resubmitted",
              comment: "Quarterly report resubmitted",
              at: new Date(),
            },
          ];
        }
      } else {
        student.quarterlyReports = student.quarterlyReports || [];
        student.quarterlyReports.push({
          id: new mongoose.Types.ObjectId().toString(),
          quarter: reportQuarter,
          year: reportYear,
          status: "pending",
          comment: "",
          submittedAt: new Date(),
          progressSummary,
          objectivesAchieved,
          challengesAndMitigation,
          nextQuarterPlan,
          approvals: {
            sup1: roles.includes("sup1") ? "pending" : "approved",
            sup2: roles.includes("sup2") ? "pending" : "approved",
            sup3: "approved",
            dean: "pending",
            finance: "pending",
          },
          reviewTrail: [
            {
              role: "student",
              actor: student.fullName,
              action: "submitted",
              comment: "Quarterly report submitted",
              at: new Date(),
            },
          ],
        });
      }

      student.markModified("quarterlyReports");
      await student.save();
      const submittedReport =
        student.quarterlyReports?.find(
          (report) => report.quarter === reportQuarter && report.year === reportYear,
        ) || student.quarterlyReports?.[student.quarterlyReports.length - 1];

      if (submittedReport) {
        await createQuarterlyReportNotifications(student, submittedReport);
      }

      return res.status(201).json({
        success: true,
        message: "Quarterly report submitted successfully",
        reports: student.quarterlyReports,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error submitting quarterly report", error });
    }
  },
);

DirectorRouter.get(
  "/notifications/my",
  async (req: Request, res: Response) => {
    try {
      const decoded = await getAuthUser(req, res);
      if (!decoded) return;

      const notifications = await NotificationModel.find({
        recipientId: String(decoded.id),
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      return res.json({ success: true, notifications });
    } catch (error) {
      return res.status(500).json({ message: "Error fetching notifications", error });
    }
  },
);

DirectorRouter.get(
  "/deferral-requests",
  async (req: Request, res: Response) => {
    try {
      const [requests, deferredStudents] = await Promise.all([
        UserModel.find({
          role: "student",
          "deferralRequest.status": "pending",
        }).select("fullName userNumber programme department stage status deferralRequest deferralInfo"),
        UserModel.find({
          role: "student",
          status: "Deferred",
        }).select("fullName userNumber programme department stage status deferralRequest deferralInfo"),
      ]);

      return res.json({ success: true, requests, deferredStudents });
    } catch (error) {
      return res.status(500).json({ message: "Error fetching deferral requests", error });
    }
  },
);

DirectorRouter.post(
  "/students/me/resumption-request",
  async (req: Request, res: Response) => {
    try {
      const decoded = await getAuthUser(req, res);
      if (!decoded) return;

      const student = await UserModel.findById(decoded.id);
      if (!student || student.role !== "student") {
        return res.status(404).json({ message: "Student not found" });
      }

      if (student.status !== "Deferred") {
        return res.status(400).json({ message: "Only deferred students can request resumption" });
      }

      if (student.deferralRequest?.status === "pending") {
        return res.status(400).json({ message: "There is already a pending request" });
      }

      student.deferralRequest = {
        type: "resumption",
        status: "pending",
        submittedAt: new Date(),
        reason: "Resumption request",
        plannedResumption: student.deferralInfo?.plannedResumption || "",
        reviewComment: "",
        reviewedBy: "",
      };

      await student.save();
      return res.status(201).json({
        success: true,
        message: "Resumption request submitted",
        student,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error submitting resumption request", error });
    }
  },
);

DirectorRouter.post(
  "/students/:id/deferral-review",
  async (req: Request, res: Response) => {
    try {
      const decoded = await getAuthUser(req, res);
      if (!decoded) return;
      if (!["director", "admin"].includes(decoded.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { action, comment } = req.body;
      if (!["approve", "reject"].includes(action)) {
        return res.status(400).json({ message: "Action must be approve or reject" });
      }

      const student = await UserModel.findById(req.params.id);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }
      if (!student.deferralRequest || student.deferralRequest.status !== "pending") {
        return res.status(400).json({ message: "No pending deferral request found" });
      }

      student.deferralRequest.status = action === "approve" ? "approved" : "rejected";
      student.deferralRequest.reviewedAt = new Date();
      student.deferralRequest.reviewComment = comment || "";
      student.deferralRequest.reviewedBy = decoded.id;

      if (action === "approve") {
        if (student.deferralRequest.type === "resumption") {
          student.status = "Resumed";
          student.deferralInfo = {
            ...(student.deferralInfo || {}),
            actualResumption: new Date(),
          };
        } else {
          student.status = "Deferred";
          student.deferralInfo = {
            date: new Date(),
            reason: student.deferralRequest.reason || "Administrative",
            plannedResumption: student.deferralRequest.plannedResumption || "",
            stageAtDeferral: student.stage || "Coursework",
          };
        }
      }

      await student.save();
      return res.json({
        success: true,
        message: `Deferral request ${action}d`,
        student,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error reviewing deferral request", error });
    }
  },
);

DirectorRouter.get(
  "/students/me/compliance",
  async (req: Request, res: Response) => {
    try {
      const decoded = await getAuthUser(req, res);
      if (!decoded) return;

      const student = await UserModel.findById(decoded.id).select("role complianceUploads status department programme fullName userNumber");
      if (!student || student.role !== "student") {
        return res.status(404).json({ message: "Student not found" });
      }

      let storageClient: StorageClient | null = null;
      try {
        storageClient = buildSupabaseStorageClient();
      } catch (error) {
        console.error("Compliance history storage setup error:", error);
      }

      const uploads = await Promise.all(
        [...(student.complianceUploads || [])]
          .sort(
            (a: any, b: any) =>
              new Date(b?.submittedAt || 0).getTime() - new Date(a?.submittedAt || 0).getTime(),
          )
          .map((entry: any) => enrichComplianceUpload(entry, storageClient)),
      );

      return res.json({
        success: true,
        uploads,
        status: student.status,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error fetching compliance uploads", error });
    }
  },
);

DirectorRouter.get(
  "/students/me/thesis-intent",
  async (req: Request, res: Response) => {
    try {
      const decoded = await getAuthUser(req, res);
      if (!decoded) return;

      const student = await UserModel.findById(decoded.id).select(
        "role fullName userNumber programme department supervisors thesisSubmissionIntent email",
      );
      if (!student || student.role !== "student") {
        return res.status(404).json({ message: "Student not found" });
      }

      return res.json({
        success: true,
        intent: student.thesisSubmissionIntent || null,
        student: {
          fullName: student.fullName,
          userNumber: student.userNumber,
          programme: student.programme,
          department: student.department,
          supervisorName: student.supervisors?.sup1 || "",
          coSupervisorName: student.supervisors?.sup2 || "",
          email: (student as any).email || "",
        },
      });
    } catch (error) {
      return res.status(500).json({ message: "Error fetching thesis intent", error });
    }
  },
);

DirectorRouter.post(
  "/students/me/thesis-intent",
  async (req: Request, res: Response) => {
    try {
      const decoded = await getAuthUser(req, res);
      if (!decoded) return;

      const student = await UserModel.findById(decoded.id);
      if (!student || student.role !== "student") {
        return res.status(404).json({ message: "Student not found" });
      }

      const thesisTitle = String(req.body?.thesisTitle || "").trim();
      const submissionCategory = String(req.body?.submissionCategory || "").trim();
      const targetSubmissionDate = String(req.body?.targetSubmissionDate || "").trim();
      const phoneNumber = String(req.body?.phoneNumber || "").trim();
      const email = String(req.body?.email || "").trim();
      const supervisorName = String(req.body?.supervisorName || "").trim();
      const coSupervisorName = String(req.body?.coSupervisorName || "").trim();
      const notes = String(req.body?.notes || "").trim();

      if (!thesisTitle || !submissionCategory || !targetSubmissionDate) {
        return res.status(400).json({
          message: "Thesis title, submission category, and target date are required",
        });
      }

      student.thesisSubmissionIntent = {
        thesisTitle,
        submissionCategory,
        targetSubmissionDate,
        phoneNumber,
        email: email || (student as any).email || "",
        supervisorName: supervisorName || student.supervisors?.sup1 || "",
        coSupervisorName: coSupervisorName || student.supervisors?.sup2 || "",
        notes,
        submittedAt: student.thesisSubmissionIntent?.submittedAt || new Date(),
        updatedAt: new Date(),
        status: "submitted",
      };

      student.markModified("thesisSubmissionIntent");
      await student.save();

      return res.status(201).json({
        success: true,
        message: "Intent to submit saved successfully",
        intent: student.thesisSubmissionIntent,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error saving thesis intent", error });
    }
  },
);

DirectorRouter.post(
  "/students/me/compliance",
  complianceUpload.single("documentFile"),
  async (req: Request, res: Response) => {
    let localFilePath: string | null = null;
    try {
      const decoded = await getAuthUser(req, res);
      if (!decoded) return;

      const student = await UserModel.findById(decoded.id);
      if (!student || student.role !== "student") {
        return res.status(404).json({ message: "Student not found" });
      }

      const type = String(req.body?.type || "").trim();
      const note = String(req.body?.note || "").trim();
      if (!type) {
        return res.status(400).json({ message: "Document type is required" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Please upload a PDF document" });
      }

      localFilePath = req.file.path;
      const safeOriginalName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const bucket = complianceBucketName();
      const objectKey = `compliance/${student._id}/${Date.now()}-${safeOriginalName}`;
      let storageClient: StorageClient | null = null;
      let signed = {
        id: new mongoose.Types.ObjectId().toString(),
        type,
        title: req.file.originalname,
        url: localComplianceFileUrl(req, req.file.filename),
        storagePath: "",
        bucket: "",
        mimeType: req.file.mimetype || "application/pdf",
        fileSize: req.file.size || 0,
        note,
        submittedAt: new Date(),
      };

      try {
        storageClient = buildSupabaseStorageClient();
        const fileBuffer = await readFile(localFilePath);
        const { error: uploadError } = await storageClient
          .from(bucket)
          .upload(objectKey, fileBuffer, {
            contentType: req.file.mimetype || "application/pdf",
            upsert: false,
          });

        if (uploadError) {
          console.error("Compliance Supabase upload error:", uploadError);
        } else {
          try {
            if (localFilePath && fs.existsSync(localFilePath)) {
              fs.unlinkSync(localFilePath);
            }
          } catch (cleanupError) {
            console.error("Failed to delete local compliance upload:", cleanupError);
          }

          signed = await enrichComplianceUpload(
            {
              ...signed,
              storagePath: objectKey,
              bucket,
              url: "",
            },
            storageClient,
          );
        }
      } catch (storageError) {
        console.error("Compliance storage fallback activated:", storageError);
      }

      const entry = {
        id: signed.id,
        type: signed.type,
        title: signed.title,
        url: signed.url,
        storagePath: signed.storagePath,
        bucket: signed.bucket,
        mimeType: signed.mimeType,
        fileSize: signed.fileSize,
        note: signed.note,
        submittedAt: signed.submittedAt,
      };

      student.complianceUploads = student.complianceUploads || [];
      student.complianceUploads.push(entry);
      student.documents = student.documents || {
        conceptNote: "pending",
        proposal: "pending",
        proposalScore: 0,
        thesis: "pending",
        nacosti: "pending",
        journalPaper: "pending",
        mentorship: "pending",
      };

      const normalizedType = type.toLowerCase();
      if (normalizedType.includes("nacosti")) {
        student.documents.nacosti = "submitted";
        student.markModified("documents");
      } else if (normalizedType.includes("proposal")) {
        student.documents.proposal = "submitted";
        student.markModified("documents");
      }

      student.markModified("complianceUploads");
      await student.save();

      const uploads = await Promise.all(
        [...(student.complianceUploads || [])]
          .sort(
            (a: any, b: any) =>
              new Date(b?.submittedAt || 0).getTime() - new Date(a?.submittedAt || 0).getTime(),
          )
          .map((upload: any) => enrichComplianceUpload(upload, storageClient)),
      );

      return res.status(201).json({
        success: true,
        upload: await enrichComplianceUpload(entry, storageClient),
        uploads,
        status: student.status,
      });
    } catch (error) {
      if (localFilePath && fs.existsSync(localFilePath)) {
        try {
          fs.unlinkSync(localFilePath);
        } catch (cleanupError) {
          console.error("Error cleaning up compliance file:", cleanupError);
        }
      }

      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File too large. Maximum size is 5MB." });
      }

      if (error instanceof Error && error.message === "Only PDF files are allowed") {
        return res.status(400).json({ message: error.message });
      }
      return res.status(500).json({ message: "Error submitting compliance document", error });
    }
  },
);

DirectorRouter.get(
  "/compliance/uploads",
  async (req: Request, res: Response) => {
    try {
      const decoded = await getAuthUser(req, res);
      if (!decoded) return;
      if (!["director", "admin"].includes(decoded.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const uploads = await UserModel.aggregate([
        { $match: { role: "student" } },
        { $unwind: { path: "$complianceUploads", preserveNullAndEmptyArrays: false } },
        {
          $project: {
            studentName: "$fullName",
            studentNumber: "$userNumber",
            department: "$department",
            programme: "$programme",
            upload: "$complianceUploads",
          },
        },
        { $sort: { "upload.submittedAt": -1 } },
      ]);

      let storageClient: StorageClient | null = null;
      try {
        storageClient = buildSupabaseStorageClient();
      } catch (error) {
        console.error("Director compliance storage setup error:", error);
      }

      const resolvedUploads = await Promise.all(
        uploads.map((entry: any) => enrichComplianceUpload(entry, storageClient)),
      );

      return res.json({ success: true, uploads: resolvedUploads });
    } catch (error) {
      return res.status(500).json({ message: "Error fetching compliance uploads", error });
    }
  },
);

DirectorRouter.post(
  "/students/:id/qreports/:reportId/dean-review",
  async (req: Request, res: Response) => {
    try {
      const decoded = await getAuthUser(req, res);
      if (!decoded) return;
      if (!["director", "admin"].includes(decoded.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { action, comment } = req.body || {};
      if (!["approved", "returned"].includes(action)) {
        return res.status(400).json({ message: "Action must be approved or returned" });
      }

      const student = await UserModel.findById(req.params.id);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      const report = student.quarterlyReports?.find((entry) => entry.id === req.params.reportId);
      if (!report) {
        return res.status(404).json({ message: "Quarterly report not found" });
      }

      const roles = requiredSupervisorRoles(student);
      const supervisorsCleared = roles.every((role) => report.approvals?.[role as keyof typeof report.approvals] === "approved");
      if (!supervisorsCleared) {
        return res.status(400).json({ message: "All supervisor approvals must be completed first" });
      }

      report.approvals.dean = action;
      report.status = action === "approved" ? "approved" : "returned";
      report.comment = comment || "";
      report.reviewTrail = [
        ...(report.reviewTrail || []),
        {
          role: "dean",
          actor: "PG Dean",
          action,
          comment: comment || "",
          at: new Date(),
        },
      ];

      student.markModified("quarterlyReports");
      await student.save();

      return res.json({
        success: true,
        message: `Quarterly report ${action}`,
        student,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error reviewing quarterly report", error });
    }
  },
);

DirectorRouter.post(
  "/students/:id/resume",
  async (req: Request, res: Response) => {
    try {
      const decoded = await getAuthUser(req, res);
      if (!decoded) return;
      if (!["director", "admin"].includes(decoded.role)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const student = await UserModel.findById(req.params.id);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      student.status = "Resumed";
      student.deferralInfo = {
        ...(student.deferralInfo || {}),
        actualResumption: new Date(),
      };

      if (student.deferralRequest?.status === "pending" && student.deferralRequest.type === "resumption") {
        student.deferralRequest.status = "approved";
        student.deferralRequest.reviewedAt = new Date();
        student.deferralRequest.reviewedBy = decoded.id;
      }

      await student.save();
      return res.json({
        success: true,
        message: "Student resumed successfully",
        student,
      });
    } catch (error) {
      return res.status(500).json({ message: "Error resuming student", error });
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
          student.stage = "Graduation Clearance";
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
        student.stage = "Graduation Clearance";
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
      const { sup1, sup2 } = req.body;
      const studentToUpdate = await UserModel.findById(req.params.id);
      if (!studentToUpdate)
        return res.status(404).json({ message: "Student not found" });

      const nextSup1 = String(sup1 || "").trim() || String(studentToUpdate.supervisors?.sup1 || "").trim();
      const nextSup2 = String(sup2 || "").trim() || String(studentToUpdate.supervisors?.sup2 || "").trim();

      if (!String(sup1 || "").trim() && !String(sup2 || "").trim()) {
        return res
          .status(400)
          .json({
            message:
              "Provide at least one supervisor to add or replace.",
          });
      }

      if (!nextSup1 || !nextSup2) {
        return res
          .status(400)
          .json({
            message:
              "A student must end up with 2 different supervisors. Add the missing supervisor before saving.",
          });
      }

      if (nextSup1 === nextSup2) {
        return res.status(400).json({
          message: "Supervisor 1 and Supervisor 2 must be different.",
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
          "PG School Approval",
          "Fieldwork / NACOSTI",
          "Thesis Draft (Department)",
          "Thesis Draft (School)",
          "External Examination Submission",
          "Under External Examination",
          "Final Defence",
          "Graduation Clearance",
        ];
        const currentStageIdx = STAGES.indexOf(
          studentToUpdate.stage || "Coursework",
        );
        const fieldworkIdx = STAGES.indexOf("Fieldwork / NACOSTI");

        if (currentStageIdx > fieldworkIdx) {
          return res
            .status(403)
            .json({
              message: "Supervisor assignment locked after the Fieldwork / NACOSTI stage.",
            });
        }
      }

      const student = await UserModel.findByIdAndUpdate(
        req.params.id,
        {
          supervisors: { sup1: nextSup1, sup2: nextSup2, sup3: "" },
          assignmentStatus: {
            sup1:
              nextSup1 !== String(studentToUpdate.supervisors?.sup1 || "").trim()
                ? "pending"
                : studentToUpdate.assignmentStatus?.sup1 || "pending",
            sup2:
              nextSup2 !== String(studentToUpdate.supervisors?.sup2 || "").trim()
                ? "pending"
                : studentToUpdate.assignmentStatus?.sup2 || "pending",
            sup3: "approved",
          },
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

      const activeAssignmentsForStudent = await SupervisorAssignmentModel.find({
        studentId: student._id.toString(),
        status: "active" as const,
      });

      const alreadyAssignedToSupervisor = activeAssignmentsForStudent.some(
        (assignment) => assignment.supervisorId === supervisor._id.toString(),
      );

      if (alreadyAssignedToSupervisor) {
        return res.status(400).json({
          message: "Student is already assigned to this supervisor",
        });
      }

      const currentSup1 = String(student.supervisors?.sup1 || "").trim();
      const currentSup2 = String(student.supervisors?.sup2 || "").trim();
      const supervisorName = String(supervisor.fullName || "").trim();

      if (
        supervisorName &&
        [currentSup1, currentSup2].filter(Boolean).includes(supervisorName)
      ) {
        return res.status(400).json({
          message: "Student already has this supervisor assigned",
        });
      }

      if (activeAssignmentsForStudent.length >= 2 && currentSup1 && currentSup2) {
        return res.status(400).json({
          message: "Student already has 2 active supervisor assignments",
        });
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
      let assignment = await SupervisorAssignmentModel.findOneAndUpdate(
        {
          supervisorId: supervisor._id.toString(),
          studentId: student._id.toString(),
          status: { $ne: "active" },
        },
        {
          $set: {
            status: "active",
            supervisorName: supervisor.fullName,
            supervisorId: supervisor._id.toString(),
            assignedBy: "director",
          },
          $push: { notes: `Reassigned on ${new Date().toLocaleDateString()}` },
        },
        { new: true },
      );

      if (!assignment) {
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

      const supervisorSlot = !currentSup1
        ? "sup1"
        : !currentSup2
          ? "sup2"
          : "";

      if (!supervisorSlot) {
        return res.status(400).json({
          message: "Student already has 2 supervisor slots filled",
        });
      }

      await UserModel.findByIdAndUpdate(student._id, {
        $set: {
          [`supervisors.${supervisorSlot}`]: supervisor.fullName,
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

      const currentSup1 = String(student.supervisors?.sup1 || "").trim();
      const currentSup2 = String(student.supervisors?.sup2 || "").trim();
      const removeFromSup1 =
        currentSup1 === assignment.supervisorName ||
        currentSup1 === String(assignment.supervisorId || "");
      const removeFromSup2 =
        currentSup2 === assignment.supervisorName ||
        currentSup2 === String(assignment.supervisorId || "");

      // Remove supervisor from student's record
      await UserModel.findByIdAndUpdate(student._id, {
        $set: {
          ...(removeFromSup1 ? { "supervisors.sup1": "" } : {}),
          ...(removeFromSup2 ? { "supervisors.sup2": "" } : {}),
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
        const identifiers = [
          String(sup._id || ""),
          String(sup.fullName || ""),
          String(sup.userNumber || ""),
        ].filter(Boolean);

        const assignedStudents = await UserModel.find({
          role: "student",
          $or: [
            { "supervisors.sup1": { $in: identifiers } },
            { "supervisors.sup2": { $in: identifiers } },
          ],
        } as any).select("assignmentStatus supervisors");

        const studentCount = assignedStudents.length;
        const pendingApprovals = assignedStudents.reduce((count, student: any) => {
          const slot = identifiers.includes(String(student?.supervisors?.sup1 || ""))
            ? "sup1"
            : identifiers.includes(String(student?.supervisors?.sup2 || ""))
              ? "sup2"
              : "";

          if (!slot) return count;
          return count + (student?.assignmentStatus?.[slot] === "pending" ? 1 : 0);
        }, 0);

        return {
          id: sup._id,
          _id: sup._id,
          fullName: sup.fullName,
          userNumber: sup.userNumber,
          department: sup.department,
          status: sup.status,
          isVerified: sup.isVerified,
          studentCount,
          pendingApprovals,
        };
      }),
    );

    res.json(enhancedSupervisors);
  } catch (error) {
    res.status(500).json({ message: "Error fetching supervisors", error });
  }
});
