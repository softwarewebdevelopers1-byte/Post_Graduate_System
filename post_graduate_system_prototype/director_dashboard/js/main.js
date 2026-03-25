export const STAGES = [
  "Coursework",
  "Concept Note (Department)",
  "Concept Note (School)",
  "Proposal (Department)",
  "Proposal (School)",
  "PG School Approval",
  "Fieldwork / NACOSTI",
  "Thesis Draft (Department)",
  "Thesis Draft (School)",
  "External Examination Submission",
  "Under External Examination",
  "Final Defence",
  "Graduation Clearance",
];
document.addEventListener("DOMContentLoaded", async () => {
  let response = await fetch("http://localhost:5000/api/islogged", {
    method: "POST",
    credentials: "include"
  })
  if (response.status === 401) {
    window.location.href = "../../login/login.html"
  }
})

export async function handleLogout() {
  try {
    const confirm = window.confirm("Are you sure you want to logout?");
    if (!confirm) return;
    
    await fetch("http://localhost:5000/api/user/login/logout", { 
      method: "POST", 
      credentials: "include" 
    });
    localStorage.removeItem("postgraduate_user");
    window.location.href = "../../login/login.html";
  } catch (err) {
    localStorage.removeItem("postgraduate_user");
    window.location.href = "../../login/login.html";
  }
}
export const DEPARTMENTS = ["CJM", "IHRS"];
export const PROGRAMMES = ["MSc", "PhD"];
export const STATUSES = ["Active", "Deferred", "Resumed", "Graduated"];

export function qs(sel, root = document) {
  return root.querySelector(sel);
}
export function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

export function setLoading(el, isLoading) {
  if (!el) return;
  el.dataset.loading = isLoading ? "1" : "0";
}

