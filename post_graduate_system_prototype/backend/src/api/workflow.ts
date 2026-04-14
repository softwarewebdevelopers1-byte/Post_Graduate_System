import { Router, type Request, type Response } from "express";
import { UserModel } from "../models/user.model.js";

export const workflowRouter = Router();

const CANONICAL_STAGES = [
    "Application",
    "Concept Note",
    "Proposal",
    "Research Progress",
    "Thesis Submission",
    "Defense",
    "Graduation",
];

const LEGACY_STAGE_MAP: Record<string, string> = {
    "coursework": "Application",
    "concept note (department)": "Concept Note",
    "concept note (school)": "Concept Note",
    "concept note": "Concept Note",
    "proposal (department)": "Proposal",
    "proposal (school)": "Proposal",
    "proposal": "Proposal",
    "pg approval": "Research Progress",
    "fieldwork": "Research Progress",
    "thesis development": "Research Progress",
    "research progress": "Research Progress",
    "data collection": "Research Progress",
    "draft thesis": "Thesis Submission",
    "thesis submission": "Thesis Submission",
    "external examination submission": "Thesis Submission",
    "under external examination": "Thesis Submission",
    "external examination": "Thesis Submission",
    "notice of submission": "Thesis Submission",
    "seminar": "Defense",
    "final thesis": "Thesis Submission",
    "examination": "Defense",
    "corrections": "Defense",
    "clearance": "Graduation",
};

// Module E: Approval Chain (Supervisor -> Dean -> Finance) & ERP Integration
const callErpFinance = async (userId: string, balance: number) => {
    // Simulated ERP response
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                outstandingBalance: balance,
                status: balance > 0 ? "BLOCKED" : "CLEARED"
            });
        }, 500);
    });
};

workflowRouter.post("/reports/:userId/:reportId/approve", async (req: Request, res: Response) => {
    try {
        const { userId, reportId } = req.params;
        const { approverType } = req.body; // 'supervisor', 'dean', 'erp_finance'
        if (!userId || !reportId || !approverType) return res.status(400).json({ message: "Missing required fields" });
        const user = await UserModel.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const report = user.quarterlyReports?.find(r => r.id === reportId);
        if (!report) return res.status(404).json({ message: "Report not found" });

        // Approval Chain Logic using report_approvals flow on quarterlyReports
        if (approverType === 'supervisor') {
            report.approvals.sup1 = "approved";
        } else if (approverType === 'dean') {
            if (report.approvals.sup1 !== "approved")
                return res.status(400).json({ message: "Supervisor must approve first" });
            report.approvals.dean = "approved";
        } else if (approverType === 'erp_finance') {
            if (report.approvals.dean !== "approved")
                return res.status(400).json({ message: "Dean must approve first" });

            // ERP Finance Integration
            // Simulate mock ERP API call
            const balance = user.financialClearance ? 0 : 5000;
            const erpResponse: any = await callErpFinance(userId as string, balance);

            if (erpResponse.status === "BLOCKED") {
                // Fee Clearance Gate: block graduation clearances
                user.status = "Blocked by Finance";
                await user.save();
                return res.status(403).json({
                    message: "ERP Finance Blocked. Outstanding balance.",
                    erp_clearance_requests: { status: erpResponse.status, balance: erpResponse.outstandingBalance }
                });
            } else {
                report.approvals.finance = "approved";
                user.financialClearance = true;
            }
        } else {
            return res.status(400).json({ message: "Invalid approver type" });
        }

        await user.save();
        res.status(200).json({ message: `Report approved by ${approverType}`, report });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Module A: Pipeline advancement
workflowRouter.post("/pipeline/:userId/advance", async (req: any, res: any) => {
    try {
        const { userId } = req.params;
        const { scores } = req.body; // simulated assessment_rubrics input

        const user = await UserModel.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        if ((user.status || "").toLowerCase() === "deferred") {
            return res.status(403).json({ message: "Deferred students cannot advance in the workflow until reinstated" });
        }

        // Automate calculation of weighted percentage scores
        const weights = { proposal: 0.4, presentation: 0.6 };
        const proposalScore = Number(scores?.proposal || 0);
        const presentationScore = Number(scores?.presentation || 0);
        const finalScore = (proposalScore * weights.proposal) + (presentationScore * weights.presentation);

        // Stage advancement logic based on score
        if (finalScore >= 50) { // pass mark
            const currentStage = LEGACY_STAGE_MAP[(user.stage || "").toLowerCase()] || user.stage || "Application";
            const currentIndex = CANONICAL_STAGES.indexOf(currentStage);
            if (currentIndex !== -1 && currentIndex < CANONICAL_STAGES.length - 1) {
                user.stage = CANONICAL_STAGES[currentIndex + 1] as string;
                await user.save();
                return res.status(200).json({ message: "Stage advanced successfully", newStage: user.stage, score: finalScore });
            }
        }

        res.status(400).json({ message: "Score insufficient for advancement or at final stage", score: finalScore });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Module C: AI Corrections
workflowRouter.post("/corrections/:userId/extract", async (req: any, res: any) => {
    try {
        const { userId } = req.params;
        const { transcript } = req.body;

        const user = await UserModel.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Mock AI Extraction logic for transcripts
        const extractedCorrections = transcript
            .split(". ")
            .filter((sentence: string) => sentence.toLowerCase().includes("fix") || sentence.toLowerCase().includes("change") || sentence.toLowerCase().includes("update") || sentence.toLowerCase().includes("correct"))
            .map((text: string, i: number) => ({
                id: `corr_${Date.now()}_${i}`,
                text: text.trim(),
                source: "AI",
                completed: false,
                validation: "pending"
            }));

        if (!user.corrections) user.corrections = [];
        user.corrections.push(...extractedCorrections);

        await user.save();

        res.status(200).json({ message: "Corrections extracted and saved successfully", corrections: extractedCorrections });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
