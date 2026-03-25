import { qs, qsa, getSupervisorSession, escapeHtml, toast, openModal, STAGES, navigateTo } from './main.js';
import { api } from './api.js';

export function initDashboard() {
  const session = getSupervisorSession();
  const root = qs("#student-table-container");
  if (!root) return;

  fetchAndRenderDashboard(session.id);
}

async function fetchAndRenderDashboard(supervisorId) {
  const root = qs("#student-table-container");
  try {
    const students = await api.getAssignedStudents(supervisorId);
    renderDashboard(students, supervisorId);
  } catch (error) {
    console.error(error);
    root.innerHTML = `<div class="alert alert-error animate-in mx-12 my-12"><span class="alert-icon">⚠️</span><div>Error: ${error.message}</div></div>`;
  }
}

function renderDashboard(students, supervisorId) {
  const root = qs("#student-table-container");
  
  root.innerHTML = `
    <div class="table-container">
      <table class="data-table">
         <thead>
            <tr>
               <th style="padding-left:32px;">Student Identity</th>
               <th>Level / Dept</th>
               <th>Pipeline Progress</th>
               <th>Current Stage</th>
               <th>Health</th>
               <th style="padding-right:32px; text-align:right;">Gatekeeper Actions</th>
            </tr>
         </thead>
         <tbody id="student-table-body">
            ${students.length ? students.map(s => renderStudentRow(s, supervisorId)).join('') : `
              <tr><td colspan="6" class="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-sm bg-grey-50">No assigned students found</td></tr>
            `}
         </tbody>
      </table>
    </div>
    <div class="p-6 bg-grey-100 text-[10px] font-bold text-grey-500 uppercase tracking-widest flex justify-between">
        <span>Total: ${students.length} Allocated Students</span>
        <span>Gatekeeper Integrity: Verified 🏛️</span>
    </div>
  `;

  setupDashboardEvents(students, supervisorId);
}

function renderStudentRow(student, supervisorId) {
  const slot = student.supervisors?.sup1 === supervisorId ? "sup1" : (student.supervisors?.sup2 === supervisorId ? "sup2" : "sup3");
  const isPending = student.assignmentStatus?.[slot] === "pending";
  const stageIndex = STAGES.indexOf(student.stage || "Coursework");
  const progressPercent = Math.round(((stageIndex + 1) / STAGES.length) * 100);
  const healthBadge = student.status === "Active" ? "badge-active" : "badge-deferred";

  return `
    <tr class="student-row hover:bg-sky/40 transition cursor-pointer" data-id="${student._id}">
      <td style="padding-left:32px;">
        <div class="flex-row">
          <div class="user-avatar" style="width:36px; height:36px; border-radius:10px; background:var(--navy); font-size:0.75rem;">${student.fullName.substring(0, 1)}</div>
          <div>
            <div class="font-bold text-navy" style="font-size:0.92rem;">${student.fullName}</div>
            <div class="text-xs text-muted">ID: ${student.userNumber}</div>
          </div>
        </div>
      </td>
      <td>
        <div class="font-bold text-grey-700">${student.programme?.toUpperCase()}</div>
        <div class="text-[10px] uppercase font-bold text-muted">${student.department}</div>
      </td>
      <td>
         <div class="flex-row">
            <div class="progress-mini"><div class="progress-mini-fill" style="width:${progressPercent}%"></div></div>
            <span class="text-[10px] font-bold text-navy">${progressPercent}%</span>
         </div>
      </td>
      <td class="text-xs font-bold text-navy uppercase">${student.stage || "Coursework"}</td>
      <td><span class="badge ${healthBadge}">● ${student.status}</span></td>
      <td style="padding-right:32px; text-align:right;">
         <div class="flex items-center justify-end gap-2">
            ${isPending ? `
               <button class="btn btn-primary btn-sm btn-accept" data-id="${student._id}">Accept</button>
               <button class="btn btn-outline btn-sm btn-reject" data-id="${student._id}" style="color:var(--red); border-color:var(--red);">Reject</button>
            ` : `<button class="btn btn-ghost btn-sm btn-manage" data-id="${student._id}">Supervise ←</button>`}
         </div>
      </td>
    </tr>
  `;
}

function setupDashboardEvents(students, supervisorId) {
  qsa(".student-row").forEach(row => {
     row.onclick = () => navigateTo('student-detail', null, row.dataset.id);
  });

  qsa(".btn-accept").forEach(btn => btn.onclick = (e) => { e.stopPropagation(); handleAssignment(btn.dataset.id, supervisorId, "accepted"); });
  qsa(".btn-reject").forEach(btn => btn.onclick = (e) => { e.stopPropagation(); handleAssignment(btn.dataset.id, supervisorId, "rejected"); });
  qsa(".btn-manage").forEach(btn => btn.onclick = (e) => { e.stopPropagation(); navigateTo('student-detail', null, btn.dataset.id); });

  const searchInput = qs("#search-input");
  searchInput.oninput = (e) => {
     const q = e.target.value.toLowerCase();
     qsa(".student-row").forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(q) ? "" : "none";
     });
  };
}

async function handleAssignment(studentId, supervisorId, action) {
  try {
    toast(`Processing assignment ${action}...`, { tone: "blue" });
    await api.updateAssignmentStatus(studentId, supervisorId, action);
    toast(`Successfully ${action} student assignment`, { tone: action === "accepted" ? "green" : "red" });
    initDashboard();
  } catch (err) { toast(`Error: ${err.message}`, { tone: "red" }); }
}
