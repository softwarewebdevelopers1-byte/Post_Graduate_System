import { api } from "./api.js";
import {
  badge,
  confirmModal,
  escapeHtml,
  formatDate,
  mountEmptyState,
  openModal,
  setPageContent,
  setPageMeta,
  toast,
} from "./main.js";

function toneForRequest(status) {
  const value = String(status || "").toLowerCase();
  if (value === "approved") return "green";
  if (value === "rejected") return "red";
  if (value === "pending") return "yellow";
  return "slate";
}

function requestRow(student) {
  const request = student.deferralRequest || {};
  const typeLabel = request.type === "resumption" ? "Resumption" : "Deferral";
  return `
    <tr class="border-b border-slate-100 hover:bg-slate-50">
      <td class="px-4 py-3">
        <div class="font-semibold text-slate-900">${escapeHtml(student.fullName || "—")}</div>
        <div class="text-xs text-slate-500">${escapeHtml(student.userNumber || "—")}</div>
      </td>
      <td class="px-4 py-3">
        <div class="text-sm text-slate-800">${escapeHtml((student.programme || "—").toUpperCase())}</div>
        <div class="text-xs text-slate-500">${escapeHtml((student.department || "—").toUpperCase())}</div>
      </td>
      <td class="px-4 py-3">
        <div class="text-sm font-semibold text-slate-800">${escapeHtml(typeLabel)}</div>
        <div class="text-xs text-slate-500">${escapeHtml(request.reason || "—")}</div>
      </td>
      <td class="px-4 py-3">
        <div class="text-sm text-slate-800">${escapeHtml(request.plannedResumption || "—")}</div>
      </td>
      <td class="px-4 py-3">
        <div class="text-sm text-slate-800">${escapeHtml(student.stage || "—")}</div>
        <div class="text-xs text-slate-500">${formatDate(request.submittedAt)}</div>
      </td>
      <td class="px-4 py-3">
        ${badge({ label: request.status || "pending", tone: toneForRequest(request.status) })}
      </td>
      <td class="px-4 py-3">
        <div class="flex flex-wrap gap-2">
          <button data-deferral-action="approve" data-id="${student._id}" class="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition">
            ${request.type === "resumption" ? "Approve Resume" : "Approve"}
          </button>
          <button data-deferral-action="reject" data-id="${student._id}" class="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 transition">
            ${request.type === "resumption" ? "Reject Resume" : "Reject"}
          </button>
        </div>
      </td>
    </tr>
  `;
}

function deferredStudentRow(student) {
  return `
    <tr class="border-b border-slate-100 hover:bg-slate-50">
      <td class="px-4 py-3">
        <div class="font-semibold text-slate-900">${escapeHtml(student.fullName || "—")}</div>
        <div class="text-xs text-slate-500">${escapeHtml(student.userNumber || "—")}</div>
      </td>
      <td class="px-4 py-3">
        <div class="text-sm text-slate-800">${escapeHtml((student.programme || "—").toUpperCase())}</div>
        <div class="text-xs text-slate-500">${escapeHtml((student.department || "—").toUpperCase())}</div>
      </td>
      <td class="px-4 py-3">
        <div class="text-sm text-slate-800">${escapeHtml(student.deferralInfo?.reason || "—")}</div>
      </td>
      <td class="px-4 py-3">
        <div class="text-sm text-slate-800">${escapeHtml(student.deferralInfo?.plannedResumption || "—")}</div>
      </td>
      <td class="px-4 py-3">
        <div class="text-sm text-slate-800">${escapeHtml(student.stage || "—")}</div>
        <div class="text-xs text-slate-500">${formatDate(student.deferralInfo?.date)}</div>
      </td>
      <td class="px-4 py-3">
        ${badge({ label: student.status || "Deferred", tone: "yellow" })}
      </td>
      <td class="px-4 py-3">
        <button data-resume-student="1" data-id="${student._id}" class="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 transition">
          Resume Student
        </button>
      </td>
    </tr>
  `;
}