export function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function badge({ label, tone = "slate" }) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    yellow: "bg-amber-50 text-amber-700 ring-amber-200",
    red: "bg-rose-50 text-rose-700 ring-rose-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    purple: "bg-violet-50 text-violet-700 ring-violet-200",
  };
  const cls = tones[tone] || tones.slate;
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}">${escapeHtml(
    label
  )}</span>`;
}

export function toast(message, { tone = "slate", timeoutMs = 3200 } = {}) {
  const hostId = "app-toast-host";
  let host = document.getElementById(hostId);
  if (!host) {
    host = document.createElement("div");
    host.id = hostId;
    host.className =
      "fixed z-[100] bottom-4 right-4 left-4 sm:left-auto sm:w-[420px] space-y-2";
    document.body.appendChild(host);
  }
  const tones = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    yellow: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-rose-200 bg-rose-50 text-rose-900",
    slate: "border-slate-200 bg-white text-slate-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
  };
  const el = document.createElement("div");
  el.className = `rounded-xl border px-4 py-3 shadow-soft transition ${tones[tone] || tones.slate}`;
  el.innerHTML = `<div class="text-sm font-semibold">${escapeHtml(message)}</div>`;
  host.appendChild(el);
  window.setTimeout(() => {
    el.classList.add("opacity-0", "translate-y-1");
    window.setTimeout(() => el.remove(), 250);
  }, timeoutMs);
}

export function openModal({ title, bodyHtml, footerHtml, size = "md" } = {}) {
  const id = "app-modal-host";
  let host = document.getElementById(id);
  if (!host) {
    host = document.createElement("div");
    host.id = id;
    document.body.appendChild(host);
  }

  const sizes = {
    sm: "max-w-lg",
    md: "max-w-2xl",
    lg: "max-w-4xl",
  };

  host.innerHTML = `
    <div class="fixed inset-0 z-[120]">
      <div class="absolute inset-0 bg-slate-900/40" data-modal-close="1"></div>
      <div class="absolute inset-0 flex items-end sm:items-center justify-center p-3 sm:p-6">
        <div class="w-full ${sizes[size] || sizes.md} rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-base font-semibold text-slate-900 truncate">${escapeHtml(title || "Action")}</div>
            </div>
            <button class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition" data-modal-close="1">Close</button>
          </div>
          <div class="p-5 max-h-[70vh] overflow-auto app-scroll">
            ${bodyHtml || ""}
          </div>
          ${footerHtml
      ? `<div class="px-5 py-4 border-t border-slate-200 bg-slate-50">${footerHtml}</div>`
      : ""
    }
        </div>
      </div>
    </div>
  `;

  const close = () => {
    host.innerHTML = "";
  };
  host.querySelectorAll("[data-modal-close='1']").forEach((el) => el.addEventListener("click", close));
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") close();
    },
    { once: true }
  );

  return {
    host,
    close,
    qs: (sel) => host.querySelector(sel),
  };
}

export function confirmModal({ title, message, confirmText = "Confirm", tone = "blue" } = {}) {
  return new Promise((resolve) => {
    const tones = {
      blue: "bg-blue-600 hover:bg-blue-700",
      red: "bg-rose-600 hover:bg-rose-700",
      yellow: "bg-amber-600 hover:bg-amber-700",
      slate: "bg-slate-900 hover:bg-slate-800",
    };
    const m = openModal({
      title,
      bodyHtml: `<div class="text-sm text-slate-700">${escapeHtml(message || "Are you sure?")}</div>`,
      footerHtml: `
        <div class="flex flex-col sm:flex-row sm:justify-end gap-2">
          <button data-cancel="1" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
          <button data-ok="1" class="rounded-xl px-3 py-2 text-sm font-semibold text-white transition ${tones[tone] || tones.blue}">${escapeHtml(confirmText)}</button>
        </div>
      `,
      size: "sm",
    });

    m.qs("[data-cancel='1']")?.addEventListener("click", () => {
      m.close();
      resolve(false);
    });
    m.qs("[data-ok='1']")?.addEventListener("click", () => {
      m.close();
      resolve(true);
    });
  });
}

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "green";
  if (s === "deferred") return "yellow";
  if (s === "resumed") return "blue";
  if (s === "graduated") return "purple";
  return "slate";
}

export function issueTone(issue) {
  const v = String(issue || "").toLowerCase();
  if (v.includes("missing") || v.includes("overdue")) return "red";
  if (v.includes("fees") || v.includes("nacosti")) return "yellow";
  return "slate";
}

export function getActiveNavKey() {
  return document.body.dataset.nav || "";
}

export async function initShell() {
  const navKey = getActiveNavKey();
  const app = qs("#app");
  if (!app) return;

  const nav = [
    { key: "dashboard", label: "Dashboard", href: "./dashboard.html" },
    // { key: "pipeline", label: "Pipeline", href: "./pipeline.html" },
    { key: "students", label: "Students", href: "./students.html" },
    { key: "supervisors", label: "Supervisors", href: "./supervisors.html" },
    // { key: "departments", label: "Departments", href: "./departments.html" },
    { key: "reports", label: "Quarterly Reports", href: "./reports.html" },
    { key: "thesis", label: "Thesis & Defense", href: "./thesis.html" },
    { key: "graduation", label: "Graduation", href: "./graduation.html" },
    { key: "analytics", label: "Analytics", href: "./analytics.html" },
    { key: "settings", label: "Settings", href: "./settings.html" },
  ];

  app.innerHTML = `
    <div class="min-h-screen flex bg-[var(--ru-bg)]">
      <aside id="sidebar" class="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-[var(--ru-navy)] text-white shadow-2xl">
        <div class="p-6 bg-white flex flex-col items-center gap-2 border-b border-slate-200 mb-4">
          <img src="/assets/ru.png" alt="R.U logo" class="h-16 w-auto">
          <div class="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Director Portal</div>
        </div>
        
        <nav class="px-3 pb-5 space-y-1 overflow-auto app-scroll mt-2">
          ${nav
      .map((n) => {
        const active = n.key === navKey;
        return `
                <a href="${n.href}" class="${active
            ? "bg-white/10 text-white border-l-4 border-[var(--ru-cyan)] font-semibold"
            : "text-slate-400 hover:bg-white/5 hover:text-white border-l-4 border-transparent"
          } flex items-center gap-4 px-4 py-3.5 text-sm transition-all rounded-r-lg">
                  <span class="h-1.5 w-1.5 rounded-full ${active ? "bg-[var(--ru-cyan)]" : "bg-white/20"}"></span>
                  <span>${escapeHtml(n.label)}</span>
                </a>
              `;
      })
      .join("")}
          
          <div class="pt-4 mt-4 border-t border-white/5">
            <button id="logoutBtn" class="w-full flex items-center gap-4 px-4 py-3.5 text-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all border-l-4 border-transparent rounded-r-lg group">
              <span class="h-1.5 w-1.5 rounded-full bg-rose-500/40 group-hover:bg-rose-500"></span>
              <span class="font-semibold">Logout</span>
              <svg class="ml-auto h-4 w-4 opacity-50 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            </button>
          </div>
        </nav>

        <div class="mt-auto p-4 border-t border-white/5 bg-black/10">
           <div class="flex items-center gap-3">
              <div class="h-9 w-9 rounded-full bg-gradient-to-tr from-[var(--ru-cyan)] to-[var(--ru-navy-light)] grid place-items-center text-xs font-bold text-white">DR</div>
              <div class="min-w-0 flex-1">
                 <div class="text-xs font-bold truncate">PG Director</div>
                 <div class="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Governance</div>
              </div>
           </div>
        </div>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col lg:pl-72">
        <header class="sticky top-0 z-40 border-b border-[#dde1e8] bg-[var(--ru-cyan-light)] shadow-sm h-24 flex items-center">
          <div class="px-6 py-3 flex items-center gap-4 w-full">
            <button id="mobileNavBtn" class="lg:hidden inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/20 transition">
              Menu
            </button>
            
            <div class="min-w-0 flex-1">
              <div id="pageTitle" class="text-lg sm:text-xl font-bold text-[var(--ru-navy)] truncate tracking-tight">Postgraduate Director Dashboard</div>
              <div id="pageSubtitle" class="text-xs text-[var(--ru-navy-light)] truncate font-medium flex items-center gap-2">
                <span class="h-1.5 w-1.5 rounded-full bg-[var(--ru-gold)]"></span>
                Governance • Approvals • Compliance • Analytics
              </div>
            </div>

            <div class="hidden sm:flex items-center gap-4">
              <div class="text-right mr-4 border-r border-[var(--ru-navy-light)]/20 pr-4">
                  <div id="hdrUserName" class="text-sm font-bold text-[var(--ru-navy)]">Dean / Director</div>
                  <div id="hdrUserRole" class="text-[9px] font-bold text-[var(--ru-navy-light)] uppercase tracking-widest">School Authority</div>
              </div>
              <button id="sysControlBtn" class="h-11 w-11 rounded-xl bg-[var(--ru-navy)] grid place-items-center text-white hover:bg-[var(--ru-navy-light)] transition shadow-lg shadow-black/10 border border-white/10" title="System Control Center">
                <div class="relative">
                  <span class="h-3 w-3 rounded-full bg-[var(--ru-gold)] block"></span>
                  <span class="absolute inset-0 h-3 w-3 rounded-full bg-[var(--ru-gold)] block animate-ping opacity-75"></span>
                </div>
              </button>
            </div>
          </div>
        </header>

        <main class="px-6 py-8">
          <div id="pageContent"></div>
        </main>
      </div>

    </div>

    <div id="mobileDrawer" class="lg:hidden fixed inset-0 z-50 hidden">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" data-close="1"></div>
      <div class="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-[var(--ru-navy)] text-white border-r border-white/10 shadow-2xl">
        <div class="p-6 flex items-center justify-between border-b border-white/10 bg-white">
          <div class="flex items-center gap-3">
             <img src="/assets/ru.png" alt="R.U logo" class="h-10 w-auto">
             <div>
               <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Director</div>
               <div class="text-[10px] font-bold text-slate-800 uppercase tracking-widest">Portal</div>
             </div>
          </div>
          <button class="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600" data-close="1">Close</button>
        </div>
        <nav class="px-3 pb-5 space-y-1 overflow-auto app-scroll mt-4">
          ${nav
      .map((n) => {
        const active = n.key === navKey;
        return `
                <a href="${n.href}" class="${active
            ? "bg-white/10 text-white border-l-4 border-[var(--ru-cyan)] font-semibold"
            : "text-slate-400 hover:bg-white/5 hover:text-white border-l-4 border-transparent"
          } flex items-center gap-4 px-4 py-3.5 text-sm transition-all rounded-r-lg">
                  <span class="h-1.5 w-1.5 rounded-full ${active ? "bg-[var(--ru-cyan)]" : "bg-white/20"}"></span>
                  <span>${escapeHtml(n.label)}</span>
                </a>
              `;
      })
      .join("")}
          
          <div class="pt-4 mt-4 border-t border-white/5">
            <button id="mobileLogoutBtn" class="w-full flex items-center gap-4 px-4 py-3.5 text-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all border-l-4 border-transparent rounded-r-lg group">
              <span class="h-1.5 w-1.5 rounded-full bg-rose-500/40 group-hover:bg-rose-500"></span>
              <span class="font-semibold">Logout</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  `;

  const mobileDrawer = qs("#mobileDrawer");
  const openBtn = qs("#mobileNavBtn");
  const closeEls = qsa("[data-close='1']", mobileDrawer);
  const open = () => mobileDrawer?.classList.remove("hidden");
  const close = () => mobileDrawer?.classList.add("hidden");
  openBtn?.addEventListener("click", open);
  closeEls.forEach((el) => el.addEventListener("click", close));

  // Global Control Center Shortcut (G key)
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "g" && !["INPUT", "TEXTAREA"].includes(e.target.tagName)) {
      openSystemControlCenter();
    }
  });

  qs("#sysControlBtn")?.addEventListener("click", openSystemControlCenter);
  qs("#logoutBtn")?.addEventListener("click", handleLogout);
  qs("#mobileLogoutBtn")?.addEventListener("click", handleLogout);

  // Populate header user info from localStorage if available
  try {
    const raw = localStorage.getItem("postgraduate_user");
    const u = raw ? JSON.parse(raw) : null;
    const nameEl = qs("#hdrUserName");
    const roleEl = qs("#hdrUserRole");
    if (u && nameEl && roleEl) {
      nameEl.textContent = u.fullName || u.userNumber || "User";
      const roleLabel = (u.role || "").toString();
      roleEl.textContent = roleLabel.toLowerCase() === "director" || roleLabel.toLowerCase() === "admin" ? "PG Dean / Director" : roleLabel ? roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1) : "Visitor";
    }
  } catch (e) {
    // ignore parsing errors
  }

  // If we have a user id but not a fullName, fetch details to improve the header display
  try {
    const raw = localStorage.getItem("postgraduate_user");
    const u = raw ? JSON.parse(raw) : null;
    if (u && u.id && !u.fullName) {
      const res = await fetch(`http://localhost:5000/api/students/${encodeURIComponent(u.id)}`);
      if (res.ok) {
        const student = await res.json();
        if (student && (student.fullName || student.userNumber)) {
          const updated = Object.assign({}, u, { fullName: student.fullName || u.userNumber });
          localStorage.setItem("postgraduate_user", JSON.stringify(updated));
          const nameEl2 = qs("#hdrUserName");
          if (nameEl2) nameEl2.textContent = updated.fullName;
        }
      }
    }
  } catch (err) {
    // silent
  }
}

