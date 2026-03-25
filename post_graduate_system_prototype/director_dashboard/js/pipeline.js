import { api } from "./api.js";
import {
  STAGES,
  badge,
  escapeHtml,
  openModal,
  confirmModal,
  mountEmptyState,
  setPageContent,
  setPageMeta,
  statusTone,
  issueTone,
  toast,
} from "./main.js";

function normalizePipeline(raw) {
  // Expected (ideal) shape:
  // { stages: [{ stage: "...", students: [...] }, ...] }
  // Accept also: { data: ... } or flat student list with stage field.
  const root = raw?.data || raw;
  if (Array.isArray(root?.stages)) return root;
  if (Array.isArray(root)) return { students: root };
  if (Array.isArray(root?.students)) return root;
  return { students: [] };
}

function studentCard(s) {
  const name = s?.name || s?.fullName || `${s?.firstName || ""} ${s?.lastName || ""}`.trim() || "Student";
  const id = s?.id || s?.studentId || s?.registrationNumber || s?.regNo || "—";
  const dept = s?.department || "—";
  const programme = s?.programme || s?.program || "—";
  const stage = s?.stage || s?.currentStage || "—";
  const status = s?.status || "—";
  const supervisors = Array.isArray(s?.supervisors)
    ? s.supervisors
    : Array.isArray(s?.supervisorNames)
      ? s.supervisorNames
      : [];
  const issues = Array.isArray(s?.alerts) ? s.alerts : Array.isArray(s?.issues) ? s.issues : [];

  const supText = supervisors.length ? supervisors.join(", ") : "Not assigned";
  const issuesHtml = issues.length
    ? `<div class="mt-2 flex flex-wrap gap-1.5">${issues
        .slice(0, 4)
        .map((i) => badge({ label: i?.label || i?.type || i, tone: issueTone(i?.label || i?.type || i) }))
        .join("")}${issues.length > 4 ? badge({ label: `+${issues.length - 4}`, tone: "slate" }) : ""}</div>`
    : "";

  const href = `./student-details.html?id=${encodeURIComponent(String(s?.id || s?.studentId || id))}`;
  const studentId = String(s?.id || s?.studentId || id);

  return `
    <a href="${href}" class="block rounded-2xl border border-slate-200 bg-white p-4 shadow-soft hover:shadow transition">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-slate-900 truncate">${escapeHtml(name)}</div>
          <div class="mt-0.5 text-xs text-slate-500 truncate">${escapeHtml(id)} • ${escapeHtml(dept)} • ${escapeHtml(programme)}</div>
        </div>
        <div class="shrink-0 flex items-center gap-2">
          ${badge({ label: status, tone: statusTone(status) })}
          <button
            type="button"
            data-student-action="1"
            data-student-id="${escapeHtml(studentId)}"
            data-student-name="${escapeHtml(name)}"
            data-student-stage="${escapeHtml(stage)}"
            class="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition"
            title="Director controls"
          >
            Control
          </button>
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        ${badge({ label: stage, tone: "blue" })}
        <span class="text-xs text-slate-600">Supervisors: <span class="font-semibold text-slate-800">${escapeHtml(
          supText
        )}</span></span>
      </div>
      ${issuesHtml}
    </a>
  `;
}

function stageColumn(stageLabel, students) {
  return `
    <section class="w-[320px] shrink-0">
      <div class="sticky top-[76px] z-10 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-sm font-semibold truncate">${escapeHtml(stageLabel)}</div>
            <div class="mt-0.5 text-xs text-slate-500">${students.length} student${students.length === 1 ? "" : "s"}</div>
          </div>
          <div class="h-2.5 w-2.5 rounded-full bg-blue-600"></div>
        </div>
      </div>
      <div class="mt-3 space-y-3">
        ${students.length ? students.map(studentCard).join("") : `<div class="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-xs text-slate-500">No students in this stage.</div>`}
      </div>
    </section>
  `;
}

