import { api } from "./api.js";
import { badge, confirmModal, escapeHtml, mountEmptyState, openModal, setPageContent, setPageMeta, toast } from "./main.js";

function normalize(raw) {
  const root = raw?.data || raw;
  if (Array.isArray(root)) return { supervisors: root };
  if (Array.isArray(root?.supervisors)) return root;
  if (Array.isArray(root?.items)) return { supervisors: root.items, total: root.total };
  return { supervisors: [] };
}

function row(s) {
  const id = s?.id || s?._id || s?.staffId || "";
  const name = s?.name || s?.fullName || "Supervisor";
  const dept = s?.department || "—";
  const students = s?.studentCount ?? s?.students ?? 0;
  const pending = s?.pendingApprovals ?? s?.pending ?? 0;
  const overloaded = Number(students) >= 8;
  return `
    <tr class="hover:bg-slate-50 transition">
      <td class="px-4 py-3">
        <div class="text-sm font-semibold text-slate-900">${escapeHtml(name)}</div>
        <div class="text-xs text-slate-500">${escapeHtml(id || "—")}</div>
      </td>
      <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(dept)}</td>
      <td class="px-4 py-3">${badge({ label: String(students), tone: overloaded ? "yellow" : "blue" })}</td>
      <td class="px-4 py-3">${badge({ label: String(pending), tone: Number(pending) ? "red" : "green" })}</td>
      <td class="px-4 py-3">
        <div class="flex flex-wrap gap-2">
          <button data-act="assign" data-id="${escapeHtml(id)}" class="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">Assign student</button>
          <button data-act="remove" data-id="${escapeHtml(id)}" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition">Remove student</button>
          <button data-act="balance" data-id="${escapeHtml(id)}" class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 transition">Balance workload</button>
        </div>
      </td>
    </tr>
  `;
}

function pageShell() {
  return `
    <div class="space-y-4">
      <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div class="text-lg font-semibold tracking-tight">Supervisors</div>
            <div class="mt-1 text-sm text-slate-600">Accountability: workload, pending approvals, and Director balancing controls.</div>
          </div>
          <button id="notifyAllSup" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition">Notify supervisors</button>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
          <div class="text-sm font-semibold">Workload & approvals</div>
          <div id="meta" class="text-xs text-slate-500">—</div>
        </div>
        <div class="overflow-auto app-scroll">
          <table class="min-w-[980px] w-full text-left">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr class="text-xs font-semibold text-slate-600">
                <th class="px-4 py-3">Supervisor</th>
                <th class="px-4 py-3">Department</th>
                <th class="px-4 py-3"># Students</th>
                <th class="px-4 py-3">Pending approvals</th>
                <th class="px-4 py-3">Director actions</th>
              </tr>
            </thead>
            <tbody id="tbody" class="divide-y divide-slate-200"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function setMeta(t) {
  const el = document.getElementById("meta");
  if (el) el.textContent = t;
}

async function load() {
  setPageMeta({ title: "Supervisors", subtitle: "Workload • pending approvals • balancing controls" });
  setPageContent(pageShell());

  const tbody = document.getElementById("tbody");
  if (tbody) {
    tbody.innerHTML = Array.from({ length: 8 })
      .map(
        () => `
        <tr>
          <td class="px-4 py-3"><div class="h-4 w-44 rounded skeleton"></div><div class="mt-2 h-3 w-24 rounded skeleton"></div></td>
          <td class="px-4 py-3"><div class="h-4 w-20 rounded skeleton"></div></td>
          <td class="px-4 py-3"><div class="h-5 w-10 rounded skeleton"></div></td>
          <td class="px-4 py-3"><div class="h-5 w-12 rounded skeleton"></div></td>
          <td class="px-4 py-3"><div class="h-9 w-72 rounded skeleton"></div></td>
        </tr>
      `
      )
      .join("");
  }
  setMeta("Loading…");

  try {
    const raw = await (api.getSupervisors ? api.getSupervisors() : Promise.reject(new Error("Missing api.getSupervisors()")));
    const { supervisors, total } = normalize(raw);
    const arr = Array.isArray(supervisors) ? supervisors : [];
    if (!arr.length) {
      setPageContent(
        mountEmptyState({
          title: "No supervisors returned",
          message: "Implement /api/supervisors to provide workload and pending approvals.",
        })
      );
      return;
    }
    document.getElementById("tbody").innerHTML = arr.map(row).join("");
    setMeta(`${arr.length}${typeof total === "number" ? ` of ${total}` : ""} supervisors`);
  } catch (e) {
    console.error(e);
    toast(e?.message || "Failed to load supervisors (API not ready)", { tone: "red" });
    setPageContent(
      mountEmptyState({
        title: "Supervisors API not available",
        message: "Add /api/supervisors and api.getSupervisors() to power this page.",
      })
    );
    return;
  }

  document.getElementById("notifyAllSup")?.addEventListener("click", async () => {
    const msg = window.prompt("Message to all supervisors:") || "";
    if (!msg.trim()) return;
    try {
      await api.sendNotification({ audience: "supervisors", type: "notice", message: msg.trim() });
      toast("Notification sent", { tone: "green" });
    } catch (e) {
      console.error(e);
      toast(e?.message || "Notification failed (API not ready)", { tone: "red" });
    }
  });

  document.getElementById("tbody")?.addEventListener("click", async (e) => {
    const b = e.target?.closest?.("button[data-act]");
    if (!b) return;
    const id = b.dataset.id;
    const act = b.dataset.act;

    const modal = openModal({
      title: "Supervisor action (Director)",
      size: "md",
      bodyHtml: `
        <div class="space-y-3">
          <div class="text-sm text-slate-700">Action: <span class="font-semibold">${escapeHtml(act)}</span></div>
          <div class="text-xs text-slate-500">API-ready endpoints recommended: <span class="font-mono">POST /api/supervisors/:id/assign</span>, <span class="font-mono">/remove</span>, <span class="font-mono">/balance</span></div>
          <div>
            <label class="block text-xs font-semibold text-slate-600">Student ID (if applicable)</label>
            <input id="sid" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-400" placeholder="Student ID" />
          </div>
          <div class="flex gap-2">
            <button data-ok="1" class="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">Apply</button>
            <button data-cancel="1" class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50 transition">Cancel</button>
          </div>
        </div>
      `,
    });

    modal.qs("[data-cancel='1']")?.addEventListener("click", modal.close);
    modal.qs("[data-ok='1']")?.addEventListener("click", async () => {
      try {
        const studentId = modal.qs("#sid")?.value?.trim() || "";
        const ok = await confirmModal({
          title: "Confirm supervisor action",
          message: "Apply this Director action now?",
          confirmText: "Apply",
          tone: act === "balance" ? "yellow" : "blue",
        });
        if (!ok) return;
        if (api.supervisorAction) await api.supervisorAction(id, { act, studentId });
        else throw new Error("Missing api.supervisorAction()");
        toast("Action applied", { tone: "green" });
        modal.close();
        await load();
      } catch (err) {
        console.error(err);
        toast(err?.message || "Action failed (API not ready)", { tone: "red" });
      }
    });
  });
}

load();