export function openSystemControlCenter() {
  openModal({
    title: "System Control Center (Super Power Mode)",
    size: "lg",
    bodyHtml: `
      <div class="space-y-6 animate-in">
        <div class="rounded-2xl dark-glass p-6 power-glow">
          <div class="flex items-center gap-4">
            <div class="h-12 w-12 rounded-2xl bg-amber-500 grid place-items-center text-white text-2xl">⚡</div>
            <div>
              <div class="text-lg font-bold">Director Authority Override</div>
              <div class="text-sm text-slate-300">You are in Super Power Mode. Every action here bypasses normal system rules.</div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="rounded-2xl border border-slate-200 bg-white p-5 hover:border-blue-400 transition cursor-pointer group">
            <div class="text-sm font-bold text-slate-900 group-hover:text-blue-600">Global Broadcast</div>
            <div class="mt-1 text-xs text-slate-500">Send emergency alerts to students, supervisors, and finance.</div>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-5 hover:border-amber-400 transition cursor-pointer group">
            <div class="text-sm font-bold text-slate-900 group-hover:text-amber-600">Force Workflow Modification</div>
            <div class="mt-1 text-xs text-slate-500">Skip stages or enable/disable specific status checks.</div>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-5 hover:border-rose-400 transition cursor-pointer group">
            <div class="text-sm font-bold text-slate-900 group-hover:text-rose-600">Intervention Center</div>
            <div class="mt-1 text-xs text-slate-500">Identify and fix bottlenecks across all departments instantly.</div>
          </div>
          <div class="rounded-2xl border border-slate-200 bg-white p-5 hover:border-emerald-400 transition cursor-pointer group">
            <div class="text-sm font-bold text-slate-900 group-hover:text-emerald-600">System Governance</div>
            <div class="mt-1 text-xs text-slate-500">Modify pass thresholds, rules, and school-wide settings.</div>
          </div>
        </div>

        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-4">
          <div class="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Live Emergency Feed</div>
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs p-2 bg-white rounded-xl border border-slate-200">
              <span class="font-semibold text-rose-600">CRITICAL:</span>
              <span class="flex-1 px-2 text-slate-700 truncate">12 Proposals stuck in IHRS for > 14 days</span>
              <button class="text-blue-600 font-bold hover:underline">Intervene</button>
            </div>
            <div class="flex items-center justify-between text-xs p-2 bg-white rounded-xl border border-slate-200">
              <span class="font-semibold text-amber-600">WARNING:</span>
              <span class="flex-1 px-2 text-slate-700 truncate">Sup2 (Dr. Omondi) has exceeded student capacity (9)</span>
              <button class="text-blue-600 font-bold hover:underline">Balance</button>
            </div>
          </div>
        </div>
      </div>
    `,
    footerHtml: `
      <div class="flex justify-between items-center">
        <div class="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Director Signature Required for All Actions</div>
        <button class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold hover:bg-slate-50 transition" data-modal-close="1">Exit Control</button>
      </div>
    `
  });
}

