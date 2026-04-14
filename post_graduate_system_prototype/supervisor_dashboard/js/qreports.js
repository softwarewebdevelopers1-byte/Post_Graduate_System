import { qs, getSupervisorSession, toast, escapeHtml } from './main.js';
import { api } from './api.js';

function statusBadge(status) {
  const value = String(status || "").toLowerCase();
  const cls = value === "approved"
    ? "badge-active"
    : value === "returned"
      ? "badge-deferred"
      : "badge-pending";
  return `<span class="badge ${cls}">${escapeHtml(status || "-")}</span>`;
}

function reportDetails(report) {
  return `
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
      <div style="padding:12px 14px; border:1px solid var(--grey-100); border-radius:var(--radius-sm); background:var(--grey-100);">
        <div class="text-[10px] font-bold uppercase tracking-widest text-muted">Progress Summary</div>
        <div class="text-xs font-medium text-grey-700 mt-2" style="line-height:1.6;">${escapeHtml(report.progressSummary || "-")}</div>
      </div>
      <div style="padding:12px 14px; border:1px solid var(--grey-100); border-radius:var(--radius-sm); background:var(--grey-100);">
        <div class="text-[10px] font-bold uppercase tracking-widest text-muted">Objectives Achieved</div>
        <div class="text-xs font-medium text-grey-700 mt-2" style="line-height:1.6;">${escapeHtml(report.objectivesAchieved || "-")}</div>
      </div>
      <div style="padding:12px 14px; border:1px solid var(--grey-100); border-radius:var(--radius-sm); background:var(--grey-100);">
        <div class="text-[10px] font-bold uppercase tracking-widest text-muted">Challenges and Mitigation</div>
        <div class="text-xs font-medium text-grey-700 mt-2" style="line-height:1.6;">${escapeHtml(report.challengesAndMitigation || "-")}</div>
      </div>
      <div style="padding:12px 14px; border:1px solid var(--grey-100); border-radius:var(--radius-sm); background:var(--grey-100);">
        <div class="text-[10px] font-bold uppercase tracking-widest text-muted">Next Quarter Plan</div>
        <div class="text-xs font-medium text-grey-700 mt-2" style="line-height:1.6;">${escapeHtml(report.nextQuarterPlan || "-")}</div>
      </div>
    </div>
  `;
}

function slotDetails(entry, report) {
  return `
    <div style="display:flex; flex-direction:column; gap:8px;">
      <div class="text-[10px] font-bold uppercase tracking-widest text-muted">Review Slot</div>
      <div class="text-xs font-bold uppercase" style="color:var(--navy);">${escapeHtml(entry.supervisorRole || "-")}</div>
      <div class="text-[11px] font-medium text-muted">My decision: ${escapeHtml(report.approvals?.[entry.supervisorRole] || "-")}</div>
    </div>
  `;
}

function actionButtons(entry, report) {
  if (!entry.canReview) {
    return `<span class="text-[10px] font-bold uppercase text-muted">No action required</span>`;
  }

  return `
    <div style="display:flex; flex-wrap:wrap; gap:10px;">
      <button class="btn btn-primary btn-sm btn-qreport-action" data-student="${entry.studentId}" data-report="${report.id}" data-role="${entry.supervisorRole}" data-action="approved">Approve</button>
      <button class="btn btn-outline btn-sm btn-qreport-action" data-student="${entry.studentId}" data-report="${report.id}" data-role="${entry.supervisorRole}" data-action="returned">Return</button>
    </div>
  `;
}

function renderBoard(reports) {
  const root = qs("#section-qreports");
  if (!root) return;

  root.innerHTML = `
    <div class="card p-0 animate-in">
      <div class="p-8 border-b border-grey-100 flex-between">
        <div>
          <div class="card-title">Quarterly Reports Board</div>
          <div class="card-sub">Clear review view for submitted student quarterly reports</div>
        </div>
        <div class="flex-row">
          <input id="qreports-search" placeholder="Search student or summary..." class="form-input btn-sm" style="width:220px;">
          <select id="qreports-status" class="form-input btn-sm" style="width:180px;">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="pending_dean">Pending director</option>
            <option value="approved">Approved</option>
            <option value="returned">Returned</option>
          </select>
          <button class="btn btn-primary btn-sm" id="qreports-apply">Apply</button>
        </div>
      </div>
      <div id="qreports-tbody" style="display:flex; flex-direction:column; gap:18px; padding:24px;">
        ${reports.length ? reports.map(rowHtml).join("") : `
          <div class="p-16 text-center text-muted font-bold uppercase text-xs">No quarterly reports found</div>
        `}
      </div>
    </div>
  `;

  qs("#qreports-apply")?.addEventListener("click", loadQuarterlyReportsBoard);
}

