import { api } from "./api.js";
import {
  badge,
  escapeHtml,
  formatDate,
  mountEmptyState,
  setPageContent,
  setPageMeta,
  toast,
} from "./main.js";

function normalizeReports(raw) {
  if (Array.isArray(raw?.reports)) return raw.reports;
  if (Array.isArray(raw?.data?.reports)) return raw.data.reports;
  return [];
}

function toneForStatus(status) {
  const value = String(status || "").toLowerCase();
  if (value === "approved") return "green";
  if (value === "returned") return "red";
  if (value === "pending_dean") return "blue";
  if (value.includes("pending")) return "yellow";
  return "slate";
}

function filtersHtml() {
  return `
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <input id="q" placeholder="Search student or report content" class="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
        <select id="status" class="rounded-xl border border-slate-200 px-3 py-2 text-sm">
          <option value="">All statuses</option>
          <option value="pending">Pending supervisor</option>
          <option value="pending_dean">Pending director</option>
          <option value="approved">Approved</option>
          <option value="returned">Returned</option>
        </select>
        <div class="flex gap-2">
          <button id="apply" class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Apply</button>
          <button id="reset" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Reset</button>
        </div>
      </div>
    </div>
  `;
}

function boardHtml() {
  return `
    <div class="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
      <div class="border-b border-slate-200 px-5 py-4">
        <div class="text-base font-semibold text-slate-900">Quarterly reports board</div>
        <div class="mt-1 text-sm text-slate-500">Student-submitted quarterly reports awaiting supervisor and director action.</div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-600">
            <tr>
              <th class="px-4 py-3 font-semibold">Student</th>
              <th class="px-4 py-3 font-semibold">Quarter</th>
              <th class="px-4 py-3 font-semibold">Report Details</th>
              <th class="px-4 py-3 font-semibold">Approvals</th>
              <th class="px-4 py-3 font-semibold">Status</th>
              <th class="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>
    </div>
  `;
}

function mount() {
  setPageMeta({
    title: "Quarterly Reports",
    subtitle: "Director review board for student-submitted quarterly reports",
  });

  setPageContent(`
    ${filtersHtml()}
    ${boardHtml()}
  `);
}

function getFilters() {
  return {
    q: document.getElementById("q")?.value || "",
    status: document.getElementById("status")?.value || "",
  };
}

function approvalChain(report) {
  const approvals = report?.approvals || {};
  return `
    <div class="space-y-1 text-xs">
      <div>SUP1: ${escapeHtml(approvals.sup1 || "-")}</div>
      <div>SUP2: ${escapeHtml(approvals.sup2 || "-")}</div>
      <div>Director: ${escapeHtml(approvals.dean || "-")}</div>
    </div>
  `;
}

function canDirectorReview(report) {
  const approvals = report?.approvals || {};
  const sup1Approved = String(approvals.sup1 || "").toLowerCase() === "approved";
  const sup2Approved = String(approvals.sup2 || "").toLowerCase() === "approved";
  const deanPending = String(approvals.dean || "pending").toLowerCase() === "pending";
  return sup1Approved && sup2Approved && deanPending;
}

function reportDetails(report) {
  return `
    <div class="space-y-3">
      <div>
        <div class="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Progress Summary</div>
        <div class="mt-1 text-xs text-slate-700">${escapeHtml(report.progressSummary || "-")}</div>
      </div>
      <div>
        <div class="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Objectives Achieved</div>
        <div class="mt-1 text-xs text-slate-700">${escapeHtml(report.objectivesAchieved || "-")}</div>
      </div>
      <div>
        <div class="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Challenges and Mitigation</div>
        <div class="mt-1 text-xs text-slate-700">${escapeHtml(report.challengesAndMitigation || "-")}</div>
      </div>
      <div>
        <div class="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Next Quarter Plan</div>
        <div class="mt-1 text-xs text-slate-700">${escapeHtml(report.nextQuarterPlan || "-")}</div>
      </div>
    </div>
  `;
}

function rowHtml(entry) {
  const report = entry.report || {};
  const canReview = canDirectorReview(report);

  return `
    <tr class="border-t border-slate-200 align-top">
      <td class="px-4 py-4">
        <div class="font-semibold text-slate-900">${escapeHtml(entry.studentName || "-")}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(entry.studentNumber || "-")}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(entry.programme || "-")} | ${escapeHtml(entry.department || "-")}</div>
      </td>
      <td class="px-4 py-4">
        <div class="font-medium text-slate-900">Q${escapeHtml(String(report.quarter || "-"))} ${escapeHtml(String(report.year || "-"))}</div>
        <div class="mt-1 text-xs text-slate-500">${formatDate(report.submittedAt)}</div>
      </td>
      <td class="px-4 py-4">${reportDetails(report)}</td>
      <td class="px-4 py-4">${approvalChain(report)}</td>
      <td class="px-4 py-4">${badge({ label: report.status || "-", tone: toneForStatus(report.status) })}</td>
      <td class="px-4 py-4">
        ${canReview ? `
          <div class="flex flex-col gap-2">
            <button class="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white" data-student="${entry.studentId}" data-report="${report.id}" data-action="approved">Approve</button>
            <button class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700" data-student="${entry.studentId}" data-report="${report.id}" data-action="returned">Return</button>
          </div>
        ` : `<span class="text-xs text-slate-400">Waiting for both supervisors</span>`}
      </td>
    </tr>
  `;
}

async function load() {
  const tbody = document.getElementById("tbody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-6 text-center text-slate-500">Loading quarterly reports...</td></tr>`;
  }

  try {
    const reports = normalizeReports(await api.getQuarterlyReportsBoard(getFilters()));
    if (!reports.length) {
      setPageContent(
        filtersHtml() +
          mountEmptyState({
            title: "No quarterly reports found",
            message: "There are no student quarterly reports matching the current filters.",
          }),
      );
      wireActions();
      return;
    }

    mount();
    document.getElementById("tbody").innerHTML = reports.map(rowHtml).join("");
    wireActions();
  } catch (error) {
    console.error(error);
    toast(error.message || "Failed to load quarterly reports", { tone: "red" });
  }
}

function wireActions() {
  document.getElementById("apply")?.addEventListener("click", load);
  document.getElementById("reset")?.addEventListener("click", () => {
    document.getElementById("q").value = "";
    document.getElementById("status").value = "";
    load();
  });

  document.getElementById("tbody")?.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const studentId = button.dataset.student;
    const reportId = button.dataset.report;
    const action = button.dataset.action;
    const comment = action === "returned"
      ? window.prompt("Return comment", "Please revise and resubmit.") || ""
      : "Approved by director";

    try {
      await api.reviewQuarterlyReport(studentId, reportId, { action, comment });
      toast(action === "approved" ? "Quarterly report approved" : "Quarterly report returned", {
        tone: action === "approved" ? "green" : "yellow",
      });
      load();
    } catch (error) {
      toast(error.message || "Failed to review quarterly report", { tone: "red" });
    }
  });
}

mount();
load();
