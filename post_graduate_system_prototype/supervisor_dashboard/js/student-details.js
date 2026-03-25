import { qs, qsa, getSupervisorSession, escapeHtml, toast, openModal, STAGES, navigateTo } from './main.js';
import { api } from './api.js';

export async function initStudentDetails(studentId) {
  const session = getSupervisorSession();
  const root = qs("#student-detail-root");
  if (!root || !studentId) return;

  try {
    const students = await api.getAssignedStudents(session.id);
    const detail = students.find(s => s._id === studentId);

    if (!detail) throw new Error("Student not found or not assigned to you");

    renderStudentDetail(detail, session.id);
  } catch (err) {
    root.innerHTML = `<div class="p-12 text-center text-red-500 font-bold bg-white rounded-3xl animate-in shadow-xl">
        <div class="text-4xl mb-4">❌</div>
        <div>Error loading student profile: ${err.message}</div>
      </div>`;
  }
}

function renderStudentDetail(student, supervisorId) {
  const root = qs("#student-detail-root");
  const stageIndex = STAGES.indexOf(student.stage || "Coursework");
  const progressPercent = Math.round(((stageIndex + 1) / STAGES.length) * 100);

  root.innerHTML = `
    <div class="animate-in pb-20">
      <div class="profile-hero mb-8">
        <div class="profile-avatar-lg">${student.fullName.substring(0, 1)}</div>
        <div class="profile-info">
          <div class="profile-name">${student.fullName}</div>
          <div class="profile-meta">
            <span>📌 Reg: ${student.userNumber}</span>
            <span>🏛️ ${student.department?.toUpperCase()}</span>
            <span>📚 ${student.programme?.toUpperCase()}</span>
          </div>
        </div>
        <div class="profile-status-area">
          <span class="badge ${student.status === 'Active' ? 'badge-active' : 'badge-deferred'}">● ${student.status.toUpperCase()}</span>
          <button class="btn btn-primary btn-sm btn-action-center">✍️ Issue Gate Approval</button>
        </div>
      </div>

      <div class="card mb-8">
        <div class="card-header">
          <div><div class="card-title">10-Gate Research Pipeline</div><div class="card-sub">Tracking candidate progression</div></div>
          <span class="badge badge-active">Currently: ${student.stage || "Coursework"}</span>
        </div>
        <div class="phase-label">Phase 1 — Foundation (Stages 1–5)</div>
        <div class="pipeline-track mb-8">${renderPipelineSegment(0, 5, stageIndex)}</div>
        <div class="phase-label">Phase 2 — Completion (Stages 6–11)</div>
        <div class="pipeline-track mb-6">${renderPipelineSegment(5, 11, stageIndex)}</div>
        <div class="flex-between mt-4">
           <div class="flex-row">
              <div class="progress-mini" style="width:200px; height:8px;"><div class="progress-mini-fill" style="width:${progressPercent}%"></div></div>
              <span class="text-sm font-bold text-navy">${progressPercent}% Complete</span>
           </div>
           <div class="text-xs text-muted font-bold uppercase tracking-widest">Gate ${stageIndex + 1} of 11</div>
        </div>
      </div>

      <div class="grid-2">
         <div style="display:flex; flex-direction:column; gap:20px;">
            <div class="card">
               <div class="card-title" style="margin-bottom:12px;">Quarterly Progress Reports</div>
               <div style="display:flex; flex-direction:column; gap:10px;">${renderReports(student.quarterlyReports)}</div>
            </div>
            <div class="card">
               <div class="card-title" style="margin-bottom:12px;">Conditions for Next Gate</div>
               <div style="display:flex; flex-direction:column; gap:8px;">
                  ${renderCondition("Quarterly Reports", student.quarterlyReports?.every(r => r.status === 'approved'))}
                  ${renderCondition("AI Corrections Completion", student.corrections?.every(c => c.completed))}
                  ${renderCondition("Document Clearances", Object.values(student.documents || {}).every(d => d === 'approved'))}
                  ${renderCondition("ERP Finance Status", student.financialClearance)}
               </div>
            </div>
         </div>
         <div style="display:flex; flex-direction:column; gap:20px;">
            <div class="card">
               <div class="card-title">AI Assessment Checklist</div>
               <div class="alert alert-info py-3 mb-4 mt-4" style="font-size:0.75rem;">
                  <span class="alert-icon">🤖</span>
                  <div>Candidate has completed <strong>${student.corrections?.filter(c => c.completed).length || 0} / ${student.corrections?.length || 0}</strong> corrections.</div>
               </div>
               <div style="display:flex; flex-direction:column; gap:8px;">${renderCorrections(student.corrections)}</div>
               <button class="btn btn-outline btn-sm mt-4 w-full btn-run-ai">⚡ Re-run AI Correction Scan</button>
            </div>
            <div class="card" style="background:var(--navy); color:white;">
               <div class="card-title" style="color:var(--accent);">Full Gate Sign-Off</div>
               <p class="text-[10px] mt-2 opacity-80 leading-relaxed">Executing sign-off confirms that all institutional prerequisites for the current milestone have been met by the candidate.</p>
               <button class="btn btn-primary w-full mt-6 btn-action-center">✍️ Execute Gate Sign-Off</button>
            </div>
         </div>
      </div>
    </div>
  `;

  setupDetailEvents(student);
}

function renderPipelineSegment(start, end, current) {
  let html = '';
  for (let i = start; i < end; i++) {
    const isCompleted = i < current;
    const isActive = i === current;
    html += `
      <div class="pipeline-step ${isCompleted ? 'completed' : ''}">
        <div class="step-circle ${isCompleted ? 'completed' : (isActive ? 'active' : 'locked')}">
           ${isCompleted ? '✓' : i + 1}
        </div>
        <div class="step-label ${isActive ? 'active-label' : ''}" style="font-size:0.6rem;">${STAGES[i]}</div>
      </div>
    `;
  }
  return html;
}

