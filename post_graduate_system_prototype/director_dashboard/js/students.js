import { api } from "./api.js";
import {
  DEPARTMENTS,
  STAGES,
  STATUSES,
  badge,
  escapeHtml,
  getParam,
  mountEmptyState,
  setPageContent,
  setPageMeta,
  statusTone,
  toast,
} from "./main.js";

function normalizeStudents(raw) {
  const root = raw?.data || raw;
  if (Array.isArray(root)) return { students: root };
  if (Array.isArray(root?.students)) return root;
  if (Array.isArray(root?.items)) return { students: root.items, total: root.total };
  return { students: [] };

}

function row(s) {
  const name = s?.fullName || `${s?.firstName || ""} ${s?.lastName || ""}`.trim() || "Student";
  const reg = s?.userNumber || s?.registrationNumber || s?.studentId || s?.id || "—";
  const dept = s?.department || "—";
  const programme = s?.programme || s?.program || "—";
  const stage = s?.stage || s?.currentStage || "—";
  const status = s?.status || "—";

  // Normalize supervisors: extract values from the object and filter out empty strings
  let supervisorsList = [];
  if (s?.supervisors && typeof s.supervisors === "object") {
    supervisorsList = Object.values(s.supervisors).filter(v => v && v.trim() !== "");
  }
  const supText = supervisorsList.length ? supervisorsList.join(", ") : "—";

  const href = `./student-details.html?id=${encodeURIComponent(String(s?._id || s?.studentId || reg))}`;

  return `
    <tr class="hover:bg-slate-50 transition">
      <td class="px-4 py-3">
        <a href="${href}" class="font-semibold text-slate-900 hover:underline">${escapeHtml(name)}</a>
        <div class="text-xs text-slate-500">${escapeHtml(reg)}</div>
      </td>
      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(dept)}</td>
      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(programme)}</td>
      <td class="px-4 py-3">${badge({ label: stage, tone: "blue" })}</td>
      <td class="px-4 py-3 text-sm text-slate-700 truncate max-w-[200px]" title="${escapeHtml(supText)}">${escapeHtml(supText)}</td>
      <td class="px-4 py-3">${badge({ label: status, tone: statusTone(status) })}</td>
    </tr>
  `;
}