export function setPageMeta({ title, subtitle } = {}) {
  const t = qs("#pageTitle");
  const s = qs("#pageSubtitle");
  if (t && title) t.textContent = title;
  if (s && subtitle) s.textContent = subtitle;
}

export function setPageContent(html) {
  const root = qs("#pageContent");
  if (!root) return;
  root.innerHTML = html;
}

export function mountEmptyState({ title, message, actionsHtml } = {}) {
  return `
    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
      <div class="text-base font-semibold text-slate-900">${escapeHtml(title || "No data yet")}</div>
      <div class="mt-1 text-sm text-slate-600">${escapeHtml(
    message || "Waiting for the API response."
  )}</div>
      ${actionsHtml ? `<div class="mt-4 flex flex-wrap gap-2">${actionsHtml}</div>` : ""}
    </div>
  `;
}

export function chartBars(canvas, { labels, values, color = "#2563eb", gridColor = "#e2e8f0" }) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  const w = canvas.clientWidth || 600;
  const h = canvas.clientHeight || 240;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, w, h);
  const pad = 28;
  const chartW = w - pad * 2;
  const chartH = h - pad * 2;
  const max = Math.max(1, ...values.map((v) => Number(v) || 0));

  // grid
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad + (chartH * i) / 4;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(pad + chartW, y);
    ctx.stroke();
  }

  const barCount = values.length || 1;
  const gap = 8;
  const barW = Math.max(10, (chartW - gap * (barCount - 1)) / barCount);

  ctx.fillStyle = color;
  values.forEach((v, i) => {
    const val = Number(v) || 0;
    const bh = (val / max) * chartH;
    const x = pad + i * (barW + gap);
    const y = pad + (chartH - bh);
    roundRect(ctx, x, y, barW, bh, 10);
    ctx.fill();
  });

  // labels (lightweight)
  ctx.fillStyle = "#475569";
  ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
  labels.forEach((lbl, i) => {
    const x = pad + i * (barW + gap) + barW / 2;
    const y = h - 8;
    ctx.textAlign = "center";
    ctx.fillText(String(lbl).slice(0, 10), x, y);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

