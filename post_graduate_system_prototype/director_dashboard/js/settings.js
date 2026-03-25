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

function buildShell(settings) {
  setPageMeta({
    title: "System Control Settings",
    subtitle: `Last updated: ${formatDate(settings?.updatedAt)} • algorithm thresholds • school-wide rules`,
  });

  const s = settings || {};

  setPageContent(`
    <div class="space-y-6 animate-in">
      <div class="rounded-2xl dark-glass p-8 power-glow flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
        <div>
          <div class="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--ru-gold)]">Governance Configuration</div>
          <div class="mt-2 text-3xl font-bold tracking-tight">Postgraduate Rule Engine</div>
          <div class="mt-2 text-slate-300 max-w-xl text-sm font-medium">Modify the fundamental rules of the school's postgraduate system. Changes applied here affect all students and faculty globally.</div>
        </div>
        <button id="resetRules" class="rounded-xl border border-white/20 px-6 py-3 text-xs font-bold text-white uppercase tracking-widest hover:bg-white/10 transition backdrop-blur-md shadow-lg">Reset to Defaults</button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft hover:shadow-lg transition-all">
           <div class="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
             <span class="h-2 w-2 rounded-full bg-[var(--ru-navy)]"></span>
             Academic Thresholds
           </div>
           <div class="mt-8 space-y-8">
              <div>
                <div class="flex items-center justify-between">
                  <label class="text-xs font-bold text-slate-600 uppercase">Minimum Proposal Score</label>
                  <span id="label_minProposalScore" class="text-xs font-bold text-[var(--ru-navy)]">${s.minProposalScore || 60}%</span>
                </div>
                <input id="minProposalScore" type="range" min="40" max="80" value="${s.minProposalScore || 60}" class="mt-4 w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[var(--ru-navy)]" />
              </div>
              <div>
                <div class="flex items-center justify-between">
                  <label class="text-xs font-bold text-slate-600 uppercase">Supervisor Student Limit (Cap)</label>
                  <span id="label_supervisorStudentLimit" class="text-xs font-bold text-[var(--ru-navy)]">${s.supervisorStudentLimit || 8} Students</span>
                </div>
                <input id="supervisorStudentLimit" type="range" min="3" max="15" value="${s.supervisorStudentLimit || 8}" class="mt-4 w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[var(--ru-navy)]" />
              </div>
              <div>
                <div class="flex items-center justify-between">
                  <label class="text-xs font-bold text-slate-600 uppercase">External Report Weight</label>
                  <span id="label_externalReportWeight" class="text-xs font-bold text-[var(--ru-navy)]">${s.externalReportWeight || 40}%</span>
                </div>
                <input id="externalReportWeight" type="range" min="10" max="50" value="${s.externalReportWeight || 40}" class="mt-4 w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-[var(--ru-navy)]" />
              </div>
           </div>
           <div class="mt-10">
              <button id="saveThresholds" class="w-full rounded-xl bg-[var(--ru-navy)] py-4 text-xs font-bold text-white uppercase tracking-widest hover:bg-[var(--ru-navy-light)] transition shadow-lg">Save Engine Thresholds</button>
           </div>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft hover:shadow-lg transition-all">
           <div class="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
             <span class="h-2 w-2 rounded-full bg-[var(--ru-cyan)]"></span>
             Lifecycle Stage Access
           </div>
           <div class="mt-8 space-y-5">
              ${toggleRow({
                id: "autoCourseworkCompletion",
                label: "Automatic Coursework Completion",
                desc: "Auto-advance students after ERP verify",
                checked: s.autoCourseworkCompletion
              })}
              ${toggleRow({
                id: "supervisorLockdown",
                label: "Supervisor Replacement Lockdown",
                desc: "Prevent supervisor changes after Fieldwork",
                checked: s.supervisorLockdown
              })}
              ${toggleRow({
                id: "externalAutoReminder",
                label: "External Examination Reminder",
                desc: "Weekly notice to examiners after 60 days",
                checked: s.externalAutoReminder
              })}
           </div>
           <div class="mt-14 p-4 rounded-xl bg-slate-50 border border-slate-200">
             <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">System Note</div>
             <div class="text-[11px] text-slate-600 leading-relaxed font-medium">Manual overrides for specific students can still be executed from the Intervention Center or Student Pipeline view regardless of these global defaults.</div>
           </div>
        </div>
      </div>
    </div>
  `);

  // Simple live label updates
  ["minProposalScore", "supervisorStudentLimit", "externalReportWeight"].forEach(key => {
    const el = document.getElementById(key);
    el?.addEventListener("input", (e) => {
      const lbl = document.getElementById("label_" + key);
      const suffix = key.includes("Limit") ? " Students" : "%";
      if (lbl) lbl.textContent = e.target.value + suffix;
    });
  });

  // Toggle events
  document.querySelectorAll("[data-toggle]").forEach(el => {
    el.addEventListener("click", () => {
      const active = el.dataset.active === "1";
      el.dataset.active = active ? "0" : "1";
      const ball = el.querySelector(".h-4");
      if (active) {
        el.classList.replace("bg-emerald-500", "bg-slate-300");
        ball?.classList.replace("right-1", "left-1");
      } else {
        el.classList.replace("bg-slate-300", "bg-emerald-500");
        ball?.classList.replace("left-1", "right-1");
      }
    });
  });
}