function rowHtml(entry) {
  const report = entry.report || {};
  return `
    <article style="border:1px solid var(--grey-100); border-radius:var(--radius); padding:20px; background:white; display:flex; flex-direction:column; gap:18px;">
      <div style="display:flex; flex-wrap:wrap; justify-content:space-between; gap:14px; align-items:flex-start;">
        <div>
          <div class="text-sm font-bold text-navy">${escapeHtml(entry.studentName || "-")}</div>
          <div class="text-[10px] font-bold text-muted uppercase mt-1">${escapeHtml(entry.studentNumber || "-")}</div>
          <div class="text-[10px] font-bold text-muted uppercase mt-1">${escapeHtml(entry.programme || "-")} | ${escapeHtml(entry.department || "-")}</div>
        </div>
        <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-start;">
          ${statusBadge(report.status)}
          <div class="text-[10px] font-bold text-muted uppercase">Q${escapeHtml(String(report.quarter || "-"))} ${escapeHtml(String(report.year || "-"))}</div>
          <div class="text-[10px] text-muted">${report.submittedAt ? new Date(report.submittedAt).toLocaleDateString() : "-"}</div>
        </div>
      </div>

      ${reportDetails(report)}

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:14px; align-items:start;">
        <div style="padding:12px 14px; border:1px solid var(--grey-100); border-radius:var(--radius-sm);">
          ${slotDetails(entry, report)}
        </div>
        <div style="padding:12px 14px; border:1px solid var(--grey-100); border-radius:var(--radius-sm);">
          <div class="text-[10px] font-bold uppercase tracking-widest text-muted">Actions</div>
          <div class="mt-3">${actionButtons(entry, report)}</div>
        </div>
      </div>
    </article>
  `;
}

export async function initQuarterlyReportsBoard() {
  await loadQuarterlyReportsBoard();
}

async function loadQuarterlyReportsBoard() {
  const root = qs("#section-qreports");
  if (!root) return;

  root.innerHTML = `<div class="card p-20 text-center text-muted font-bold uppercase text-xs animate-in">Loading quarterly reports...</div>`;

  try {
    const session = getSupervisorSession();
    const status = qs("#qreports-status")?.value || "";
    const q = qs("#qreports-search")?.value || "";
    const response = await api.getQuarterlyReportsBoard(session.id, { status, q });
    const reports = Array.isArray(response?.reports) ? response.reports : [];

    renderBoard(reports);
    wireActions();
    if (qs("#qreports-status")) qs("#qreports-status").value = status;
    if (qs("#qreports-search")) qs("#qreports-search").value = q;
  } catch (error) {
    root.innerHTML = `<div class="card p-20 text-center text-red-500 font-bold animate-in">Failed to load quarterly reports: ${escapeHtml(error.message || "Unknown error")}</div>`;
  }
}

function wireActions() {
  document.querySelectorAll(".btn-qreport-action").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      const comment = action === "returned"
        ? window.prompt("Return comment", "Please revise and resubmit.") || ""
        : "Approved by supervisor";

      try {
        const session = getSupervisorSession();
        await api.approveQReport(btn.dataset.student, btn.dataset.report, {
          supervisorId: session.id,
          role: btn.dataset.role,
          action,
          comment,
        });
        toast(action === "approved" ? "Quarterly report approved" : "Quarterly report returned", {
          tone: action === "approved" ? "green" : "yellow",
        });
        loadQuarterlyReportsBoard();
      } catch (error) {
        toast(error.message || "Failed to review quarterly report", { tone: "red" });
      }
    });
  });
}
