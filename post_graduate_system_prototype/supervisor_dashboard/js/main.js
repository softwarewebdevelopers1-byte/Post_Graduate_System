// Updated main.js for Supervisor SPA Design Sync
export const qs = (s) => document.querySelector(s);
export const qsa = (s) => document.querySelectorAll(s);

// Global State
export const STAGES = [
  "Coursework", "Concept Note (Department)", "Concept Note (School)", 
  "Proposal (Department)", "Proposal (School)", "PG Approval", 
  "Fieldwork", "Thesis Development", "External Examination", "Defense", "Graduation"
];

// ---------------------------------------------------------
// Navigation & Shell Logic
// ---------------------------------------------------------
export async function handleLogout() {
  try {
    const confirm = window.confirm("Are you sure you want to logout?");
    if (!confirm) return;
    
    await fetch("http://localhost:5000/api/user/login/logout", { 
      method: "POST", 
      credentials: "include" 
    });
    
    localStorage.removeItem("postgraduate_user");
    localStorage.removeItem("auth_token");
    window.location.href = "../login/login.html";
  } catch (err) {
    localStorage.removeItem("postgraduate_user");
    localStorage.removeItem("auth_token");
    window.location.href = "../login/login.html";
  }
}

export function initShell() {
    const session = getSupervisorSession();
    qs("#sup-name").textContent = session.name;
    qs("#sup-avatar").textContent = session.name.substring(0, 1);
    qs("#top-date").textContent = "📅 " + new Date().toLocaleDateString('en-GB');

    // Initial section logic
    const params = new URLSearchParams(window.location.search);
    const initial = params.get('section') || 'dashboard';
    const studentId = params.get('studentId');
    
    // Auto-refresh badges
    updateSidebarBadges(session.id);

    if (studentId) {
        navigateTo('student-detail', null, studentId);
    } else {
        navigateTo(initial);
    }
}

// Global toggle for mobile nav
window.toggleMobileNav = () => {
    qs(".sidebar").classList.toggle('mobile-active');
};

async function updateSidebarBadges(supervisorId) {
    try {
        const stats = await api.getAnalytics(supervisorId);
        const alerts = stats.pendingAssignments + stats.pendingQReports;
        if (alerts > 0) {
           const btn = [...qsa(".nav-item")].find(i => i.innerText.includes("Alerts"));
           if (btn) btn.innerHTML = `<span class="nav-icon">🔔</span> Alerts Center <span class="nav-badge warn">${alerts}</span>`;
        }
    } catch(e) {}
}

export function getSupervisorSession() {
  const session = localStorage.getItem("postgraduate_user");
  // Simulated session for hackathon demo fallback
  if (!session) {
    const mock = { id: "Dr. Supervisor", name: "Dr. Supervisor" };
    localStorage.setItem("supervisor_session", JSON.stringify(mock));
    return mock;
  }
  const user = JSON.parse(session);
  // The backend uses supervisor.fullName to link students, so we map id to fullName
  return { id: user.fullName || "Dr. Supervisor", name: user.fullName || "Dr. Supervisor" };
}

import { initDashboard } from './dashboard.js';
import { initStudentDetails } from './student-details.js';
import { initNotifications } from './notifications.js';
// SPA Switcher
export function navigateTo(target, btn = null, extraId = null) {
    // Close mobile nav on switch
    qs(".sidebar").classList.remove('mobile-active');

    if (btn) {
       qsa(".nav-item").forEach(b => b.classList.remove('active'));
       btn.classList.add('active');
    }

    qsa("section").forEach(s => s.classList.remove('active'));

    const titles = {
        dashboard: { title: "Oversight Panel", sub: "Academic Year 2025/2026 — R.U PGOS Hub" },
        'student-detail': { title: "Student Detail View", sub: "Deep Oversight & Sign-Off Hub" },
        notifications: { title: "Alerts Center", sub: "Smart alerts from RU PG State Machine" },
        presentations: { title: "Presentations Dashboard", sub: "Upcoming calendar and participation logic" },
        approvals: { title: "Progress Approvals", sub: "Institutional gatekeeper oversight hub" },
        settings: { title: "Profile Management", sub: "Supervisor security and personal records" }
    };

    const targetSectionId = `section-${target}`;
    const targetSection = qs(`#${targetSectionId}`) || qs("#section-generic");
    targetSection.classList.add('active');

    const config = titles[target] || { title: target.toUpperCase(), sub: titles.dashboard.sub };
    qs("#page-title").textContent = config.title;
    qs("#page-sub").textContent = config.sub;

    if (target === "dashboard") initDashboard();
    else if (target === "student-detail") initStudentDetails(extraId);
    else if (target === "notifications") initNotifications();
    else {
        qs("#generic-title").textContent = config.title;
        qs("#generic-icon").textContent = target === "settings" ? "⚙️" : (target === "presentations" ? "📅" : "🛡️");
    }
}

// ---------------------------------------------------------
// UI Shared Utilities
// ---------------------------------------------------------
export function toast(msg, { tone = "blue" } = {}) {
  const container = qs("#toast-container");
  const el = document.createElement("div");
  el.className = `alert alert-${tone === 'green' ? 'success' : (tone === 'red' ? 'error' : 'info')} animate-in shadow-lg`;
  el.style.width = "320px";
  el.innerHTML = `
    <span class="alert-icon">${tone === 'green' ? '✅' : (tone === 'red' ? '⚠️' : 'ℹ️')}</span>
    <div>${msg}</div>
  `;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

export function openModal({ title, bodyHtml, footerHtml }) {
    const modal = qs("#modal-container");
    const content = qs("#modal-content");
    modal.style.display = "flex";
    content.innerHTML = `
       <div class="p-8 border-b border-grey-100 flex-between">
          <h2 class="card-title text-xl">${title}</h2>
          <button class="btn btn-ghost btn-sm" onclick="this.closest('.modal-overlay').style.display='none'">✕</button>
       </div>
       <div class="p-8 max-h-[70vh] overflow-y-auto">${bodyHtml}</div>
       <div class="p-8 flex justify-end gap-3">${footerHtml || `
          <button class="btn btn-outline" onclick="this.closest('.modal-overlay').style.display='none'">Dismiss</button>
       `}</div>
    `;
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; };
}

export const escapeHtml = (str) => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};