function render({ columns, totals }) {
  setPageMeta({
    title: "Pipeline (Kanban)",
    subtitle: "Every student grouped by stage • issues visible • click for full profile",
  });

  setPageContent(`
    <div class="space-y-4">
      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div class="text-xl font-bold tracking-tight text-slate-900">Global Pipeline Command</div>
            <div class="mt-1 text-xs text-slate-500 font-medium tracking-wide uppercase">
              Coursework → Concept Note → Proposal → PG Approval → Fieldwork → Thesis → Defense → Graduation
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <div class="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span class="text-xs font-bold text-slate-700">${totals.active} Active</span>
            </div>
            <button id="bulkApprove" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition uppercase tracking-wider">Bulk approve stages</button>
            <button id="exportPipeline" class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition uppercase tracking-wider">Export Analytics</button>
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white shadow-soft">
        <div class="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div class="text-sm font-semibold">Kanban view</div>
          <div class="text-xs text-slate-600">Tip: scroll horizontally on desktop; on mobile, swipe.</div>
        </div>
        <div class="p-4 overflow-x-auto app-scroll">
          <div class="flex gap-4 items-start">
            ${columns.map((c) => stageColumn(c.stage, c.students)).join("")}
          </div>
        </div>
      </div>
    </div>
  `);
}

function computeTotals(students) {
  const norm = (v) => String(v || "").toLowerCase();
  const total = students.length;
  const active = students.filter((s) => norm(s.status) === "active").length;
  const deferred = students.filter((s) => norm(s.status) === "deferred").length;
  const graduated = students.filter((s) => norm(s.status) === "graduated").length;
  return { total, active, deferred, graduated };
}

async function load() {
  setPageMeta({ title: "Pipeline (Kanban)", subtitle: "Loading pipeline from API…" });
  setPageContent(
    `<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
      <div class="h-5 w-48 rounded skeleton"></div>
      <div class="mt-3 h-3 w-80 max-w-full rounded skeleton"></div>
      <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${Array.from({ length: 6 })
          .map(() => `<div class="h-36 rounded-2xl border border-slate-200 bg-slate-50 skeleton"></div>`)
          .join("")}
      </div>
    </div>`
  );

  try {
    const raw = await api.getPipeline();
    const normalized = normalizePipeline(raw);

    let columns = [];
    if (Array.isArray(normalized.stages)) {
      columns = normalized.stages.map((x) => ({
        stage: x.stage || x.name || "Stage",
        students: Array.isArray(x.students) ? x.students : [],
      }));
    } else {
      const students = Array.isArray(normalized.students) ? normalized.students : [];
      const byStage = new Map();
      for (const s of students) {
        const key = s?.stage || s?.currentStage || "Unassigned";
        if (!byStage.has(key)) byStage.set(key, []);
        byStage.get(key).push(s);
      }

      // Keep preferred order using STAGES, then unknowns
      const orderedKeys = [
        ...STAGES.filter((k) => byStage.has(k)),
        ...Array.from(byStage.keys()).filter((k) => !STAGES.includes(k)),
      ];
      columns = orderedKeys.map((k) => ({ stage: k, students: byStage.get(k) || [] }));
    }

    const flatStudents = columns.flatMap((c) => c.students);
    render({ columns, totals: computeTotals(flatStudents) });
    wireDirectorActions();
  } catch (e) {
    console.error(e);
    toast(e?.message || "Failed to load pipeline", { tone: "red" });
    setPageContent(
      mountEmptyState({
        title: "Pipeline data unavailable",
        message:
          "This page is API-ready, but the pipeline endpoint didn’t respond. Implement /api/pipeline (preferred: { stages: [...] }) or return a flat students list with a stage field.",
        actionsHtml: `
          <a href="./dashboard.html" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition">Back to dashboard</a>
          <a href="./students.html" class="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">Open students</a>
        `,
      })
    );
  }
}

load();