function toggleRow({ id, label, desc, checked }) {
  const activeCls = checked ? "bg-emerald-500" : "bg-slate-300";
  const ballPos = checked ? "right-1" : "left-1";
  return `
    <div class="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all">
      <div class="min-w-0 pr-4">
        <div class="text-xs font-bold text-slate-900 uppercase truncate">${escapeHtml(label)}</div>
        <div class="text-[10px] text-slate-500 font-medium">${escapeHtml(desc)}</div>
      </div>
      <div id="${id}" data-toggle="1" data-active="${checked ? '1' : '0'}" class="h-6 w-11 ${activeCls} rounded-full relative p-1 cursor-pointer transition-colors duration-200 shrink-0">
        <div class="h-4 w-4 bg-white rounded-full absolute ${ballPos} transition-all duration-200 shadow-sm"></div>
      </div>
    </div>
  `;
}

async function load() {
  setPageContent(mountEmptyState({ title: "Loading engine rules...", message: "Synchronizing with governance server." }));
  
  try {
    const settings = await api.getSettings();
    buildShell(settings);
    
    document.getElementById("saveThresholds")?.addEventListener("click", async () => {
      const ok = await confirmModal({
         title: "Execute Overwrite",
         message: "Modifying the rule engine affects current and future postgraduate students. This action is audited.",
         confirmText: "Execute Overwrite",
         tone: "slate"
      });
      if (!ok) return;

      try {
        const payload = {
          minProposalScore: parseInt(document.getElementById("minProposalScore")?.value),
          supervisorStudentLimit: parseInt(document.getElementById("supervisorStudentLimit")?.value),
          externalReportWeight: parseInt(document.getElementById("externalReportWeight")?.value),
          autoCourseworkCompletion: document.getElementById("autoCourseworkCompletion")?.dataset.active === "1",
          supervisorLockdown: document.getElementById("supervisorLockdown")?.dataset.active === "1",
          externalAutoReminder: document.getElementById("externalAutoReminder")?.dataset.active === "1"
        };
        
        await api.updateSettings(payload);
        toast("Global guidelines updated successfully.", { tone: "green" });
        load(); // re-sync
      } catch (err) {
        toast("Failed to update: " + err.message, { tone: "red" });
      }
    });

    document.getElementById("resetRules")?.addEventListener("click", async () => {
      const ok = await confirmModal({
        title: "Factory Reset",
        message: "Restore all thresholds and flags to Rongo University defaults?",
        confirmText: "Reset Defaults",
        tone: "red"
      });
      if (!ok) return;
      
      try {
        await api.resetSettings();
        toast("Settings restored to factory defaults.", { tone: "yellow" });
        load();
      } catch (err) {
        toast("Reset failed.", { tone: "red" });
      }
    });
  } catch (err) {
    console.error(err);
    setPageContent(mountEmptyState({ 
      title: "Governance Server Offline", 
      message: "The rule engine requires a backend connection. Ensure POST /api/settings/update is ready.",
      actionsHtml: `<button onclick="window.location.reload()" class="btn btn-sm">Retry Connection</button>`
    }));
  }
}

load();
