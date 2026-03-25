import { api } from "./api.js";
import {
  badge,
  chartBars,
  escapeHtml,
  mountEmptyState,
  openModal,
  setPageContent,
  setPageMeta,
  toast,
} from "./main.js";
document.addEventListener("DOMContentLoaded", async () => {
  
  function statCard({ label, value, hint, tone = "slate" }) {
    const tones = {
      slate: "border-slate-200",
      blue: "border-blue-200",
      green: "border-emerald-200",
      yellow: "border-amber-200",
      red: "border-rose-200",
      purple: "border-violet-200",
    };
    return `
    <div class="rounded-2xl border ${tones[tone] || tones.slate} bg-white p-5 shadow-soft hover:shadow-lg transition-all animate-in" style="animation-delay: ${Math.random() * 0.2}s">
      <div class="flex items-center justify-between gap-2">
        <div class="text-xs font-bold uppercase tracking-wider text-slate-500">${escapeHtml(label)}</div>
        <div class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
      </div>
      <div class="mt-3 flex items-end justify-between gap-3">
        <div class="text-3xl font-bold tracking-tight text-slate-900">${escapeHtml(value ?? "—")}</div>
        <div class="flex flex-col items-end">
          <div class="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 10l7-7 7 7M5 14l7 7 7-7"/></svg>
            12%
          </div>
          <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">${escapeHtml(hint || "Stable")}</div>
        </div>
      </div>
    </div>
  `;
  }

  function drillLink({ q, stage, department, status } = {}) {
    const url = new URL("./students.html", window.location.href);
    if (q) url.searchParams.set("q", q);
    if (stage) url.searchParams.set("stage", stage);
    if (department) url.searchParams.set("department", department);
    if (status) url.searchParams.set("status", status);
    return url.pathname + url.search;
  }

  function broadcastModal({ suggestedMessage } = {}) {
    const modal = openModal({
      title: "Broadcast notifications (Director)",
      size: "md",
      bodyHtml: `
      <div class="space-y-4">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div class="text-sm font-semibold">Send alerts / reminders</div>
          <div class="mt-1 text-xs text-slate-600">Audience targets: students, supervisors, departments, finance, external examiners.</div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-600">Audience</label>
            <select id="aud" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400">
              <option value="all">All</option>
              <option value="students">Students</option>
              <option value="supervisors">Supervisors</option>
              <option value="departments">Departments</option>
              <option value="finance">Finance</option>
              <option value="examiners">External examiners</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-600">Type</label>
            <select id="type" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400">
              <option value="notice">Notice</option>
              <option value="reminder">Reminder</option>
              <option value="alert">Alert</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-600">Message</label>
          <textarea id="msg" rows="4" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400" placeholder="Write message…">${escapeHtml(
        suggestedMessage || ""
      )}</textarea>
          <div class="mt-1 text-xs text-slate-500">Endpoint: <span class="font-mono">POST /api/notifications/send</span></div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button data-send="1" class="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">Send</button>
          <button data-prefill="missingReports" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition">Prefill: missing reports</button>
          <button data-prefill="upcomingDefense" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition">Prefill: defense prep</button>
        </div>
      </div>
    `,
      footerHtml: `<div class="text-xs text-slate-500">Broadcasts are Director-only and should be audited.</div>`,
    });

    modal.host.addEventListener("click", async (e) => {
      const send = e.target?.closest?.("button[data-send='1']");
      if (send) {
        try {
          const audience = modal.qs("#aud")?.value;
          const type = modal.qs("#type")?.value;
          const message = modal.qs("#msg")?.value?.trim() || "";
          if (!message) return toast("Write a message first", { tone: "yellow" });
          await api.sendNotification({ audience, type, message });
          toast("Broadcast sent", { tone: "green" });
          modal.close();
        } catch (err) {
          console.error(err);
          toast(err?.message || "Broadcast failed (API not ready)", { tone: "red" });
        }
        return;
      }
      const pf = e.target?.closest?.("button[data-prefill]");
      if (!pf) return;
      const key = pf.dataset.prefill;
      const msg = modal.qs("#msg");
      if (!msg) return;
      if (key === "missingReports") msg.value = "Reminder: Students with missing quarterly reports must submit immediately to avoid stage delays.";
      if (key === "upcomingDefense") msg.value = "Reminder: Confirm defense preparation, documents, and scheduling timelines.";
    });
  }

  function alertRow(a) {
    const tone = (a && (a.severity || a.tone)) || "slate";
    return `
    <div class="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          ${badge({ label: a?.severity || "Alert", tone: tone === "critical" ? "red" : tone === "warning" ? "yellow" : "slate" })}
          <div class="text-sm font-semibold truncate">${escapeHtml(a?.title || "Issue")}</div>
        </div>
        <div class="mt-1 text-xs text-slate-600">${escapeHtml(a?.message || "Details pending from API.")}</div>
      </div>
      ${a?.href ? `<a href="${a.href}" class="text-sm font-semibold text-blue-700 hover:underline">Open</a>` : ""}
    </div>
  `;
  }

  function normalizeStats(raw) {
    // Accept multiple possible backend shapes; keep frontend stable.
    const s = raw?.data || raw?.stats || raw || {};
    const totals = s.totals || s.overview || s;
    const counts = {
      totalStudents: totals.totalStudents ?? totals.total ?? totals.studentsTotal,
      active: totals.active ?? totals.activeStudents,
      deferred: totals.deferred ?? totals.deferredStudents,
      graduated: totals.graduated ?? totals.graduatedStudents,
      researchPhase: totals.researchPhase ?? totals.studentsInResearchPhase,
      pendingQuarterlyReports: totals.pendingQuarterlyReports ?? totals.pendingReports,
      readyForDefense: totals.readyForDefense ?? totals.studentsReadyForDefense,
    };

    const charts = s.charts || {};
    const perStage = charts.studentsPerStage || s.studentsPerStage || [];
    const deptCompare = charts.departmentComparison || s.departmentComparison || [];

    const alerts = s.alerts || s.criticalAlerts || [];

    return { counts, perStage, deptCompare, alerts };
  }

  function buildDashboardSkeleton() {
    setPageMeta({
      title: "Director Dashboard",
      subtitle: "Full visibility • approvals • compliance • intervention",
    });

    setPageContent(`
    <div class="space-y-6">
      <section>
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div class="text-lg font-semibold tracking-tight">Overview</div>
            <div class="mt-1 text-sm text-slate-600">Real-time snapshot of postgraduate lifecycle across INFOCOMS.</div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button id="broadcastBtn" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition">Broadcast</button>
            <a href="./students.html" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition">View students</a>
            <a href="./pipeline.html" class="rounded-xl bg-[var(--ru-navy)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--ru-navy-light)] transition">Open pipeline</a>
          </div>
        </div>

        <div id="statsGrid" class="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          ${Array.from({ length: 6 })
        .map(
          () => `
              <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
                <div class="h-3 w-28 rounded skeleton"></div>
                <div class="mt-3 h-7 w-20 rounded skeleton"></div>
              </div>
            `
        )
        .join("")}
        </div>
      </section>

      <section class="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div class="xl:col-span-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-sm font-semibold">Students per stage</div>
              <div class="mt-1 text-xs text-slate-500">Pipeline distribution across the lifecycle</div>
            </div>
            <a href="./pipeline.html" class="text-sm font-semibold text-blue-700 hover:underline">Open Kanban</a>
          </div>
          <div class="mt-4">
            <canvas id="chartStage" class="w-full h-64"></canvas>
          </div>
        </div>

        <div class="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
          <div class="text-sm font-semibold">Department comparison</div>
          <div class="mt-1 text-xs text-slate-500">CJM vs IHRS workload and progress</div>
          <div class="mt-4">
            <canvas id="chartDept" class="w-full h-64"></canvas>
          </div>
        </div>
      </section>

      <section>
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-xl font-bold tracking-tight text-slate-900">System Bottleneck Detector</div>
            <div class="mt-1 text-sm text-slate-500 font-medium">Real-time identification of process delays and compliance gaps.</div>
          </div>
          <button class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 transition uppercase tracking-wider shadow-sm">Trigger intervention</button>
        </div>
        <div class="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div class="rounded-2xl border border-rose-200 bg-white p-5 shadow-soft risk-glow">
            <div class="flex items-center gap-2 text-rose-600">
              <span class="h-2 w-2 rounded-full bg-rose-600 pulse-red"></span>
              <span class="text-xs font-bold uppercase tracking-wider">High Risk Delay</span>
            </div>
            <div class="mt-3 text-sm font-bold text-slate-900 truncate">IHRS Proposal Stage Stagnation</div>
            <div class="mt-1 text-xs text-slate-500">14 students have been in this stage for over 21 days with no status updates.</div>
            <div class="mt-4 flex items-center justify-between">
              <div class="text-[10px] font-bold text-slate-400">IMPACT: HIGH</div>
              <button class="text-xs font-bold text-slate-900 hover:underline">Fix now →</button>
            </div>
          </div>
          <div class="rounded-2xl border border-amber-200 bg-white p-5 shadow-soft">
            <div class="flex items-center gap-2 text-amber-600">
              <span class="h-2 w-2 rounded-full bg-amber-600"></span>
              <span class="text-xs font-bold uppercase tracking-wider">Supervisor Overload</span>
            </div>
            <div class="mt-3 text-sm font-bold text-slate-900 truncate">Workload Imbalance: CJM</div>
            <div class="mt-1 text-xs text-slate-500">3 supervisors have exceeded the 8-student cap. Approvals are slowing down.</div>
            <div class="mt-4 flex items-center justify-between">
              <div class="text-[10px] font-bold text-slate-400">IMPACT: MEDIUM</div>
              <button class="text-xs font-bold text-slate-900 hover:underline">Rebalance →</button>
            </div>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <div class="flex items-center gap-2 text-slate-600">
              <span class="h-2 w-2 rounded-full bg-slate-600"></span>
              <span class="text-xs font-bold uppercase tracking-wider">Document Gap</span>
            </div>
            <div class="mt-3 text-sm font-bold text-slate-900 truncate">Missing NACOSTI Permits</div>
            <div class="mt-1 text-xs text-slate-500">8 students in Fieldwork phase have not uploaded their NACOSTI clearance.</div>
            <div class="mt-4 flex items-center justify-between">
              <div class="text-[10px] font-bold text-slate-400">IMPACT: LEGAL</div>
              <button class="text-xs font-bold text-slate-900 hover:underline">Notify All →</button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div class="flex items-end justify-between gap-3">
          <div>
            <div class="text-xl font-bold tracking-tight text-slate-900">Critical Alerts & Intelligence</div>
            <div class="mt-1 text-sm text-slate-500 font-medium font-medium">Missing reports, fees clearance, and automated compliance status.</div>
          </div>
          <a href="./reports.html" class="text-xs font-bold text-blue-700 hover:underline uppercase tracking-wider">Access full audit log</a>
        </div>
        <div id="alertsList" class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
          ${Array.from({ length: 4 })
        .map(
          () => `
              <div class="rounded-xl border border-slate-200 bg-white p-4">
                <div class="h-4 w-24 rounded skeleton"></div>
                <div class="mt-2 h-3 w-64 max-w-full rounded skeleton"></div>
              </div>
            `
        )
        .join("")}
        </div>
      </section>
    </div>
  `);
  }

  function safeArray(v) {
    return Array.isArray(v) ? v : [];
  }

  async function load() {
    buildDashboardSkeleton();

    try {
      const raw = await api.getDashboardStats();
      const { counts, perStage, deptCompare, alerts } = normalizeStats(raw);

      const statsGrid = document.getElementById("statsGrid");
      if (statsGrid) {
        statsGrid.innerHTML = [
          `<a href="./students.html" class="block">${statCard({ label: "Total Students (MSc + PhD)", value: counts.totalStudents, tone: "blue", hint: "Drill down" })}</a>`,
          `<a href="${drillLink({ status: "Active" })}" class="block">${statCard({
            label: "Active / Deferred / Graduated",
            value: `${counts.active ?? "—"} / ${counts.deferred ?? "—"} / ${counts.graduated ?? "—"}`,
            hint: "Click to filter",
          })}</a>`,
          `<a href="${drillLink({ stage: "Thesis Development" })}" class="block">${statCard({
            label: "Students in Research Phase",
            value: counts.researchPhase,
            tone: "green",
            hint: "Open students",
          })}</a>`,
          `<a href="./reports.html" class="block">${statCard({
            label: "Pending Quarterly Reports",
            value: counts.pendingQuarterlyReports,
            tone: "yellow",
            hint: "Open reports",
          })}</a>`,
          `<a href="${drillLink({ stage: "Defense" })}" class="block">${statCard({
            label: "Ready for Defense",
            value: counts.readyForDefense,
            tone: "purple",
            hint: "Open students",
          })}</a>`,
          statCard({
            label: "Critical Alerts",
            value: safeArray(alerts).length,
            hint: safeArray(alerts).length ? "Review now" : "All clear",
            tone: safeArray(alerts).length ? "red" : "green",
          }),
        ].join("");
      }

      const stageLabels = safeArray(perStage).map((x) => x.stage ?? x.name ?? "Stage");
      const stageValues = safeArray(perStage).map((x) => x.count ?? x.value ?? 0);
      chartBars(document.getElementById("chartStage"), { labels: stageLabels, values: stageValues, color: "#122f4a" });

      const deptLabels = safeArray(deptCompare).map((x) => x.department ?? x.name ?? "Dept");
      const deptValues = safeArray(deptCompare).map((x) => x.count ?? x.value ?? 0);
      chartBars(document.getElementById("chartDept"), { labels: deptLabels, values: deptValues, color: "#BF8C2C" });

      const alertsList = document.getElementById("alertsList");
      if (alertsList) {
        const arr = safeArray(alerts);
        alertsList.innerHTML = arr.length
          ? arr
            .map((a) =>
              alertRow({
                ...a,
                href:
                  a?.href ||
                  (String(a?.title || "").toLowerCase().includes("report") ? "./reports.html" : "./pipeline.html"),
              })
            )
            .join("")
          : mountEmptyState({
            title: "No critical alerts",
            message: "No missing reports, NACOSTI, or fees issues were returned by the API.",
            actionsHtml: `<a href="./pipeline.html" class="rounded-xl bg-[var(--ru-navy)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--ru-navy-light)] transition">Review pipeline</a>`,
          });
      }

      document.getElementById("broadcastBtn")?.addEventListener("click", () =>
        broadcastModal({ suggestedMessage: "Reminder: outstanding approvals and compliance items must be addressed this week." })
      );
    } catch (e) {
      console.error(e);
      toast(e?.message || "Failed to load dashboard stats", { tone: "red" });
      setPageContent(
        mountEmptyState({
          title: "Dashboard data unavailable",
          message:
            "The dashboard is wired to the API but the backend response was not available. Start the backend at http://localhost:5000 and ensure /api/dashboard/stats is implemented.",
          actionsHtml: `
          <a href="./pipeline.html" class="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">Open pipeline</a>
          <a href="./students.html" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition">Open students</a>
        `,
        })
      );
    }
  }

  load();


})