function wireDirectorActions() {
  const root = document.getElementById("pageContent");
  if (!root || root.dataset.wired === "1") return;
  root.dataset.wired = "1";

  root.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("button[data-student-action='1']");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    const studentId = btn.dataset.studentId;
    const studentName = btn.dataset.studentName || "Student";
    const currentStage = btn.dataset.studentStage || "";

    const stageOptions = STAGES.map((s) => `<option value="${escapeHtml(s)}" ${s === currentStage ? "selected" : ""}>${escapeHtml(s)}</option>`).join("");

    const modal = openModal({
      title: `Executive Command — ${studentName}`,
      size: "lg",
      bodyHtml: `
        <div class="space-y-4 animate-in">
          <div class="rounded-2xl dark-glass p-5 power-glow">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-xs font-bold uppercase tracking-widest text-blue-400">Director Authority</div>
                <div class="mt-1 text-sm font-medium text-white">Bypass system restrictions and force lifecycle events.</div>
              </div>
              <div class="h-10 w-10 rounded-full bg-white/10 grid place-items-center text-xl">🛡️</div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <a href="./student-details.html?id=${encodeURIComponent(studentId)}" class="rounded-xl bg-white text-slate-900 px-4 py-2 text-xs font-bold hover:bg-slate-100 transition uppercase">Full Profile</a>
              <button data-act="remindReports" class="rounded-xl bg-white/10 text-white px-4 py-2 text-xs font-bold hover:bg-white/20 transition uppercase border border-white/10">Remind Reports</button>
              <button data-act="flagRisk" class="rounded-xl bg-rose-500/20 text-rose-400 px-4 py-2 text-xs font-bold hover:bg-rose-500/30 transition uppercase border border-rose-500/30">Flag High Risk</button>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="rounded-2xl border border-slate-200 bg-white p-4">
              <div class="text-sm font-semibold">Stage control</div>
              <div class="mt-1 text-xs text-slate-500">Advance / Return / Force progression (override)</div>
              <div class="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select id="stageSel" class="sm:col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400">${stageOptions}</select>
                <select id="stageMode" class="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400">
                  <option value="advance">Advance</option>
                  <option value="return">Return</option>
                  <option value="force">Force</option>
                </select>
              </div>
              <div class="mt-2">
                <input id="stageReason" placeholder="Reason / note (audit trail)" class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400" />
              </div>
              <div class="mt-3 flex gap-2">
                <button data-act="saveStage" class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition">Apply stage change</button>
                <button data-act="overrideSkip" class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 transition">Skip requirements</button>
              </div>
            </div>

            <div class="rounded-2xl border border-slate-200 bg-white p-4">
              <div class="text-sm font-semibold">Supervisor control</div>
              <div class="mt-1 text-xs text-slate-500">Assign / reassign Sup1, Sup2, Sup3 (override supported)</div>
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
            <div class="text-sm font-semibold">Notes / interventions</div>
            <div class="mt-1 text-xs text-slate-500">Add Director notes and trigger reminders</div>
            <div class="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-2">
              <textarea id="note" rows="3" class="lg:col-span-2 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400" placeholder="Write an intervention note (audit trail)…"></textarea>
              <div class="space-y-2">
                <button data-act="saveNote" class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition">Save note</button>
                <button data-act="forceChain" class="w-full rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 transition">Force approval chain complete</button>
                <button data-act="bypassMissingReport" class="w-full rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 transition">Bypass missing report</button>
              </div>
            </div>
          </div>
        </div>
      `,
      footerHtml: `<div class="text-xs text-slate-500">All actions are Director-level and should be audited by the backend.</div>`,
    });

    const body = modal.host;
    body.addEventListener("click", async (ev) => {
      const a = ev.target?.closest?.("button[data-act]");
      if (!a) return;
      const act = a.dataset.act;

      try {
        if (act === "saveStage") {
          const stage = modal.qs("#stageSel")?.value;
          const mode = modal.qs("#stageMode")?.value;
          const reason = modal.qs("#stageReason")?.value?.trim() || "";
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

        if (act === "overrideSkip") {
          const note = modal.qs("#stageReason")?.value?.trim() || "Skip requirements";
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

        if (act === "saveSup") {
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

        if (act === "flagRisk") {
          const note = modal.qs("#note")?.value?.trim() || "Marked at risk by Director";
          const ok = await confirmModal({
            title: "Mark student at risk",
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

        if (act === "saveNote") {
          const note = modal.qs("#note")?.value?.trim() || "";
          if (!note) {
            toast("Write a note first", { tone: "yellow" });
            return;
          }
          await api.addStudentNote(studentId, { note });
          toast("Note saved", { tone: "green" });
          modal.qs("#note").value = "";
          return;
        }

        if (act === "remindReports") {
          const message = `Reminder: Submit/complete your quarterly report approvals.`;
          await api.sendNotification({ audience: "students", studentId, type: "reminder", message });
          toast("Reminder sent", { tone: "blue" });
          return;
        }

        if (act === "forceChain") {
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

        if (act === "bypassMissingReport") {
          const note = modal.qs("#note")?.value?.trim() || "Bypass missing quarterly report";
          const ok = await confirmModal({
            title: "Bypass missing report",
            message: `Bypass missing quarterly report requirement for ${studentName}?`,
            confirmText: "Bypass",
            tone: "red",
          });
          if (!ok) return;
          await api.overrideStudent(studentId, { type: "bypassMissingReport", note });
          toast("Missing report bypassed", { tone: "yellow" });
          modal.close();
          await load();
        }
      } catch (err) {
        console.error(err);
        toast(err?.message || "Action failed (API not ready)", { tone: "red" });
      }
    });
  });
}

