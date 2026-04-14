import { qs, qsa, getSupervisorSession, escapeHtml, toast, openModal, STAGES } from './main.js';
import { api } from './api.js';

export function initPipeline() {
  const session = getSupervisorSession();
  const root = qs("#page-content");
  if (!root) return;

  fetchAndRenderPipeline(session.id);
}

async function fetchAndRenderPipeline(supervisorId) {
  try {
    const students = await api.getAssignedStudents(supervisorId);
    renderPipeline(students, supervisorId);
  } catch (error) {
    qs("#page-content").innerHTML = `<div class="p-12 text-center text-red-500 font-bold bg-white rounded-3xl animate-in shadow-xl">
        <div class="text-4xl mb-4">❌</div>
        <div>Error loading pipeline: ${error.message}</div>
      </div>`;
  }
}

function renderPipeline(students, supervisorId) {
  const root = qs("#page-content");
  
  root.innerHTML = `
    <div class="space-y-12 animate-in pb-20">
      
      <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-6 px-1">
        <div>
          <div class="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">My Supervision</div>
          <h2 class="text-3xl sm:text-5xl font-black text-rongo-dark -tracking-tighter">Assigned Student Pipeline</h2>
        </div>
      </div>

      <div class="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100">
         <div class="px-8 py-8 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
            <div>
               <div class="text-2xl font-black text-rongo-dark">Full Student Registry</div>
               <div class="text-sm text-slate-400 font-bold">Comprehensive tracking across all postgraduate levels</div>
            </div>
            <div class="flex flex-wrap gap-2">
               <select class="px-4 py-2 text-xs font-bold bg-white rounded-xl shadow-sm border border-slate-200 outline-none">
                  <option>All Departments</option>
                  <option>CJM</option>
                  <option>IHRS</option>
                  <option>SST</option>
               </select>
               <select class="px-4 py-2 text-xs font-bold bg-white rounded-xl shadow-sm border border-slate-200 outline-none">
                  <option>All Roles</option>
                  <option>Principal Supervisor</option>
                  <option>Assigned (Pending Accept)</option>
               </select>
               <input type="text" placeholder="Search Reg No or Name" class="px-4 py-2 text-xs font-bold bg-white rounded-xl shadow-sm border border-slate-200 outline-none w-48 focus:w-64 transition-all">
            </div>
         </div>

         <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
               <thead>
                  <tr class="text-[10px] uppercase font-black tracking-widest text-[#194973]/50 bg-slate-50">
                     <th class="px-8 py-4">Student Identity</th>
                     <th class="px-8 py-4">Academic Details</th>
                     <th class="px-8 py-4">Current Milestone</th>
                     <th class="px-8 py-4">Status</th>
                     <th class="px-8 py-4">Progress Monitor</th>
                     <th class="px-8 py-4">Operations</th>
                  </tr>
               </thead>
               <tbody class="divide-y divide-slate-50">
                  ${students.length ? students.map(s => renderPipelineRow(s, supervisorId)).join('') : `
                    <tr><td colspan="6" class="px-8 py-20 text-center text-slate-400 font-bold text-lg uppercase tracking-widest">No assigned students found</td></tr>
                  `}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  `;

  setupPipelineEvents(students, supervisorId);
}

function renderPipelineRow(student, supervisorId) {
  const slot = student.supervisors?.sup1 === supervisorId ? "sup1" : (student.supervisors?.sup2 === supervisorId ? "sup2" : "sup3");
  const isPending = student.assignmentStatus?.[slot] === "pending";
  const statusColor = student.status === "Active" ? "bg-[#14b5d9]" : (student.status === "Deferred" ? "bg-amber-500" : "bg-slate-400");
  const stageIndex = STAGES.indexOf(student.stage || "Coursework");
  const progressPercent = Math.round(((stageIndex + 1) / STAGES.length) * 100);

  return `
    <tr class="hover:bg-slate-50 group transition-all cursor-pointer ${isPending ? 'pulse-assignment border-l-4 border-[#14b5d9]' : ''}" data-student-id="${student._id}">
      <td class="px-8 py-6">
        <div class="flex items-center gap-4">
          <div class="h-10 w-10 rounded-xl bg-rongo-dark text-white grid place-items-center font-bold text-xs shrink-0">${student.fullName.substring(0, 1)}</div>
          <div class="min-w-0">
            <div class="font-black text-rongo-dark truncate shrink">${student.fullName}</div>
            <div class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter truncate">ID: ${student.userNumber}</div>
          </div>
        </div>
      </td>
      <td class="px-8 py-6">
        <div class="text-sm font-black text-slate-700">${student.programme?.toUpperCase() || "MSc"}</div>
        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${student.department} Department</div>
      </td>
      <td class="px-8 py-6">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
           <span class="h-1.5 w-1.5 rounded-full bg-rongo-dark"></span>
           <span class="text-[10px] font-black uppercase text-rongo-dark">${student.stage || "Coursework"}</span>
        </div>
      </td>
      <td class="px-8 py-6">
         <div class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full ${statusColor}"></span>
            <span class="text-xs font-bold text-slate-600">${student.status}</span>
         </div>
      </td>
      <td class="px-8 py-6">
         <div class="w-32">
            <div class="flex items-center justify-between text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest leading-none">
               <span>P.${stageIndex + 1}</span>
               <span>${progressPercent}%</span>
            </div>
            <div class="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
               <div class="h-full bg-rongo-dark transition-all duration-1000" style="width: ${progressPercent}%"></div>
            </div>
         </div>
      </td>
      <td class="px-8 py-6">
         <div class="flex items-center gap-2">
            ${isPending ? `
              <button class="bg-[#14b5d9] hover:bg-[#119dbb] text-white text-[10px] px-3 py-2 rounded-xl font-bold uppercase tracking-widest btn-accept" data-id="${student._id}">Accept</button>
            ` : `
               <button class="bg-[#f2f2f2] text-rongo-dark text-[10px] px-4 py-2 rounded-xl font-bold uppercase tracking-widest border border-slate-200 hover:bg-slate-200 transition btn-manage" data-id="${student._id}">Details</button>
            `}
         </div>
      </td>
    </tr>
  `;
}

function setupPipelineEvents(students, supervisorId) {
  qsa(".btn-accept").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      handleAssignment(btn.dataset.id, supervisorId, "accepted");
    };
  });
  qsa(".btn-manage").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      window.location.href = `./student-details.html?id=${btn.dataset.id}`;
    };
  });
  qsa("tr[data-student-id]").forEach(tr => {
    tr.onclick = () => {
       window.location.href = `./student-details.html?id=${tr.dataset.studentId}`;
    };
  });
}

async function handleAssignment(studentId, supervisorId, action) {
  try {
    await api.updateAssignmentStatus(studentId, supervisorId, action);
    toast(`Successfully ${action} student assignment`, { tone: action === "accepted" ? "green" : "red" });
    fetchAndRenderPipeline(supervisorId);
  } catch (err) {
    toast(`Error: ${err.message}`, { tone: "red" });
  }
}
