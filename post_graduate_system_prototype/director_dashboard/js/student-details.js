import { api } from "./api.js";
import {
  STAGES,
  badge,
  confirmModal,
  escapeHtml,
  formatDate,
  getParam,
  mountEmptyState,
  openModal,
  setPageContent,
  setPageMeta,
  statusTone,
  toast,
} from "./main.js";

function normalizeDetails(raw) {
  const d = raw?.data || raw?.student || raw;
  return d || {};
}

function timeline(currentStage) {
  const idx = Math.max(0, STAGES.findIndex((s) => s === currentStage));
  const percent = STAGES.length ? Math.round(((idx + 1) / STAGES.length) * 100) : 0;
  return `
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-sm font-semibold">Stage timeline</div>
          <div class="mt-1 text-xs text-slate-500">Progress through the full postgraduate lifecycle</div>
        </div>
        ${badge({ label: `${percent}%`, tone: "blue" })}
      </div>
      <div class="mt-4">
        <div class="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div class="h-2 bg-blue-600 rounded-full" style="width:${percent}%"></div>
        </div>
        <div class="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs text-slate-600">
          ${STAGES.map((s, i) => {
            const isDone = i <= idx;
            return `<div class="flex items-center gap-2">
              <span class="h-2 w-2 rounded-full ${isDone ? "bg-blue-600" : "bg-slate-300"}"></span>
              <span class="${i === idx ? "font-semibold text-slate-900" : ""}">${escapeHtml(s)}</span>
            </div>`;
          }).join("")}
        </div>
      </div>
    </div>
  `;
}

function supervisorsSection(sups = []) {
  const arr = Array.isArray(sups) ? sups : [];
  return `
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div class="flex items-end justify-between gap-3">
        <div>
          <div class="text-sm font-semibold">Supervisors</div>
          <div class="mt-1 text-xs text-slate-500">Sup1, Sup2, Sup3 (where applicable) • contacts • approval status</div>
        </div>
        <a href="./supervisors.html" class="text-sm font-semibold text-blue-700 hover:underline">Supervisors page</a>
      </div>
      <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        ${arr.length ? arr.map((x, i) => {
          const role = x?.role || `Sup${i + 1}`;
          const name = x?.name || x?.fullName || "Supervisor";
          const email = x?.email || x?.contact || "—";
          const phone = x?.phone || "—";
          const approval = x?.approvalStatus || x?.status || "Pending";
          const tone = String(approval).toLowerCase().includes("approved") ? "green" : String(approval).toLowerCase().includes("rejected") ? "red" : "yellow";
          return `
            <div class="rounded-2xl border border-slate-200 p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-xs font-semibold text-slate-500">${escapeHtml(role)}</div>
                  <div class="mt-1 text-sm font-semibold text-slate-900 truncate">${escapeHtml(name)}</div>
                  <div class="mt-1 text-xs text-slate-600 truncate">${escapeHtml(email)} • ${escapeHtml(phone)}</div>
                </div>
                <div class="shrink-0">${badge({ label: approval, tone })}</div>
              </div>
            </div>
          `;
        }).join("") : `<div class="text-sm text-slate-600">No supervisors returned by the API.</div>`}
      </div>
    </div>
  `;
}

