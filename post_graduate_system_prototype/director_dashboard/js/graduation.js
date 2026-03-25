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

function buildShell() {
  setPageMeta({
    title: "Graduation Command Panel",
    subtitle: "Final verification • fee clearance • Director sign-off",
  });

  setPageContent(`
    <div class="space-y-6">
      <div class="rounded-2xl dark-glass p-8 power-glow flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div class="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">Final Authority System</div>
          <div class="mt-2 text-3xl font-bold tracking-tight">Graduation & Clearance Oversight</div>
          <div class="mt-2 text-slate-300 max-w-xl text-sm font-medium">Verify final corrections, confirm financial standing, and grant final graduation clearance. Only the Director has absolute authority to mark a student as GRADUATED.</div>
        </div>
        <div class="shrink-0 flex gap-3">
          <button id="massClearance" class="rounded-xl bg-white text-slate-900 px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-slate-100 transition shadow-2xl">Execute Mass Clearance</button>
          <button id="auditGraduation" class="rounded-xl border border-white/20 px-6 py-3 text-xs font-bold text-white uppercase tracking-widest hover:bg-white/10 transition backdrop-blur-md">Full Audit Trail</button>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft hover:shadow-lg transition">
          <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Awaiting Clearance</div>
          <div class="mt-2 text-3xl font-bold text-slate-900">12</div>
          <div class="mt-1 text-[10px] font-bold text-blue-600 uppercase tracking-widest leading-none">CJM: 5 • IHRS: 7</div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft hover:shadow-lg transition">
          <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fee Clearances Pending</div>
          <div class="mt-2 text-3xl font-bold text-amber-600">4</div>
          <div class="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Request to Finance sent</div>
        </div>
        <div class="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 shadow-soft hover:shadow-lg transition">
          <div class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Total Graduated (2025)</div>
          <div class="mt-2 text-3xl font-bold text-emerald-700">86</div>
          <div class="mt-1 text-[10px] font-bold text-emerald-400 uppercase tracking-widest leading-none">+12% vs last year</div>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft hover:shadow-lg transition">
          <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Next Ceremony</div>
          <div class="mt-2 text-3xl font-bold text-slate-900">June 18</div>
          <div class="mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">TBC: 90 Days</div>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div class="text-sm font-bold text-slate-900 uppercase tracking-widest">Graduation Pipeline</div>
          <input class="rounded-xl border border-slate-200 px-4 py-2 text-xs font-medium focus:border-blue-500 w-64" placeholder="Search by Reg No or Name..." />
        </div>
        <div class="overflow-auto app-scroll">
          <table class="w-full text-left">
             <thead class="bg-slate-50 border-b border-slate-200">
               <tr class="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                 <th class="px-6 py-4">Student</th>
                 <th class="px-6 py-4">Program</th>
                 <th class="px-6 py-4">Status</th>
                 <th class="px-6 py-4 text-center">Final Corrections</th>
                 <th class="px-6 py-4 text-center">Finance Clearance</th>
                 <th class="px-6 py-4 text-center">Director Power</th>
               </tr>
             </thead>
             <tbody id="graduationBody" class="divide-y divide-slate-100">
                <!-- Loaded dynamically -->
             </tbody>
          </table>
        </div>
      </div>
    </div>
  `);
}

function graduationRow(s) {
  const corrected = !!s?.corrected;
  const financial = !!s?.financial;
  return `
    <tr class="hover:bg-slate-50/50 transition animate-in animate-in">
      <td class="px-6 py-4">
        <div class="text-sm font-bold text-slate-900">${escapeHtml(s.name)}</div>
        <div class="text-[11px] font-medium text-slate-500">${escapeHtml(s.regNo)}</div>
      </td>
      <td class="px-6 py-4 text-xs font-bold text-slate-600">${escapeHtml(s.program)}</td>
      <td class="px-6 py-4">
        ${badge({ label: s.status, tone: s.status === "Awaiting Clearance" ? "yellow" : "green" })}
      </td>
      <td class="px-6 py-4 text-center">
        ${corrected ? `<span class="h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto">✓</span>` : `<span class="h-6 w-6 rounded-full bg-slate-100 text-slate-400 grid place-items-center mx-auto">⋯</span>`}
      </td>
      <td class="px-6 py-4 text-center">
        ${financial ? `<span class="h-6 w-6 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto">✓</span>` : `<button data-grad-act="finance" data-id="${s.id}" class="rounded-lg bg-blue-100 text-blue-600 px-2 py-1 text-[10px] font-bold uppercase hover:bg-blue-200 transition">Request Finance</button>`}
      </td>
      <td class="px-6 py-4">
        <div class="flex items-center justify-center gap-2">
           <button data-grad-act="approve" data-id="${s.id}" class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white uppercase tracking-wider hover:bg-slate-800 transition shadow-sm">Sign-off & Graduate</button>
           <button data-grad-act="override" data-id="${s.id}" class="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-rose-600 hover:bg-rose-500/20 transition">
             <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
           </button>
        </div>
      </td>
    </tr>
  `;
}

async function load() {
  buildShell();
  const tbody = document.getElementById("graduationBody");

  try {
    const students = [
      { id: "S201", name: "Alice Mwangi", regNo: "PG/IT/01/2021", program: "MSc IT", status: "Awaiting Clearance", corrected: true, financial: true },
      { id: "S202", name: "John Doe", regNo: "PG/CS/12/2020", program: "PhD CS", status: "Awaiting Clearance", corrected: true, financial: false },
      { id: "S203", name: "Jane Smith", regNo: "PG/SE/05/2022", program: "MSc SE", status: "Awaiting Clearance", corrected: false, financial: true },
      { id: "S204", name: "Bob Johnson", regNo: "PG/IT/22/2021", program: "MSc IT", status: "Cleared", corrected: true, financial: true },
    ];

    tbody.innerHTML = students.map(graduationRow).join("");

    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-grad-act]");
      if (!btn) return;
      
      const act = btn.dataset.gradAct;
      const id = btn.dataset.id;
      
      if (act === "approve") {
        const ok = await confirmModal({
          title: "Executive Sign-off Required",
          message: `Are you sure you want to grant final graduation clearance for ${id}? This action is irreversible and will mark the student as GRADUATED in all school systems.`,
          confirmText: "Execute Sign-off",
          tone: "blue"
        });
        if (ok) {
          toast(`Student ${id} has been marked as GRADUATED. Access audit log for certificate token.`, { tone: "green" });
        }
      }
    });

  } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-12 text-center text-sm font-medium text-slate-500">Unable to reach /api/graduation</td></tr>`;
  }
}

load();
