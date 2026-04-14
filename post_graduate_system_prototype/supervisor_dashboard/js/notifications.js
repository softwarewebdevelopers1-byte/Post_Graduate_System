import { qs, qsa, getSupervisorSession, escapeHtml, toast, openModal } from './main.js';
import { api } from './api.js';

export async function initNotifications() {
  const session = getSupervisorSession();
  const root = qs("#page-content");
  if (!root) return;

  try {
    const response = await api.getMyNotifications();
    const notifications = normalizeNotifications(response.notifications || [], session.id);
    renderNotifications(notifications);
  } catch (err) {
    root.innerHTML = `<div class="p-12 text-center text-red-500 font-bold bg-white rounded-3xl animate-in shadow-xl">
        <div class="text-4xl mb-4">🔔</div>
        <div>Error loading notifications: ${err.message}</div>
      </div>`;
  }
}

function normalizeNotifications(notifications) {
  return notifications
    .map((n) => ({
      type: n.type === "quarterly_report_submitted" ? "report" : (n.type || "assignment"),
      title: n.title || "Notification",
      message: n.message || "",
      date: n.createdAt || new Date().toISOString(),
      priority: n.type === "quarterly_report_submitted" ? "medium" : "high",
      studentId: n.studentId || "",
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