function mountTable(rows, deferredStudents) {
  setPageContent(`
    <div class="space-y-6">
    <div class="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
      <div class="flex items-center justify-between gap-4 px-6 py-5 border-b border-slate-200">
        <div>
          <div class="text-lg font-semibold text-slate-900">Pending Deferral Requests</div>
          <div class="text-sm text-slate-500">Review student deferral and resumption applications.</div>
        </div>
        <div class="text-sm font-semibold text-slate-600">${rows.length} pending</div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left">
          <thead class="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-4 py-3">Student</th>
              <th class="px-4 py-3">Programme</th>
              <th class="px-4 py-3">Reason</th>
              <th class="px-4 py-3">Planned Resumption</th>
              <th class="px-4 py-3">Stage / Submitted</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody id="deferralsTbody">
            ${rows.map(requestRow).join("")}
          </tbody>
        </table>
      </div>
    </div>
    <div class="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
      <div class="flex items-center justify-between gap-4 px-6 py-5 border-b border-slate-200">
        <div>
          <div class="text-lg font-semibold text-slate-900">Deferred Students</div>
          <div class="text-sm text-slate-500">Resume a student directly back to studies when appropriate.</div>
        </div>
        <div class="text-sm font-semibold text-slate-600">${deferredStudents.length} deferred</div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left">
          <thead class="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th class="px-4 py-3">Student</th>
              <th class="px-4 py-3">Programme</th>
              <th class="px-4 py-3">Reason</th>
              <th class="px-4 py-3">Planned Resumption</th>
              <th class="px-4 py-3">Stage / Deferred</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody id="deferredStudentsTbody">
            ${deferredStudents.length ? deferredStudents.map(deferredStudentRow).join("") : `<tr><td colspan="7" class="px-4 py-8 text-center text-sm text-slate-500">No students are currently deferred.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  `);
}

async function promptForComment(actionLabel) {
  return new Promise((resolve) => {
    const modal = openModal({
      title: `${actionLabel} Deferral Request`,
      bodyHtml: `
        <div class="space-y-3">
          <div class="text-sm text-slate-600">Add an optional note for this decision.</div>
          <textarea id="deferralReviewComment" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm min-h-[120px]" placeholder="Director note..."></textarea>
        </div>
      `,
      footerHtml: `
        <div class="flex justify-end gap-2">
          <button data-modal-close="1" class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
          <button id="saveDeferralReview" class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition">${actionLabel}</button>
        </div>
      `,
      size: "sm",
    });

    modal.qs("#saveDeferralReview")?.addEventListener("click", () => {
      const comment = modal.qs("#deferralReviewComment")?.value || "";
      modal.close();
      resolve(comment);
    });

    modal.qs("[data-modal-close='1']")?.addEventListener("click", () => {
      modal.close();
      resolve(null);
    });
  });
}

async function load() {
  setPageMeta({
    title: "Deferrals",
    subtitle: "Director approval queue for student deferral requests",
  });

  try {
    const response = await api.getDeferralRequests();
    const requests = response?.requests || [];
    const deferredStudents = response?.deferredStudents || [];

    if (!requests.length && !deferredStudents.length) {
      setPageContent(
        mountEmptyState({
          title: "No deferral activity",
          message: "Pending requests and deferred students will appear here.",
        }),
      );
      return;
    }

    mountTable(requests, deferredStudents);
    wireActions();
  } catch (error) {
    console.error(error);
    toast(error.message || "Failed to load deferral requests", { tone: "red" });
    setPageContent(
      mountEmptyState({
        title: "Unable to load deferrals",
        message: "Check that the backend is running and the director session is valid.",
      }),
    );
  }
}

function wireActions() {
  document.getElementById("deferralsTbody")?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-deferral-action]");
    if (!button) return;

    const studentId = button.dataset.id;
    const action = button.dataset.deferralAction;
    const confirm = await confirmModal({
      title: `${action === "approve" ? "Approve" : "Reject"} request`,
      message: `Are you sure you want to ${action} this deferral request?`,
      confirmText: action === "approve" ? "Continue to Approve" : "Continue to Reject",
      tone: action === "approve" ? "blue" : "red",
    });
    if (!confirm) return;

    const comment = await promptForComment(action === "approve" ? "Approve" : "Reject");
    if (comment === null) return;

    try {
      await api.reviewDeferralRequest(studentId, { action, comment });
      toast(`Deferral request ${action}d`, { tone: action === "approve" ? "green" : "yellow" });
      await load();
    } catch (error) {
      console.error(error);
      toast(error.message || "Failed to review request", { tone: "red" });
    }
  });

  document.getElementById("deferredStudentsTbody")?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-resume-student]");
    if (!button) return;

    const studentId = button.dataset.id;
    const confirm = await confirmModal({
      title: "Resume student",
      message: "Are you sure you want to resume this student back to studies?",
      confirmText: "Resume Student",
      tone: "blue",
    });
    if (!confirm) return;

    try {
      await api.resumeStudent(studentId);
      toast("Student resumed successfully", { tone: "green" });
      await load();
    } catch (error) {
      console.error(error);
      toast(error.message || "Failed to resume student", { tone: "red" });
    }
  });
}

load();
