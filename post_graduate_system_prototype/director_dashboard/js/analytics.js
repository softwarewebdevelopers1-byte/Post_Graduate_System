import { api } from "./api.js";
import {
  badge,
  chartBars,
  escapeHtml,
  formatDate,
  mountEmptyState,
  openModal,
  setPageContent,
  setPageMeta,
  toast,
} from "./main.js";

function buildShell() {
  setPageMeta({
    title: "System Performance Analytics",
    subtitle: "Throughput • stage cycle time • faculty workload efficiency",
  });

  setPageContent(`
    <div class="space-y-6">
      <div class="rounded-2xl bg-slate-900 p-8 shadow-2xl border border-slate-800 animate-in">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">Institutional Governance Intelligence</div>
            <div class="mt-2 text-3xl font-bold text-white tracking-tight">Executive Performance Metrics</div>
            <div class="mt-2 text-slate-400 max-w-xl text-sm font-medium">Monitoring the efficiency of the full school postgraduate lifecycle. You can identify delays before they become systemic problems.</div>
          </div>
          <button id="triggerAudit" class="rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-xs font-bold text-white uppercase tracking-widest hover:bg-white/20 transition backdrop-blur-md">Run System-Wide Audit</button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
           <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Avg. Graduation Time</div>
           <div class="mt-2 text-2xl font-bold text-slate-900">3.2 Years</div>
           <div class="mt-1 text-xs font-bold text-emerald-600">↓ 4 months from 2024</div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
           <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Supervisor Throughput</div>
           <div class="mt-2 text-2xl font-bold text-slate-900">4.1 Students/Year</div>
           <div class="mt-1 text-xs font-bold text-slate-400">Target: 4.5</div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
           <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Proposal Pass Rate</div>
           <div class="mt-2 text-2xl font-bold text-slate-900">92%</div>
           <div class="mt-1 text-xs font-bold text-emerald-600">Highest ever record</div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
           <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Director Pending Actions</div>
           <div class="mt-2 text-2xl font-bold text-amber-600">8 Actions</div>
           <div class="mt-1 text-xs font-bold text-slate-400 leading-none">Last 24 Hours</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
           <div class="text-sm font-bold text-slate-900 uppercase tracking-widest">Student Enrollment Growth (MSc vs PhD)</div>
           <div class="mt-6 h-64">
              <canvas id="enrollmentChart"></canvas>
           </div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
           <div class="text-sm font-bold text-slate-900 uppercase tracking-widest">Stage Conversion Funnel</div>
           <div class="mt-6 h-64">
              <canvas id="funnelChart"></canvas>
           </div>
        </div>
      </div>
    </div>
  `);
}

async function load() {
  buildShell();
  
  // Simulated charts
  chartBars(document.getElementById("enrollmentChart"), {
    labels: ["2020", "2021", "2022", "2023", "2024", "2025"],
    values: [45, 62, 58, 84, 92, 110],
    color: "#4f46e5"
  });

  chartBars(document.getElementById("funnelChart"), {
    labels: ["CN", "Prop", "PG App", "FW", "Thesis", "Grad"],
    values: [100, 88, 82, 75, 42, 12],
    color: "#0891b2"
  });

  document.getElementById("triggerAudit")?.addEventListener("click", () => {
    toast("Full system audit triggered. Results will be emailed to Director Okumu.", { tone: "blue" });
  });
}

load();