function filtersHtml() {
  const opt = (v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`;
  return `
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <div class="text-lg font-semibold tracking-tight">Students</div>
          <div class="mt-1 text-sm text-slate-600">Search, filter, and open full student profiles with stages, approvals, reports, and compliance.</div>
        </div>
        <a href="./pipeline.html" class="inline-flex items-center justify-center rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">Open pipeline</a>
      </div>

      <div class="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div class="md:col-span-2">
          <label class="block text-xs font-semibold text-slate-600">Search</label>
          <input id="q" type="search" placeholder="Name / Reg No / ID…" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-600">Stage</label>
          <select id="stage" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400">
            <option value="">All stages</option>
            ${STAGES.map(opt).join("")}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-600">Department</label>
          <select id="department" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400">
            <option value="">All departments</option>
            ${DEPARTMENTS.map(opt).join("")}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-600">Status</label>
          <select id="status" class="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400">
            <option value="">All statuses</option>
            ${STATUSES.map(opt).join("")}
          </select>
        </div>
        <div class="md:col-span-3 flex flex-wrap gap-2">
          <button id="apply" class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition">Apply</button>
          <button id="reset" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition">Reset</button>
        </div>
      </div>
    </div>
  `;
}

function tableShell() {
  return `
    <div class="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
        <div class="text-sm font-semibold">Results</div>
        <div id="meta" class="text-xs text-slate-500">—</div>
      </div>
      <div class="overflow-auto app-scroll">
        <table class="min-w-[980px] w-full text-left">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr class="text-xs font-semibold text-slate-600">
              <th class="px-4 py-3">Student</th>
              <th class="px-4 py-3">Department</th>
              <th class="px-4 py-3">Programme</th>
              <th class="px-4 py-3">Stage</th>
              <th class="px-4 py-3">Supervisor(s)</th>
              <th class="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody id="tbody" class="divide-y divide-slate-200"></tbody>
        </table>
      </div>
    </div>
  `;
}

function mount() {
  setPageMeta({
    title: "Students",
    subtitle: "Search + filter by stage/department/status • open full profile",
  });
  setPageContent(`<div class="space-y-4">${filtersHtml()}${tableShell()}</div>`);
}

function getFilters() {
  return {
    q: document.getElementById("q")?.value?.trim() || "",
    stage: document.getElementById("stage")?.value || "",
    department: document.getElementById("department")?.value || "",
    status: document.getElementById("status")?.value || "",
  };
}

function setMeta(text) {
  const el = document.getElementById("meta");
  if (el) el.textContent = text;
}

async function load() {
  const tbody = document.getElementById("tbody");
  if (tbody) {
    tbody.innerHTML = Array.from({ length: 8 })
      .map(
        () => `
        <tr>
          <td class="px-4 py-3"><div class="h-4 w-48 rounded skeleton"></div><div class="mt-2 h-3 w-24 rounded skeleton"></div></td>
          <td class="px-4 py-3"><div class="h-4 w-20 rounded skeleton"></div></td>
          <td class="px-4 py-3"><div class="h-4 w-16 rounded skeleton"></div></td>
          <td class="px-4 py-3"><div class="h-5 w-44 rounded skeleton"></div></td>
          <td class="px-4 py-3"><div class="h-4 w-40 rounded skeleton"></div></td>
          <td class="px-4 py-3"><div class="h-5 w-20 rounded skeleton"></div></td>
        </tr>
      `
      )
      .join("");
  }
  setMeta("Loading…");

  try {
    const filters = getFilters();
    const raw = await api.getStudents(filters);
    const { students, total } = normalizeStudents(raw);
    const arr = Array.isArray(students) ? students : [];

    if (!arr.length) {
      setPageContent(
        `<div class="space-y-4">${filtersHtml()}${mountEmptyState({
          title: "No students found",
          message: "Try broadening your search or clearing filters.",
          actionsHtml: `<a href="./pipeline.html" class="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">Open pipeline</a>`,
        })}</div>`
      );
      return;
    }

    mount(); // re-mount to ensure table exists (in case we replaced content)
    const tb = document.getElementById("tbody");
    if (tb) tb.innerHTML = arr.map(row).join("");
    setMeta(`${arr.length}${typeof total === "number" ? ` of ${total}` : ""} students`);

    wire(); // re-wire handlers after re-mount
  } catch (e) {
    console.error(e);
    toast(e?.message || "Failed to load students", { tone: "red" });
    setPageContent(
      `<div class="space-y-4">${filtersHtml()}${mountEmptyState({
        title: "Students data unavailable",
        message:
          "This page is wired to /api/students. Start the backend and implement filtering via query params (q, stage, department, status).",
        actionsHtml: `<a href="./dashboard.html" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition">Back to dashboard</a>`,
      })}</div>`
    );
  }
}

function wire() {
  const apply = document.getElementById("apply");
  const reset = document.getElementById("reset");
  const q = document.getElementById("q");
  apply?.addEventListener("click", () => load());
  reset?.addEventListener("click", () => {
    if (q) q.value = "";
    const stage = document.getElementById("stage");
    const dept = document.getElementById("department");
    const status = document.getElementById("status");
    if (stage) stage.value = "";
    if (dept) dept.value = "";
    if (status) status.value = "";
    load();
  });
  q?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") load();
  });
}

mount();
wire();

// Deep-link support from Dashboard drill-down
(() => {
  const q = getParam("q");
  const stage = getParam("stage");
  const department = getParam("department");
  const status = getParam("status");
  if (q) {
    const el = document.getElementById("q");
    if (el) el.value = q;
  }
  if (stage) {
    const el = document.getElementById("stage");
    if (el) el.value = stage;
  }
  if (department) {
    const el = document.getElementById("department");
    if (el) el.value = department;
  }
  if (status) {
    const el = document.getElementById("status");
    if (el) el.value = status;
  }
})();

load();

