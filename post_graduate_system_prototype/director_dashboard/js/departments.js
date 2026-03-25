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

function deptCard({ name, code, students, delayCount, lead }) {
  const isCJM = code === "CJM";
  const tone = delayCount > 5 ? "red" : "blue";
  return `
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft hover:shadow-lg transition-all animate-in animate-in">
      <div class="flex items-start justify-between">
        <div class="h-12 w-12 rounded-2xl ${isCJM ? "bg-blue-600" : "bg-purple-600"} grid place-items-center text-white font-bold text-xl">${code.slice(0, 1)}</div>
        ${badge({ label: `${delayCount} issues`, tone })}
      </div>
      <div class="mt-4">
        <div class="text-lg font-bold text-slate-900">${escapeHtml(name)}</div>
        <div class="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">${escapeHtml(code)} • Lead: ${escapeHtml(lead)}</div>
      </div>
      <div class="mt-6 grid grid-cols-2 gap-4">
        <div class="rounded-xl bg-slate-50 p-3 border border-slate-100">
          <div class="text-[10px] font-bold text-slate-500 uppercase">Total Students</div>
          <div class="text-xl font-bold text-slate-900">${students}</div>
        </div>
        <div class="rounded-xl bg-slate-50 p-3 border border-slate-100">
          <div class="text-[10px] font-bold text-slate-500 uppercase">Avg. Progress</div>
          <div class="text-xl font-bold text-slate-900">68%</div>
        </div>
      </div>
      <div class="mt-6 flex gap-2">
        <button data-dept-act="intervene" data-code="${code}" class="flex-1 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 transition uppercase tracking-wider shadow-sm">Intervene</button>
        <button data-dept-act="report" data-code="${code}" class="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition uppercase tracking-wider">Audit Log</button>
      </div>
    </div>
  `;
}

function buildShell() {
  setPageMeta({
    title: "Department Governance",
    subtitle: "CJM vs IHRS performance • bottleneck detection • Director oversight",
  });

  setPageContent(`
    <div class="space-y-6">
      <div class="rounded-2xl dark-glass p-8 power-glow flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div class="text-xs font-bold uppercase tracking-widest text-blue-400">Institutional Intelligence</div>
          <div class="mt-2 text-2xl font-bold">School Performance Dashboard</div>
          <div class="mt-2 text-slate-300 max-w-xl text-sm">Real-time comparison of postgraduate lifecycle metrics between Computer Science & Software Engineering (CJM) and Information Science (IHRS).</div>
        </div>
        <button id="globalIntervention" class="rounded-xl bg-white text-slate-900 px-6 py-3 text-sm font-bold uppercase tracking-widest hover:bg-slate-100 transition shadow-xl">Trigger School Intervention</button>
      </div>

      <div id="deptGrid" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Loaded dynamically -->
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div class="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
          <div class="flex items-center justify-between">
            <div class="text-sm font-bold text-slate-900 uppercase tracking-wider">Lifecycle Comparison (Days per Stage)</div>
            <div class="flex items-center gap-4 text-[10px] font-bold uppercase">
              <div class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-blue-600"></span> CJM</div>
              <div class="flex items-center gap-1.5"><span class="h-2 w-2 rounded-full bg-purple-600"></span> IHRS</div>
            </div>
          </div>
          <div class="mt-6 h-64">
             <canvas id="lifecycleChart"></canvas>
          </div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
          <div class="text-sm font-bold text-slate-900 uppercase tracking-wider">Critical Stagnation Alerts</div>
          <div class="mt-6 space-y-4">
             <div class="p-4 rounded-xl border border-rose-100 bg-rose-50/50">
               <div class="text-xs font-bold text-rose-600 uppercase">IHRS: Proposal Stage</div>
               <div class="mt-1 text-sm font-bold text-slate-900">8 students stuck > 30 days</div>
               <div class="mt-3 flex gap-2">
                 <button class="text-[10px] font-bold text-blue-600 uppercase hover:underline">Notify HOD</button>
                 <button class="text-[10px] font-bold text-slate-400 uppercase">Dismiss</button>
               </div>
             </div>
             <div class="p-4 rounded-xl border border-amber-100 bg-amber-50/50">
               <div class="text-xs font-bold text-amber-600 uppercase">CJM: Thesis Review</div>
               <div class="mt-1 text-sm font-bold text-slate-900">Delay in external examiner assignment</div>
               <div class="mt-3 flex gap-2">
                 <button class="text-[10px] font-bold text-blue-600 uppercase hover:underline">Force Assign</button>
                 <button class="text-[10px] font-bold text-slate-400 uppercase">Dismiss</button>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  `);
}

async function load() {
  buildShell();
  const grid = document.getElementById("deptGrid");
  
  try {
    // Simulated data for demo if API fails
    const depts = [
      { name: "Comp. Science & Software Eng.", code: "CJM", students: 42, delayCount: 3, lead: "Dr. J. Okumu" },
      { name: "Information Science", code: "IHRS", students: 38, delayCount: 9, lead: "Prof. S. Maina" },
    ];

    grid.innerHTML = depts.map(deptCard).join("");
    
    // Simple bar chart simulation
    chartBars(document.getElementById("lifecycleChart"), {
      labels: ["CN", "Prop", "PG App", "FW", "Thesis"],
      values: [14, 28, 7, 45, 90],
      color: "#2563eb"
    });

  } catch (err) {
    grid.innerHTML = mountEmptyState({ 
      title: "Governance Data Offline", 
      message: "Unable to reach /api/departments. Interventions disabled." 
    });
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-dept-act]");
    if (!btn) return;
    const act = btn.dataset.deptAct;
    const code = btn.dataset.code;
    
    if (act === "intervene") {
      openModal({
        title: `Director Intervention — ${code}`,
        bodyHtml: `
          <div class="space-y-4">
            <div class="p-4 rounded-2xl bg-slate-900 text-white power-glow">
              <div class="text-xs font-bold uppercase tracking-widest text-blue-400">Emergency Broadcast</div>
              <div class="text-sm mt-1">This will send a priority directive to all supervisors and the HOD of ${code}.</div>
            </div>
            <textarea id="directive" rows="4" class="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-blue-500" placeholder="Type your directive here..."></textarea>
          </div>
        `,
        footerHtml: `<button id="sendDirective" class="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white uppercase tracking-widest">Execute Directive</button>`
      });
    }
  });
}

load();