function documentsSection(docs = {}) {
  const items = [
    ["Concept note", docs?.conceptNote],
    ["Proposal", docs?.proposal],
    ["Thesis", docs?.thesis],
    ["NACOSTI permit", docs?.nacostiPermit],
    ["Publication", docs?.publication],
    ["Mentorship", docs?.mentorship],
    ["Fee clearance", docs?.feeClearance],
  ];
  return `
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div class="text-sm font-semibold">Documents & requirements</div>
      <div class="mt-1 text-xs text-slate-500">Compliance and required artifacts</div>
      <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        ${items.map(([label, v]) => {
          const status = (v && (v.status || v.state)) || (typeof v === "string" ? v : v ? "Available" : "Missing");
          const s = String(status || "").toLowerCase();
          const tone = s.includes("missing") ? "red" : s.includes("pending") ? "yellow" : s.includes("available") || s.includes("approved") || s.includes("cleared") ? "green" : "slate";
          const link = v?.url || v?.link;
          return `
            <div class="rounded-2xl border border-slate-200 p-4">
              <div class="flex items-center justify-between gap-3">
                <div class="text-sm font-semibold">${escapeHtml(label)}</div>
                ${badge({ label: status, tone })}
              </div>
              <div class="mt-2 text-xs text-slate-500">${link ? `<a class="text-blue-700 font-semibold hover:underline" href="${link}">Open</a>` : "—"}</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function approvalChain(chain) {
  const steps = Array.isArray(chain) && chain.length ? chain : ["Sup1", "Sup2", "Sup3", "Director", "Finance"];
  return `
    <div class="flex flex-wrap items-center gap-2 text-xs">
      ${steps.map((s, i) => `
        <span class="inline-flex items-center gap-2">
          ${badge({ label: s?.role || s?.name || s, tone: String(s?.status || "").toLowerCase().includes("approved") ? "green" : String(s?.status || "").toLowerCase().includes("rejected") ? "red" : "slate" })}
          ${i < steps.length - 1 ? `<span class="text-slate-400">→</span>` : ""}
        </span>
      `).join("")}
    </div>
  `;
}

function reportsSection(reports = []) {
  const arr = Array.isArray(reports) ? reports : [];
  return `
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div class="flex items-end justify-between gap-3">
        <div>
          <div class="text-sm font-semibold">Quarterly reports</div>
          <div class="mt-1 text-xs text-slate-500">Submitted/approved/missing • full approval chain visualization</div>
        </div>
        <a href="./reports.html" class="text-sm font-semibold text-blue-700 hover:underline">Open reports</a>
      </div>

      <div class="mt-4 space-y-3">
        ${arr.length ? arr.map((r) => {
          const title = r?.title || r?.period || `Report ${r?.id || ""}`.trim() || "Quarterly report";
          const status = r?.status || "Pending";
          const s = String(status).toLowerCase();
          const tone = s.includes("approved") ? "green" : s.includes("missing") ? "red" : s.includes("returned") || s.includes("rejected") ? "red" : "yellow";
          return `
            <div class="rounded-2xl border border-slate-200 p-4">
              <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <div class="text-sm font-semibold truncate">${escapeHtml(title)}</div>
                    ${badge({ label: status, tone })}
                  </div>
                  <div class="mt-1 text-xs text-slate-600">Submitted: ${escapeHtml(formatDate(r?.submittedAt || r?.date))}</div>
                </div>
                <div class="shrink-0">
                  ${approvalChain(r?.approvalChain)}
                </div>
              </div>
            </div>
          `;
        }).join("") : `<div class="text-sm text-slate-600">No quarterly reports returned by the API.</div>`}
      </div>
    </div>
  `;
}

function correctionsSection(corr = {}) {
  const ai = Array.isArray(corr?.ai) ? corr.ai : [];
  const checklist = Array.isArray(corr?.checklist) ? corr.checklist : [];
  return `
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div class="text-sm font-semibold">Corrections (AI + supervisor validation)</div>
      <div class="mt-1 text-xs text-slate-500">Presentation corrections, validation checklist, and progress</div>
      <div class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div class="rounded-2xl border border-slate-200 p-4">
          <div class="text-xs font-semibold text-slate-600">AI corrections</div>
          <div class="mt-2 space-y-2">
            ${ai.length ? ai.slice(0, 8).map((x) => `
              <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
                <div class="font-semibold">${escapeHtml(x?.area || x?.title || "Correction")}</div>
                <div class="mt-1 text-slate-600">${escapeHtml(x?.note || x?.message || x)}</div>
              </div>
            `).join("") : `<div class="text-sm text-slate-600">No AI corrections returned by the API.</div>`}
          </div>
        </div>
        <div class="rounded-2xl border border-slate-200 p-4">
          <div class="text-xs font-semibold text-slate-600">Supervisor validation checklist</div>
          <div class="mt-2 space-y-2">
            ${checklist.length ? checklist.slice(0, 10).map((x) => {
              const done = !!(x?.done || x?.completed);
              return `
                <div class="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <div class="text-xs text-slate-700">${escapeHtml(x?.item || x?.label || x)}</div>
                  ${badge({ label: done ? "Done" : "Pending", tone: done ? "green" : "yellow" })}
                </div>
              `;
            }).join("") : `<div class="text-sm text-slate-600">No checklist items returned by the API.</div>`}
          </div>
        </div>
      </div>
    </div>
  `;
}

function finalStagesSection(final = {}) {
  const examiners = Array.isArray(final?.examiners) ? final.examiners : [];
  return `
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div class="text-sm font-semibold">Final stages (External examiners • Defense • Graduation)</div>
      <div class="mt-1 text-xs text-slate-500">Everything needed to clear the student to graduate</div>
      <div class="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div class="rounded-2xl border border-slate-200 p-4">
          <div class="text-xs font-semibold text-slate-600">External examiners</div>
          <div class="mt-2 space-y-2">
            ${examiners.length ? examiners.map((x) => `
              <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
                <div class="font-semibold text-slate-900">${escapeHtml(x?.name || "Examiner")}</div>
                <div class="mt-1 text-slate-600">${escapeHtml(x?.institution || "—")} • ${escapeHtml(x?.email || "—")}</div>
                <div class="mt-2">${badge({ label: x?.reportStatus || "Report pending", tone: String(x?.reportStatus || "").toLowerCase().includes("submitted") ? "green" : "yellow" })}</div>
              </div>
            `).join("") : `<div class="text-sm text-slate-600">No examiners returned by the API.</div>`}
          </div>
        </div>
        <div class="rounded-2xl border border-slate-200 p-4">
          <div class="text-xs font-semibold text-slate-600">Defense</div>
          <div class="mt-2 text-sm font-semibold text-slate-900">${escapeHtml(formatDate(final?.defenseDate))}</div>
          <div class="mt-2 text-xs text-slate-600">Venue: ${escapeHtml(final?.defenseVenue || "—")}</div>
          <div class="mt-2">${badge({ label: final?.defenseStatus || "Not scheduled", tone: String(final?.defenseStatus || "").toLowerCase().includes("scheduled") ? "blue" : "slate" })}</div>
          <div class="mt-3 text-xs text-slate-600">Final corrections: ${escapeHtml(final?.finalCorrectionsStatus || "—")}</div>
        </div>
        <div class="rounded-2xl border border-slate-200 p-4">
          <div class="text-xs font-semibold text-slate-600">Graduation clearance</div>
          <div class="mt-2">${badge({ label: final?.graduationClearance || "Pending", tone: String(final?.graduationClearance || "").toLowerCase().includes("cleared") ? "green" : "yellow" })}</div>
          <div class="mt-3 text-xs text-slate-600">Finance: ${escapeHtml(final?.financeClearance || "—")}</div>
          <div class="mt-2 text-xs text-slate-600">Director approval: ${escapeHtml(final?.directorApproval || "—")}</div>
          <div class="mt-4 flex flex-wrap gap-2">
            <a href="./graduation.html" class="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">Open graduation</a>
            <a href="./thesis.html" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition">Thesis & defense</a>
          </div>
        </div>
      </div>
    </div>
  `;
}

function headerCard(s) {
  const name = s?.name || s?.fullName || `${s?.firstName || ""} ${s?.lastName || ""}`.trim() || "Student";
  const reg = s?.registrationNumber || s?.regNo || s?.studentId || s?.id || "—";
  const programme = s?.programme || s?.program || "—";
  const department = s?.department || "—";
  const stage = s?.stage || s?.currentStage || "—";
  const status = s?.status || "—";
  const sid = String(s?.id || s?.studentId || reg);
  return `
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <div class="text-xl font-semibold tracking-tight truncate">${escapeHtml(name)}</div>
            ${badge({ label: status, tone: statusTone(status) })}
          </div>
          <div class="mt-1 text-sm text-slate-600">Reg/ID: <span class="font-semibold text-slate-900">${escapeHtml(reg)}</span></div>
          <div class="mt-1 text-sm text-slate-600">${escapeHtml(programme)} • ${escapeHtml(department)}</div>
          <div class="mt-2 flex flex-wrap gap-2">${badge({ label: stage, tone: "blue" })}</div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button data-dir="actions" data-student-id="${escapeHtml(sid)}" class="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">Director actions</button>
          <a href="./reports.html" class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition">Quarterly reports</a>
          <a href="./pipeline.html" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition">Back to pipeline</a>
        </div>
      </div>
    </div>
  `;
}

function academicInfo(s) {
  return `
    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <div class="text-sm font-semibold">Academic info</div>
      <div class="mt-1 text-xs text-slate-500">Programme, department, admission date, current stage, and history</div>
      <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="rounded-2xl border border-slate-200 p-4">
          <div class="text-xs font-semibold text-slate-600">Programme</div>
          <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(s?.programme || s?.program || "—")}</div>
        </div>
        <div class="rounded-2xl border border-slate-200 p-4">
          <div class="text-xs font-semibold text-slate-600">Department</div>
          <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(s?.department || "—")}</div>
        </div>
        <div class="rounded-2xl border border-slate-200 p-4">
          <div class="text-xs font-semibold text-slate-600">Admission date</div>
          <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(formatDate(s?.admissionDate || s?.admittedAt))}</div>
        </div>
        <div class="rounded-2xl border border-slate-200 p-4">
          <div class="text-xs font-semibold text-slate-600">Current stage</div>
          <div class="mt-1">${badge({ label: s?.stage || s?.currentStage || "—", tone: "blue" })}</div>
        </div>
      </div>
    </div>
  `;
}

function directorActionsModal({ studentId, studentName, currentStage }) {
  const stageOptions = STAGES.map(
    (s) =>
      `<option value="${escapeHtml(s)}" ${s === currentStage ? "selected" : ""}>${escapeHtml(s)}</option>`
  ).join("");

    const modal = openModal({
    title: `Director Command Center — ${studentName}`,
    size: "lg",
    bodyHtml: `
      <div class="space-y-4 animate-in">
        <div class="rounded-2xl dark-glass p-6 power-glow">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-[10px] font-bold uppercase tracking-widest text-blue-400">Governance & Override</div>
              <div class="mt-1 text-lg font-bold">Executive Authority System</div>
              <div class="mt-1 text-sm text-slate-300">Granting administrative bypass for compliance items. Audit trail active.</div>
            </div>
            <div class="h-12 w-12 rounded-2xl bg-white/10 grid place-items-center text-2xl">📋</div>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <button data-act="notify" class="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 transition uppercase tracking-wider">Target Notice</button>
            <button data-act="flagRisk" class="rounded-xl border border-rose-500/30 bg-rose-500/20 px-4 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/30 transition uppercase tracking-wider">Mark High Risk</button>
            <button data-act="overrideSkip" class="rounded-xl border border-amber-500/30 bg-amber-500/20 px-4 py-2 text-xs font-bold text-amber-400 hover:bg-amber-500/30 transition uppercase tracking-wider">Skip Rule</button>
            <button data-act="forceChain" class="rounded-xl border border-amber-500/30 bg-amber-500/20 px-4 py-2 text-xs font-bold text-amber-400 hover:bg-amber-500/30 transition uppercase tracking-wider">Force Chain</button>
            <button data-act="bypassMissingReport" class="rounded-xl border border-rose-500/30 bg-rose-500/20 px-4 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/30 transition uppercase tracking-wider">Bypass Report</button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <div class="text-sm font-semibold">Academic control</div>
            <div class="mt-1 text-xs text-slate-500">Change stage, return, or force progression</div>
            <div class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select id="stageSel" class="sm:col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400">${stageOptions}</select>
              <select id="stageMode" class="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400">
                <option value="advance">Advance</option>
                <option value="return">Return</option>
                <option value="force">Force</option>
              </select>
            </div>
            <div class="mt-2">
              <input id="reason" placeholder="Reason / note (audit trail)" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400" />
            </div>
            <div class="mt-3 flex gap-2">
              <button data-act="saveStage" class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition">Apply stage</button>
              <button data-act="resetStage" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition">Reset to Coursework</button>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-4">
            <div class="text-sm font-semibold">Supervisor control</div>
            <div class="mt-1 text-xs text-slate-500">Assign/replace Sup1, Sup2, Sup3 (override supported)</div>
            <div class="mt-3 grid grid-cols-1 gap-2">
              <input id="sup1" placeholder="Sup1 (staff id/email)" class="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400" />
              <input id="sup2" placeholder="Sup2 (optional)" class="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400" />
              <input id="sup3" placeholder="Sup3 (PhD optional)" class="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400" />
              <label class="flex items-center gap-2 text-xs text-slate-700">
                <input id="supOverride" type="checkbox" class="h-4 w-4" />
                Emergency override
              </label>
            </div>
            <div class="mt-3">
              <button data-act="saveSup" class="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">Assign supervisors</button>
            </div>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-4">
          <div class="text-sm font-semibold">Interventions & notes</div>
          <div class="mt-1 text-xs text-slate-500">Director notes and targeted reminders</div>
          <div class="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-2">
            <textarea id="note" rows="3" class="lg:col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400" placeholder="Write an intervention note (audit trail)…"></textarea>
            <div class="space-y-2">
              <button data-act="saveNote" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition">Save note</button>
              <button data-act="remindReports" class="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition">Remind: reports</button>
              <button data-act="remindDefense" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition">Remind: defense</button>
            </div>
          </div>
        </div>
      </div>
    `,
    footerHtml: `<div class="text-xs text-slate-500">All actions are Director-level and should be audited by the backend.</div>`,
  });

  const act = async (action) => {
    try {
      if (action === "saveStage") {
        const stage = modal.qs("#stageSel")?.value;
        const mode = modal.qs("#stageMode")?.value;
        const reason = modal.qs("#reason")?.value?.trim() || "";
        const ok = await confirmModal({
          title: "Confirm stage change",
          message: `Apply stage change for ${studentName}?`,
          confirmText: "Apply",
          tone: mode === "force" ? "yellow" : "blue",
        });
        if (!ok) return;
        await api.updateStudentStage(studentId, { stage, mode, reason });
        toast("Stage updated", { tone: "green" });
        modal.close();
        await load();
        return;
      }
      if (action === "resetStage") {
        const ok = await confirmModal({
          title: "Reset stage",
          message: `Reset ${studentName} back to Coursework?`,
          confirmText: "Reset",
          tone: "yellow",
        });
        if (!ok) return;
        await api.updateStudentStage(studentId, { stage: "Coursework", mode: "return", reason: "Reset by Director" });
        toast("Stage reset", { tone: "yellow" });
        modal.close();
        await load();
        return;
      }
      if (action === "saveSup") {
        const sup1 = modal.qs("#sup1")?.value?.trim() || "";
        const sup2 = modal.qs("#sup2")?.value?.trim() || "";
        const sup3 = modal.qs("#sup3")?.value?.trim() || "";
        const override = !!modal.qs("#supOverride")?.checked;
        const ok = await confirmModal({
          title: "Assign supervisors",
          message: `Assign supervisors for ${studentName}?`,
          confirmText: "Assign",
          tone: override ? "yellow" : "blue",
        });
        if (!ok) return;
        await api.assignSupervisors(studentId, { sup1, sup2, sup3, override });
        toast("Supervisors assigned", { tone: "green" });
        modal.close();
        await load();
        return;
      }
      if (action === "flagRisk") {
        const note = modal.qs("#note")?.value?.trim() || "Marked at risk by Director";
        const ok = await confirmModal({
          title: "Mark at risk",
          message: `Flag ${studentName} as At Risk?`,
          confirmText: "Flag",
          tone: "red",
        });
        if (!ok) return;
        await api.flagStudent(studentId, { atRisk: true, note });
        toast("Student flagged at risk", { tone: "red" });
        modal.close();
        await load();
        return;
      }
      if (action === "overrideSkip") {
        const note = modal.qs("#reason")?.value?.trim() || "Skip requirements";
        const ok = await confirmModal({
          title: "Skip requirements",
          message: `Override requirements for ${studentName}?`,
          confirmText: "Override",
          tone: "yellow",
        });
        if (!ok) return;
        await api.overrideStudent(studentId, { type: "skipRequirements", note });
        toast("Requirements overridden", { tone: "yellow" });
        modal.close();
        await load();
        return;
      }
      if (action === "forceChain") {
        const note = modal.qs("#note")?.value?.trim() || "Force approval chain completion";
        const ok = await confirmModal({
          title: "Force approval chain",
          message: `Force approval chain completion for ${studentName}?`,
          confirmText: "Force",
          tone: "yellow",
        });
        if (!ok) return;
        await api.overrideStudent(studentId, { type: "forceApprovalChain", note });
        toast("Approval chain forced", { tone: "yellow" });
        modal.close();
        await load();
        return;
      }
      if (action === "bypassMissingReport") {
        const note = modal.qs("#note")?.value?.trim() || "Bypass missing quarterly report";
        const ok = await confirmModal({
          title: "Bypass missing report",
          message: `Bypass missing report for ${studentName}?`,
          confirmText: "Bypass",
          tone: "red",
        });
        if (!ok) return;
        await api.overrideStudent(studentId, { type: "bypassMissingReport", note });
        toast("Missing report bypassed", { tone: "yellow" });
        modal.close();
        await load();
        return;
      }
      if (action === "saveNote") {
        const note = modal.qs("#note")?.value?.trim() || "";
        if (!note) return toast("Write a note first", { tone: "yellow" });
        await api.addStudentNote(studentId, { note });
        toast("Note saved", { tone: "green" });
        modal.qs("#note").value = "";
        return;
      }
      if (action === "remindReports") {
        await api.sendNotification({
          audience: "students",
          studentId,
          type: "reminder",
          message: "Reminder: submit and complete your quarterly report approvals.",
        });
        toast("Report reminder sent", { tone: "blue" });
        return;
      }
      if (action === "remindDefense") {
        await api.sendNotification({
          audience: "students",
          studentId,
          type: "reminder",
          message: "Reminder: defense tasks pending. Confirm scheduling and required documents.",
        });
        toast("Defense reminder sent", { tone: "blue" });
        return;
      }
      if (action === "notify") {
        const msg = window.prompt("Notification message to send to this student:") || "";
        if (!msg.trim()) return;
        await api.sendNotification({ audience: "students", studentId, type: "notice", message: msg.trim() });
        toast("Notification sent", { tone: "blue" });
      }
    } catch (err) {
      console.error(err);
      toast(err?.message || "Action failed (API not ready)", { tone: "red" });
    }
  };

  modal.host.addEventListener("click", (e) => {
    const b = e.target?.closest?.("button[data-act]");
    if (!b) return;
    act(b.dataset.act);
  });
}

async function load() {
  const id = getParam("id");
  setPageMeta({ title: "Student profile", subtitle: "Loading student details…" });
  setPageContent(
    `<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
      <div class="h-6 w-64 rounded skeleton"></div>
      <div class="mt-3 h-3 w-80 max-w-full rounded skeleton"></div>
      <div class="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="h-56 rounded-2xl border border-slate-200 bg-slate-50 skeleton"></div>
        <div class="h-56 rounded-2xl border border-slate-200 bg-slate-50 skeleton"></div>
      </div>
    </div>`
  );

  if (!id) {
    setPageContent(
      mountEmptyState({
        title: "Missing student id",
        message: "Open this page from Students or Pipeline so the id is provided (student-details.html?id=...).",
        actionsHtml: `<a href="./students.html" class="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">Open students</a>`,
      })
    );
    return;
  }

  try {
    const raw = await api.getStudentDetails(id);
    const s = normalizeDetails(raw);

    const currentStage = s?.currentStage || s?.stage || "Coursework";
    setPageMeta({ title: "Student profile", subtitle: `${s?.department || "INFOCOMS"} • governance • approvals • compliance` });

    setPageContent(`
      <div class="space-y-4">
        ${headerCard(s)}
        ${academicInfo(s)}
        ${timeline(currentStage)}
        ${supervisorsSection(s?.supervisors || s?.supervision || [])}
        ${documentsSection(s?.documents || s?.requirements || {})}
        ${reportsSection(s?.quarterlyReports || s?.reports || [])}
        ${correctionsSection(s?.corrections || {})}
        ${finalStagesSection(s?.finalStages || s?.thesisDefense || {})}
      </div>
    `);

    const root = document.getElementById("pageContent");
    if (root && root.dataset.dirWired !== "1") {
      root.dataset.dirWired = "1";
      root.addEventListener("click", (e) => {
        const b = e.target?.closest?.("button[data-dir='actions']");
        if (!b) return;
        const studentId = b.dataset.studentId || id;
        const studentName =
          s?.name || s?.fullName || `${s?.firstName || ""} ${s?.lastName || ""}`.trim() || "Student";
        directorActionsModal({ studentId, studentName, currentStage });
      });
    }
  } catch (e) {
    console.error(e);
    toast(e?.message || "Failed to load student details", { tone: "red" });
    setPageContent(
      mountEmptyState({
        title: "Student details unavailable",
        message: "This page calls /api/students/:id. Ensure the endpoint returns academic info, supervisors, docs, reports, corrections, and final stages.",
        actionsHtml: `<a href="./students.html" class="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">Back to students</a>`,
      })
    );
  }
}

load();

