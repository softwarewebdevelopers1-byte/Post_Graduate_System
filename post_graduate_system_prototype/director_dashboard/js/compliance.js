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

function normalizeUploads(raw) {
  if (Array.isArray(raw?.uploads)) return raw.uploads;
  if (Array.isArray(raw?.data?.uploads)) return raw.data.uploads;
  return [];
}

function complianceTone(type) {
  const value = String(type || "").toLowerCase();
  if (value.includes("nacosti")) return "blue";
  if (value.includes("permit") || value.includes("license")) return "green";
  return "slate";
}

function filtersHtml() {
  return `
    <div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
        <input id="q" class="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Search student, reg no, or title" />
        <input id="docType" class="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Filter by document type" />
        <input id="department" class="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="Department" />
        <div class="flex gap-2">
          <button id="apply" class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Apply</button>
          <button id="reset" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">Reset</button>
        </div>
      </div>
    </div>
  `;
}

function tableHtml() {
  return `
    <div class="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
      <div class="border-b border-slate-200 px-5 py-4">
        <div class="text-base font-semibold text-slate-900">Student compliance submissions</div>
        <div class="mt-1 text-sm text-slate-500">NACOSTI and related fieldwork documents submitted from the student portal.</div>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-600">
            <tr>
              <th class="px-4 py-3 font-semibold">Student</th>
              <th class="px-4 py-3 font-semibold">Document</th>
              <th class="px-4 py-3 font-semibold">Type</th>
              <th class="px-4 py-3 font-semibold">Note</th>
              <th class="px-4 py-3 font-semibold">Submitted</th>
            </tr>
          </thead>
          <tbody id="complianceTbody"></tbody>
        </table>
      </div>
    </div>
  `;
}

function mount() {
  setPageMeta({
    title: "Fieldwork / NACOSTI",
    subtitle: "View live student compliance submissions and fieldwork documentation",
  });

  setPageContent(`
    ${filtersHtml()}
    ${tableHtml()}
  `);
}

function getFilters() {
  return {
    q: (document.getElementById("q")?.value || "").trim().toLowerCase(),
    docType: (document.getElementById("docType")?.value || "").trim().toLowerCase(),
    department: (document.getElementById("department")?.value || "").trim().toLowerCase(),
  };
}

function uploadRow(entry) {
  const title = entry?.upload?.title || "Untitled";
  const type = entry?.upload?.type || "Unknown";
  const note = entry?.upload?.note || "-";
  const href = entry?.upload?.url;

  return `
    <tr class="border-t border-slate-200 align-top">
      <td class="px-4 py-4">
        <div class="font-semibold text-slate-900">${escapeHtml(entry.studentName || "-")}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(entry.studentNumber || "-")}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(entry.programme || "-")} | ${escapeHtml(entry.department || "-")}</div>
      </td>
      <td class="px-4 py-4">
        <div class="font-medium text-slate-900">${escapeHtml(title)}</div>
        ${href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" class="mt-2 inline-flex text-xs font-semibold text-blue-600 hover:underline">Open document</a>` : `<div class="mt-2 text-xs text-slate-400">No link provided</div>`}
      </td>
      <td class="px-4 py-4">${badge({ label: type, tone: complianceTone(type) })}</td>
      <td class="px-4 py-4 text-slate-600">${escapeHtml(note)}</td>
      <td class="px-4 py-4 text-slate-600">${escapeHtml(formatDate(entry?.upload?.submittedAt))}</td>
    </tr>
  `;
}

async function load() {
  const tbody = document.getElementById("complianceTbody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">Loading submissions...</td></tr>`;
  }

  try {
    const uploads = normalizeUploads(await api.getComplianceUploads());
    const filters = getFilters();

    const filtered = uploads.filter((entry) => {
      const blob = [
        entry.studentName,
        entry.studentNumber,
        entry.department,
        entry.programme,
        entry?.upload?.title,
        entry?.upload?.type,
        entry?.upload?.note,
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = !filters.q || blob.includes(filters.q);
      const matchesType = !filters.docType || String(entry?.upload?.type || "").toLowerCase().includes(filters.docType);
      const matchesDepartment = !filters.department || String(entry?.department || "").toLowerCase().includes(filters.department);

      return matchesQuery && matchesType && matchesDepartment;
    });

    if (!filtered.length) {
      setPageContent(
        filtersHtml() +
          mountEmptyState({
            title: "No compliance submissions found",
            message: "No NACOSTI or related documents match the current filters yet.",
          })
      );
      wireActions();
      return;
    }

    mount();
    document.getElementById("complianceTbody").innerHTML = filtered.map(uploadRow).join("");
    wireActions();
  } catch (error) {
    console.error(error);
    toast(error.message || "Failed to load compliance submissions", { tone: "red" });
  }
}

function wireActions() {
  document.getElementById("apply")?.addEventListener("click", load);
  document.getElementById("reset")?.addEventListener("click", () => {
    document.getElementById("q").value = "";
    document.getElementById("docType").value = "";
    document.getElementById("department").value = "";
    load();
  });
}

mount();
wireActions();
load();
