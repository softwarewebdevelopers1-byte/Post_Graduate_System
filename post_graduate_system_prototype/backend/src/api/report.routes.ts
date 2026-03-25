import { Router, type Request, type Response } from "express";
import { StorageClient } from "@supabase/storage-js";
import jwt from "jsonwebtoken";
import { ReportModel, ReportStatus } from "../models/report.model.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { readFile } from "fs/promises";

export const reportRouter = Router();

// ===== Multer Configuration =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "reports");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `report-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// Helper function to get user from token (promise-based)
const getUserFromToken = (token: string, secret: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err: any, decoded: any) => {
      if (err) reject(err);
      else resolve(decoded);
    });
  });
};

// Helper function to check if a quarter string is valid
const isValidQuarter = (quarterStr: string): boolean => {
  const validQuarters = [
    "Q1 — July to September 2025",
    "Q2 — October to December 2025",
    "Q3 — January to March 2026",
    "Q4 — April to June 2026",
  ];
  return validQuarters.includes(quarterStr);
};

// Helper functions for quarter parsing
const getQuarterNumber = (quarterStr: string): number => {
  const quarterMap: { [key: string]: number } = {
    "Q1 — July to September 2025": 1,
    "Q2 — October to December 2025": 2,
    "Q3 — January to March 2026": 3,
    "Q4 — April to June 2026": 4,
  };
  return quarterMap[quarterStr] || 0;
};

const getYearFromQuarter = (quarterStr: string): number => {
  const yearMatch = quarterStr.match(/(\d{4})/);

  if (yearMatch && yearMatch[1]) {
    return parseInt(yearMatch[1], 10);
  }

  return new Date().getFullYear();
};

// ===== SUBMIT QUARTERLY REPORT =====
reportRouter.post(
  "/reports/submit",
  upload.single("reportFile"),
  async (req: Request, res: Response) => {
    let filePath: string | null = null;

    try {
      const accessToken = req.cookies?.userToken;
      const jwtSecret = process.env.JWT_SECRET;

      if (!accessToken || !jwtSecret) {
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(401).json({
          success: false,
          message: "Unauthorized access",
        });
      }

      const {
        reportingQuarter,
        researchActivities,
        challengesEncountered,
        plannedActivities,
      } = req.body;

      if (!reportingQuarter || !researchActivities || !plannedActivities) {
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }

      const quarterStr = String(reportingQuarter);

      if (!isValidQuarter(quarterStr)) {
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          success: false,
          message: "Invalid reporting quarter selected",
        });
      }

      const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const PROJECT_REF = process.env.SUPABASE_URL;

      if (!SERVICE_KEY || !PROJECT_REF) {
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(500).json({
          success: false,
          error: "Missing Supabase credentials",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "No file uploaded. Please upload a PDF file.",
        });
      }

      filePath = req.file.path;

      let decoded;
      try {
        decoded = await getUserFromToken(accessToken, jwtSecret);
      } catch (jwtError) {
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        return res.status(401).json({
          success: false,
          message: "Invalid or expired token",
        });
      }

      const quarter = getQuarterNumber(quarterStr);
      const year = getYearFromQuarter(quarterStr);

      const existingReport = await ReportModel.findOne({
        ownerId: decoded.id,
        quarter: quarter,
        year: year,
      });

      if (existingReport) {
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        return res.status(400).json({
          success: false,
          message: `You have already submitted a report for ${quarterStr}`,
        });
      }

      const STORAGE_URL = `https://${PROJECT_REF}.supabase.co/storage/v1`;
      const storageClient = new StorageClient(STORAGE_URL, {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      });

      const fileName = `${Date.now()}-${req.file.originalname}`;
      const fileBuffer = await readFile(filePath);

      const { error: uploadError } = await storageClient
        .from("campusHub_PDF")
        .upload(fileName, fileBuffer, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        console.error("Supabase upload error:", uploadError);
        if (filePath && fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        return res.status(500).json({
          success: false,
          error: "Failed to upload to Supabase",
          details: uploadError.message,
        });
      }

      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (unlinkError) {
        console.error("Failed to delete local file:", unlinkError);
      }

      const { data } = storageClient
        .from("campusHub_PDF")
        .getPublicUrl(fileName);

      const newReport = await ReportModel.create({
        owner: decoded.userNumber || decoded.id,
        ownerId: decoded.id,
        reportUrl: data.publicUrl,
        reportingQuarter: quarterStr,
        quarter: quarter,
        year: year,
        researchActivities,
        challengesEncountered: challengesEncountered || "",
        plannedActivities,
        status: ReportStatus.PENDING,
      });

      return res.status(201).json({
        success: true,
        message: "Report submitted successfully",
        status: newReport.status,
        reportUrl: data.publicUrl,
        report: {
          id: newReport._id,
          reportingQuarter: newReport.reportingQuarter,
          quarter: newReport.quarter,
          year: newReport.year,
        },
      });
    } catch (error) {
      console.error("Error submitting report:", error);

      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (cleanupError) {
          console.error("Error cleaning up file:", cleanupError);
        }
      }

      if (res.headersSent) {
        console.log("Headers already sent, cannot send error response");
        return;
      }

      if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            message: "File too large. Maximum size is 5MB.",
          });
        }
        if (error.code === "LIMIT_FILE_COUNT") {
          return res.status(400).json({
            success: false,
            message: "Too many files. Only one file allowed.",
          });
        }
      }

      if (
        error instanceof Error &&
        error.message === "Only PDF files are allowed"
      ) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      if (error instanceof Error && (error as any).code === 11000) {
        return res.status(400).json({
          success: false,
          message: "You have already submitted a report for this quarter.",
        });
      }

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      return res.status(500).json({
        success: false,
        message: "Server error. Please try again later.",
        error:
          process.env.NODE_ENV === "development" ? errorMessage : undefined,
      });
    }
  },
);

