import { qs, qsa, getSupervisorSession, escapeHtml, toast, openModal } from './main.js';
import { api } from './api.js';

export async function initNotifications() {
  const session = getSupervisorSession();
  const root = qs("#page-content");
  if (!root) return;

  try {
    const students = await api.getAssignedStudents(session.id);
    const notifications = generateNotifications(students, session.id);
    renderNotifications(notifications);
  } catch (err) {
    root.innerHTML = `<div class="p-12 text-center text-red-500 font-bold bg-white rounded-3xl animate-in shadow-xl">
        <div class="text-4xl mb-4">🔔</div>
        <div>Error loading notifications: ${err.message}</div>
      </div>`;
  }
}

function generateNotifications(students, supervisorId) {
  const notifications = [];

  students.forEach(s => {
    const slot = s.supervisors.sup1 === supervisorId ? "sup1" : (s.supervisors.sup2 === supervisorId ? "sup2" : "sup3");
    
    // 1. New Assignment
    if (s.assignmentStatus?.[slot] === "pending") {
      notifications.push({
        type: "assignment",
        title: "New Student Assignment",
        message: `${s.fullName} (${s.userNumber}) has been assigned to you. Action required: Accept or Reject in Pipeline.`,
        date: new Date().toISOString(),
        priority: "high",
        studentId: s._id
      });
    }

    // 2. Pending Reports
    const pendingReports = s.quarterlyReports?.filter(r => r.status === "pending") || [];
    pendingReports.forEach(r => {
      notifications.push({
        type: "report",
        title: "Quarterly Report Verification",
        message: `${s.fullName} has submitted the Q${r.quarter} ${r.year} progress report. Verification required for state advancement.`,
        date: r.submittedAt,
        priority: "medium",
        studentId: s._id
      });
    });

    // 3. Document submissions (e.g. Thesis/Proposal)
    if (s.documents?.conceptNote === "pending" && s.stage?.includes("Concept")) {
      notifications.push({
        type: "document",
        title: "Milestone Document for Review",
        message: `${s.fullName} uploaded a Concept Note for institutional validation.`,
        date: new Date().toISOString(),
        priority: "medium",
        studentId: s._id
      });
    }
  });

  return notifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function renderNotifications(notifications) {
  const root = qs("#page-content");
  
  root.innerHTML = `
    <div class="section active animate-in pb-20">
      <div class="max-w-4xl space-y-4">
        ${notifications.length ? notifications.map(n => renderNotificationCard(n)).join('') : `
           <div class="card p-20 text-center border-dashed border-2 border-grey-300 bg-grey-50">
              <div class="text-[60px] mb-6 opacity-30">🔔</div>
              <div class="font-display text-2xl text-navy">All Alerts Cleared</div>
              <p class="text-sm text-muted mt-2 uppercase tracking-widest font-bold">No active supervisor actions in the queue</p>
           </div>
        `}
      </div>
    </div>
  `;

  setupNotificationEvents();
}

function renderNotificationCard(n) {
  const icons = { assignment: "👩‍🎓", report: "📋", document: "📄" };
  const priorityStyle = n.priority === 'high' ? 'border-l-4 border-accent' : 'border-l-4 border-blue';
  
  return `
    <div class="card p-0 overflow-hidden group hover:translate-x-1 transition cursor-pointer ${priorityStyle}" data-student-id="${n.studentId}">
       <div class="p-6 flex items-start gap-6">
          <div class="h-14 w-14 rounded-2xl bg-grey-100 grid place-items-center text-2xl group-hover:scale-110 transition shrink-0">${icons[n.type] || "🔔"}</div>
          <div class="flex-1 min-w-0">
             <div class="flex items-center justify-between mb-2">
                <div class="text-xs font-bold text-navy uppercase tracking-widest leading-none">${n.title}</div>
                <div class="text-[10px] font-bold text-muted uppercase">${new Date(n.date).toLocaleDateString()}</div>
             </div>
             <div class="text-sm text-grey-700 font-medium leading-relaxed">${escapeHtml(n.message)}</div>
             <div class="mt-4 flex items-center gap-4">
                <span class="text-[9px] font-bold uppercase tracking-widest text-blue hover:underline">View Student Record →</span>
                <span class="text-[9px] font-bold uppercase tracking-widest text-muted hover:text-red">Archive Alert</span>
             </div>
          </div>
       </div>
    </div>
  `;
}

function setupNotificationEvents() {
  qsa("[data-student-id]").forEach(el => {
    el.onclick = () => {
       window.location.href = `./student-details.html?id=${el.dataset.studentId}`;
    };
  });
}
