import { api } from "./api.js"; 
import {
  badge,
  escapeHtml,
  formatDate,
  mountEmptyState,
  setPageContent,
  setPageMeta,
  toast,
} from "./main.js";

/* ================= HELPERS ================= */

function normalizeReports(raw) {
  const root = raw?.data || raw;
  if (Array.isArray(root)) return { reports: root };
  return { reports: root || [] };
}

function toneForStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("approved")) return "green";
  if (s.includes("rejected")) return "red";
  if (s.includes("pending") || s.includes("under_review")) return "yellow";
  return "slate";
}

/* ================= UI ================= */

function filtersHtml() {
  return `
    <div class="bg-white p-4 rounded shadow">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input id="q" placeholder="Search..." class="border p-2 rounded"/>

        <select id="status" class="border p-2 rounded">
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>

        <div class="flex gap-2">
          <button id="apply" class="bg-black text-white px-3 py-2 rounded">Apply</button>
          <button id="reset" class="border px-3 py-2 rounded">Reset</button>
        </div>
      </div>
    </div>
  `;
}

function tableHtml() {
  return `
    <div class="overflow-x-auto">
      <table class="w-full mt-4 border text-left">
        <thead>
          <tr class="bg-gray-100">
            <th class="p-2">Student</th>
            <th class="p-2">Report</th>
            <th class="p-2">Status</th>
            <th class="p-2">Actions</th>
          </tr>
        </thead>
        <tbody id="tbody"></tbody>
      </table>
    </div>
  `;
}

function mount() {
  setPageMeta({
    title: "Quarterly Reports",
    subtitle: "Manage reports",
  });

  setPageContent(`
    ${filtersHtml()}
    ${tableHtml()}
  `);
}

/* ================= ROW ================= */

function reportRow(r) {
  const id = r._id;
  const studentName = r?.ownerId?.fullName || r.owner || "—";
  const studentId = r?.ownerId?.userNumber || r.owner || "—";
  const title = r.reportingQuarter || "—";
  const status = r.status;

  return `
    <tr class="border-b hover:bg-gray-50">
      <td class="p-2">
        <div>${escapeHtml(studentName)}</div>
        <div class="text-xs text-gray-500">${escapeHtml(studentId)}</div>
      </td>

      <td class="p-2">
        <a href="${r.reportUrl}" target="_blank" class="text-blue-600 underline">
          ${escapeHtml(title)}
        </a>
        <div class="text-xs text-gray-500">${formatDate(r.createdAt)}</div>
      </td>

      <td class="p-2">
        ${badge({ label: status, tone: toneForStatus(status) })}
      </td>

      <td class="p-2 flex gap-2">
        <button data-id="${id}" data-act="approve"
          class="bg-blue-600 text-white px-2 py-1 rounded">
          Approve
        </button>

        <button data-id="${id}" data-act="reject"
          class="border px-2 py-1 rounded">
          Reject
        </button>
      </td>
    </tr>
  `;
}

/* ================= LOGIC ================= */

function getFilters() {
  return {
    q: document.getElementById("q")?.value || "",
    status: document.getElementById("status")?.value || "",
  };
}

async function load() {
  const tbody = document.getElementById("tbody");
  if (tbody) tbody.innerHTML = "<tr><td colspan='4'>Loading...</td></tr>";

  try {
    const raw = await api.getReports(getFilters());
    const { reports } = normalizeReports(raw);

    if (!reports.length) {
      setPageContent(
        filtersHtml() +
        mountEmptyState({
          title: "No reports found",
          message: "Nothing matches your filters",
        })
      );
      return;
    }

    // Sort by year -> quarter -> student name
 const sortedReports = reports.sort((a, b) => {
  // fallback nulls to 0
  const yearA = a.year || 0;
  const yearB = b.year || 0;
  const quarterA = a.quarter || 0;
  const quarterB = b.quarter || 0;

  // sort by year descending
  if (yearA !== yearB) return yearB - yearA;

  // sort by quarter descending
  if (quarterA !== quarterB) return quarterB - quarterA;

  // sort by student name ascending
  const nameA = (a.owner || "").toLowerCase();
  const nameB = (b.owner || "").toLowerCase();
  return nameA.localeCompare(nameB);
});

    mount();

    const tb = document.getElementById("tbody");
    tb.innerHTML = sortedReports.map(reportRow).join("");

    wireActions();
  } catch (e) {
    console.error(e);
    toast("Failed to load reports", { tone: "red" });
  }
}

/* ================= ACTIONS ================= */

function wireActions() {
  document.getElementById("tbody")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    const act = btn.dataset.act;

    try {
      if (act === "approve") {
        await api.approveReport(id);
        toast("Approved", { tone: "green" });
      }

      if (act === "reject") {
        const reason = prompt("Reason?");
        await api.rejectReport(id, reason);
        toast("Rejected", { tone: "yellow" });
      }

      load();
    } catch (err) {
      toast(err.message, { tone: "red" });
    }
  });

  document.getElementById("apply")?.addEventListener("click", load);
  document.getElementById("reset")?.addEventListener("click", () => {
    document.getElementById("q").value = "";
    document.getElementById("status").value = "";
    load();
  });
}

/* ================= INIT ================= */

mount();
load();