// ===== GET ALL QUARTERLY REPORTS =====
reportRouter.get("/reports", async (req: Request, res: Response) => {
  try {
    const accessToken = req.cookies?.userToken;
    const jwtSecret = process.env.JWT_SECRET;

    if (!accessToken || !jwtSecret) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const decoded = await getUserFromToken(accessToken, jwtSecret);

    // if (!["admin", "chair", "supervisor", "dean"].includes(decoded.role)) {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Access denied",
    //   });
    // }

    const {
      status,
      quarter,
      year,
      reportingQuarter,
      q,
      page = 1,
      limit = 20,
    } = req.query;
    const query: any = {};

    if (status) query.status = status;
    if (quarter) query.quarter = parseInt(quarter as string);
    if (year) query.year = parseInt(year as string);
    if (reportingQuarter) query.reportingQuarter = reportingQuarter;

    if (q) {
      query.$or = [
        { researchActivities: { $regex: q, $options: "i" } },
        { plannedActivities: { $regex: q, $options: "i" } },
        { reportingQuarter: { $regex: q, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [reports, total] = await Promise.all([
      ReportModel.find(query)
        .sort({ year: -1, quarter: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("ownerId", "fullName userNumber email department"),
      ReportModel.countDocuments(query),
    ]);
    console.log(reports);

    const stats = {
      total,
      pending: await ReportModel.countDocuments({
        status: ReportStatus.PENDING,
      }),
      underReview: await ReportModel.countDocuments({
        status: ReportStatus.UNDER_REVIEW,
      }),
      approved: await ReportModel.countDocuments({
        status: ReportStatus.APPROVED,
      }),
      rejected: await ReportModel.countDocuments({
        status: ReportStatus.REJECTED,
      }),
    };

    return res.status(200).json({
      success: true,
      data: reports,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
      stats,
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ===== GET STUDENT'S OWN REPORTS =====
reportRouter.get("/reports/my-reports", async (req: Request, res: Response) => {
  try {
    const accessToken = req.cookies?.userToken;
    const jwtSecret = process.env.JWT_SECRET;

    if (!accessToken || !jwtSecret) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const decoded = await getUserFromToken(accessToken, jwtSecret);

    const reports = await ReportModel.find({ ownerId: decoded.id }).sort({
      year: -1,
      quarter: -1,
      createdAt: -1,
    });

    const stats = {
      total: reports.length,
      pending: reports.filter((r) => r.status === ReportStatus.PENDING).length,
      underReview: reports.filter((r) => r.status === ReportStatus.UNDER_REVIEW)
        .length,
      approved: reports.filter((r) => r.status === ReportStatus.APPROVED)
        .length,
      rejected: reports.filter((r) => r.status === ReportStatus.REJECTED)
        .length,
      quartersSubmitted: reports.map((r) => r.reportingQuarter),
    };

    return res.status(200).json({
      success: true,
      data: reports,
      stats,
    });
  } catch (error) {
    console.error("Error fetching student reports:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ===== GET REPORTS BY STATUS =====
reportRouter.get(
  "/reports/status/:status",
  async (req: Request, res: Response) => {
    try {
      const accessToken = req.cookies?.userToken;
      const jwtSecret = process.env.JWT_SECRET;

      type ReportStatusType = (typeof ReportStatus)[keyof typeof ReportStatus];

      function isValidStatus(status: any): status is ReportStatusType {
        return Object.values(ReportStatus).includes(status);
      }

      const { status } = req.params;

      if (!accessToken || !jwtSecret) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized access",
        });
      }

      const decoded = await getUserFromToken(accessToken, jwtSecret);

      if (!["admin", "chair", "supervisor", "dean"].includes(decoded.role)) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      //  Type-safe validation
      if (!isValidStatus(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status",
        });
      }

      //  NO casting needed anymore
      const reports = await ReportModel.find({ status })
        .sort({ createdAt: -1 })
        .populate("ownerId", "fullName userNumber department");

      return res.status(200).json({
        success: true,
        data: reports,
        count: reports.length,
      });
    } catch (error) {
      console.error("Error fetching reports by status:", error);
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  },
);

// ===== GET REPORT SUMMARY STATISTICS =====
reportRouter.get("/reports/summary", async (req: Request, res: Response) => {
  try {
    const accessToken = req.cookies?.userToken;
    const jwtSecret = process.env.JWT_SECRET;

    if (!accessToken || !jwtSecret) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const decoded = await getUserFromToken(accessToken, jwtSecret);

    if (!["admin", "chair", "dean"].includes(decoded.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const currentYear = new Date().getFullYear();
    const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

    const summary = {
      total: await ReportModel.countDocuments(),
      byStatus: {
        pending: await ReportModel.countDocuments({
          status: ReportStatus.PENDING,
        }),
        underReview: await ReportModel.countDocuments({
          status: ReportStatus.UNDER_REVIEW,
        }),
        approved: await ReportModel.countDocuments({
          status: ReportStatus.APPROVED,
        }),
        rejected: await ReportModel.countDocuments({
          status: ReportStatus.REJECTED,
        }),
      },
      byYear: {
        [currentYear]: await ReportModel.countDocuments({ year: currentYear }),
        [currentYear - 1]: await ReportModel.countDocuments({
          year: currentYear - 1,
        }),
        [currentYear - 2]: await ReportModel.countDocuments({
          year: currentYear - 2,
        }),
      },
      currentQuarter: {
        number: currentQuarter,
        submissions: await ReportModel.countDocuments({
          year: currentYear,
          quarter: currentQuarter,
        }),
      },
      completionRate: {
        approved: 0,
        percentage: 0,
      },
    };

    const total = summary.total;
    const approvedCount = summary.byStatus.approved;
    summary.completionRate.approved = approvedCount;
    summary.completionRate.percentage =
      total > 0 ? Math.round((approvedCount / total) * 100) : 0;

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching report summary:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ===== GET REPORT HISTORY =====
reportRouter.get("/reports/history", async (req: Request, res: Response) => {
  try {
    const accessToken = req.cookies?.userToken;
    const jwtSecret = process.env.JWT_SECRET;

    if (!accessToken || !jwtSecret) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const decoded = await getUserFromToken(accessToken, jwtSecret);

    const reports = await ReportModel.find({ ownerId: decoded.id }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      reports: reports,
    });
  } catch (error) {
    console.error("Error fetching report history:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ===== GET SINGLE REPORT =====
reportRouter.get("/reports/:reportId", async (req: Request, res: Response) => {
  try {
    const accessToken = req.cookies?.userToken;
    const jwtSecret = process.env.JWT_SECRET;

    if (!accessToken || !jwtSecret) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access",
      });
    }

    const decoded = await getUserFromToken(accessToken, jwtSecret);
    const { reportId } = req.params;

    const report = await ReportModel.findOne({
      _id: reportId,
      ownerId: decoded.id,
    });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    return res.status(200).json({
      success: true,
      report: report,
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

// ===== APPROVE REPORT =====
reportRouter.post(
  "/reports/:reportId/approve",
  async (req: Request, res: Response) => {
    try {
      const accessToken = req.cookies?.userToken;
      const jwtSecret = process.env.JWT_SECRET;

      if (!accessToken || !jwtSecret) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized access",
        });
      }

      const decoded = await getUserFromToken(accessToken, jwtSecret);

      // if (!["admin", "chair", "supervisor"].includes(decoded.role)) {
      //   return res.status(403).json({
      //     success: false,
      //     message: "Access denied",
      //   });
      // }

      const { reportId } = req.params;

      const report = await ReportModel.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          message: "Report not found",
        });
      }

      report.status = ReportStatus.APPROVED;
      await report.save();

      return res.status(200).json({
        success: true,
        message: "Report approved successfully",
        report: report,
      });
    } catch (error) {
      console.error("Error approving report:", error);
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  },
);

// ===== REJECT REPORT =====
reportRouter.post(
  "/reports/:reportId/reject",
  async (req: Request, res: Response) => {
    try {
      const accessToken = req.cookies?.userToken;
      const jwtSecret = process.env.JWT_SECRET;

      if (!accessToken || !jwtSecret) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized access",
        });
      }

      const decoded = await getUserFromToken(accessToken, jwtSecret);

      // if (!["admin", "chair", "supervisor"].includes(decoded.role)) {
      //   return res.status(403).json({
      //     success: false,
      //     message: "Access denied",
      //   });
      // }

      const { reportId } = req.params;
      const { reason } = req.body;

      const report = await ReportModel.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          message: "Report not found",
        });
      }

      report.status = ReportStatus.REJECTED;
      await report.save();

      return res.status(200).json({
        success: true,
        message: "Report rejected",
        report: report,
      });
    } catch (error) {
      console.error("Error rejecting report:", error);
      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  },
);

// Error handling middleware
reportRouter.use((err: any, req: Request, res: Response, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 5MB.",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files. Only one file allowed.",
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field name. Please use "reportFile".',
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  }

  if (err instanceof Error && err.message === "Only PDF files are allowed") {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  next(err);
});