function renderCondition(label, met) {
   return `
      <div class="flex-between" style="padding:10px 14px; background:${met ? 'var(--green-light)' : 'var(--grey-100)'}; border-radius:var(--radius-sm);">
         <span class="text-xs font-bold text-navy">${label}</span>
         <span class="badge ${met ? 'badge-active' : 'badge-pending'}" style="font-size:0.65rem;">${met ? 'Satisfied' : 'Pending'}</span>
      </div>
   `;
}

function renderReports(reports = []) {
  if (!reports.length) return `<div class="p-8 text-center text-muted font-bold text-xs uppercase">No reports submitted</div>`;
  return reports.map(r => `
    <div class="flex-between" style="padding:12px 16px; border:1px solid var(--grey-100); border-radius:var(--radius-sm); background:white;">
       <div class="flex-row">
          <div style="font-size:1.2rem;">📋</div>
          <div><div class="text-sm font-bold text-navy">Quarter ${r.quarter} — ${r.year}</div><div class="text-[9px] font-bold text-muted uppercase">${r.status}</div></div>
       </div>
       ${r.status === 'pending' ? `<button class="btn btn-primary btn-sm btn-review-report" data-id="${r.id}">Approve</button>` : `<span class="badge ${r.status === 'approved' ? 'badge-active' : 'badge-pending'}">${r.status}</span>`}
    </div>
  `).join('');
}

function renderCorrections(corrections = []) {
  if (!corrections.length) return `<div class="p-8 text-center text-muted font-bold text-xs uppercase">No corrections found</div>`;
  return corrections.map(c => `
    <div class="flex-row" style="padding:10px; background:var(--grey-100); border-radius:var(--radius-sm); align-items:flex-start;">
       <div style="font-size:0.9rem; margin-top:2px;">${c.completed ? '✅' : '⏳'}</div>
       <div style="font-size:0.8rem; font-weight:500; color:var(--grey-700);">${escapeHtml(c.text)}</div>
    </div>
  `).join('');
}

function setupDetailEvents(student) {
  qsa(".btn-action-center").forEach(btn => { btn.onclick = () => openActionCenter(student); });

  qs(".btn-run-ai")?.addEventListener("click", async () => {
     toast("AI Engine: Scanning Research Draft...", { tone: "blue" });
     try {
        await api.triggerAutoCheck(student._id);
        toast("Scan Complete: Conditions Updated", { tone: "green" });
        initStudentDetails(student._id);
     } catch(e) { toast("Error: " + e.message, { tone: "red" }); }
  });

  qsa(".btn-review-report").forEach(btn => { btn.onclick = () => openReportApprovalModal(student, btn.dataset.id); });
}

function openReportApprovalModal(student, reportId) {
   const session = getSupervisorSession();
   const slot = student.supervisors?.sup1 === session.id ? "sup1" : (student.supervisors?.sup2 === session.id ? "sup2" : "sup3");
   openModal({
      title: "Quarterly Report Sign-Off",
      bodyHtml: `<div style="display:flex; flex-direction:column; gap:16px;"><p class="text-sm">Verify the academic activities for <strong>${student.fullName}</strong>.</p><textarea id="report-comment" class="form-textarea" placeholder="Enter findings..."></textarea></div>`,
      footerHtml: `
         <button class="btn btn-outline" onclick="this.closest('.modal-overlay').style.display='none'">Cancel</button>
         <button class="btn btn-primary btn-submit-approval" data-action="approved">Sign & Approve</button>
      `
   });

   qsa(".btn-submit-approval").forEach(btn => {
      btn.onclick = async () => {
         try {
            await api.approveQReport(student._id, reportId, { supervisorId: session.id, role: slot, action: btn.dataset.action, comment: qs("#report-comment").value });
            toast("Sign-off Transmitted", { tone: "green" });
            initStudentDetails(student._id);
         } catch(e) { toast("Error: " + e.message, { tone: "red" }); }
      };
   });
}

function openActionCenter(student) {
   const currentStage = (student.stage || "Coursework").toLowerCase();
   // Simple mapping for stage gate vs document
   let technicalStage = "conceptNote";
   if (currentStage.includes("proposal")) technicalStage = "proposal";
   if (currentStage.includes("thesis")) technicalStage = "thesis";

   openModal({
      title: "Institutional Gate Approval",
      bodyHtml: `<div style="display:flex; flex-direction:column; gap:20px;">
         <div class="alert alert-warn"><span class="alert-icon">⚠️</span><div><strong>Formal Sign-Off</strong>: This action validates the current stage <strong>(${student.stage})</strong> and enables the system to move the student forward.</div></div>
         <textarea id="stage-comment" class="form-textarea" placeholder="Reviewer remarks..."></textarea>
      </div>`,
      footerHtml: `
         <button class="btn btn-outline" onclick="this.closest('.modal-overlay').style.display='none'">Discard</button>
         <button class="btn btn-primary" id="btn-confirm-signoff">✍️ Execute Sign-Off</button>
      `
   });

   qs("#btn-confirm-signoff").onclick = async () => {
      try {
         toast("Transmitting institutional sign-off...", { tone: "blue" });
         await api.approveStage(student._id, technicalStage, { action: "approved", comment: qs("#stage-comment").value });
         toast("Stage approved & Gates updated", { tone: "green" });
         initStudentDetails(student._id);
      } catch(e) { toast("Error: " + e.message, { tone: "red" }); }
   };
}
