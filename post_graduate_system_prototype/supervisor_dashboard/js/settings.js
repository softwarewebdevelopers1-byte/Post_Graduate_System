import { qs, getSupervisorSession, escapeHtml } from './main.js';

export function initSettings() {
  const session = getSupervisorSession();
  const root = qs("#page-content");
  if (!root) return;

  root.innerHTML = `
    <div class="space-y-12 animate-in pb-20">
      <div class="px-1">
        <div class="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Account Control</div>
        <h2 class="text-3xl sm:text-5xl font-black text-rongo-dark -tracking-tighter">My Supervisor Profile</h2>
      </div>

      <div class="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
         <div class="bg-white p-10 rounded-[2rem] shadow-xl border border-slate-50 space-y-8">
            <div class="text-2xl font-black text-rongo-dark border-b border-slate-100 pb-4">Personal Statistics</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
               <div class="p-4 bg-slate-50 rounded-2xl">
                  <div class="text-[10px] font-black uppercase tracking-widest text-[#14b5d9] mb-1">Students Managed</div>
                  <div class="text-3xl font-black text-rongo-dark">${session.assignedCount}</div>
               </div>
               <div class="p-4 bg-slate-50 rounded-2xl">
                  <div class="text-[10px] font-black uppercase tracking-widest text-[#14b5d9] mb-1">Dept Status</div>
                  <div class="text-lg font-black text-rongo-dark">Principal</div>
               </div>
            </div>
         </div>

         <div class="bg-rongo-dark p-10 rounded-[2rem] shadow-xl text-white space-y-6">
            <div class="text-2xl font-black border-b border-white/10 pb-4">Information Control</div>
            <div class="space-y-4">
               <div>
                  <label class="block text-[10px] font-black uppercase text-white/40 mb-2">Display Name</label>
                  <input type="text" value="${session.name}" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold focus:bg-white/10 outline-none">
               </div>
               <div>
                  <label class="block text-[10px] font-black uppercase text-white/40 mb-2">Departmental Assignment</label>
                  <input type="text" value="${session.department}" readonly class="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold opacity-60">
               </div>
               <button class="w-full bg-[#14b5d9] text-[#194973] py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-white transition shadow-xl shadow-black/20">Update Official Records</button>
            </div>
         </div>

         <div class="bg-white p-10 rounded-[2rem] shadow-xl border border-slate-50 md:col-span-2 space-y-6">
            <div class="text-2xl font-black text-rongo-dark">Security & Authority</div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-8">
               <div class="space-y-4">
                  <div class="text-[10px] font-black uppercase tracking-widest text-[#14b5d9]">Communication Preferences</div>
                  <label class="flex items-center gap-3 cursor-pointer group">
                     <div class="h-6 w-6 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200 group-hover:border-[#14b5d9] transition"><span class="text-xs">✔</span></div>
                     <span class="text-sm font-bold text-slate-600">Email Alerts on Submission</span>
                  </label>
                  <label class="flex items-center gap-3 cursor-pointer group">
                     <div class="h-6 w-6 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200 group-hover:border-[#14b5d9] transition"><span class="text-xs">✔</span></div>
                     <span class="text-sm font-bold text-slate-600">Bi-Weekly Supervision Digests</span>
                  </label>
               </div>
               <div class="space-y-4">
                  <div class="text-[10px] font-black uppercase tracking-widest text-[#14b5d9]">Credential Overwrite</div>
                  <button class="px-6 py-3 border-2 border-slate-100 rounded-xl text-xs font-black uppercase tracking-widest text-slate-400 hover:border-[#bf8c2c] hover:text-[#bf8c2c] transition">Reset Authority Password</button>
               </div>
            </div>
         </div>
      </div>
    </div>
  `;
}
