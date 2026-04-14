import { api } from "./api.js";
import {
  badge,
  escapeHtml,
  mountEmptyState,
  openModal,
  setPageContent,
  setPageMeta,
  toast,
  formatDate,
  confirmModal,
  STAGES
} from "./main.js";

document.addEventListener("DOMContentLoaded", async () => {
  setPageMeta({
    title: "Panel Management",
    subtitle: "Coordinate postgraduate seminar evaluations and assign panelists."
  });

  async function load() {
    setPageContent(`
      <div class="space-y-6">
        <section class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div class="text-lg font-semibold tracking-tight text-slate-900">Active Panels</div>
            <div class="mt-1 text-sm text-slate-500">Track submission progress and view final verdicts.</div>
          </div>
          <button id="createPanelBtn" class="inline-flex items-center gap-2 rounded-xl bg-[var(--ru-navy)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--ru-navy-light)] transition shadow-lg shadow-black/10">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
            Create New Panel
          </button>
        </section>

        <div id="panelsList" class="grid grid-cols-1 gap-4">
          <div class="p-12 text-center text-slate-400 font-bold animate-pulse uppercase tracking-widest">Synchronizing Panel Cluster...</div>
        </div>
      </div>
    `);

    try {
      const panels = await api.getPanels();
      renderPanels(panels);
    } catch (err) {
      toast(err.message, { tone: "red" });
      document.getElementById("panelsList").innerHTML = mountEmptyState({
        title: "No panels found",
        message: "Create your first panel to begin the evaluation workflow."
      });
    }

    document.getElementById("createPanelBtn").addEventListener("click", openCreatePanelModal);
  }

  function renderPanels(panels) {
    const list = document.getElementById("panelsList");
    if (!panels || panels.length === 0) {
      list.innerHTML = mountEmptyState({
        title: "No panels scheduled",
        message: "Use the button above to schedule a new evaluation event."
      });
      return;
    }

    list.innerHTML = panels.map(p => `
      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft hover:shadow-lg transition-all animate-in">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-2">
              ${badge({ label: p.stage, tone: "blue" })}
              <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">${p.status}</span>
            </div>
            <div class="text-lg font-bold text-slate-900 truncate">${escapeHtml(p.studentId?.fullName || "Unknown Student")}</div>
            <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
              <span class="flex items-center gap-1.5"><svg class="h-3.5 w-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>${formatDate(p.scheduledDate)}</span>
              <span class="flex items-center gap-1.5"><svg class="h-3.5 w-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>${p.studentId?.userNumber || "N/A"}</span>
              <span class="flex items-center gap-1.5">${p.studentId?.programme?.toUpperCase() || ""}</span>
            </div>
          </div>

          <div class="flex items-center gap-4 lg:border-l lg:border-slate-100 lg:pl-6">
            <div class="text-center">
              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                Submissions (${p.members?.filter(m => m.hasSubmitted).length || 0}/${p.members?.length || 0})
              </div>
              <div class="flex -space-x-2">
                ${p.members?.map(m => `
                  <div class="h-8 w-8 rounded-full border-2 border-white grid place-items-center text-[10px] font-bold ${m.hasSubmitted ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}" title="${m.email} (${m.type})">
                    ${m.hasSubmitted ? '✓' : '?'}
                  </div>
                `).join('')}
              </div>
            </div>
            </div>
            <div class="hidden sm:block h-8 w-px bg-slate-100 mr-2"></div>
            <div class="flex flex-col gap-2">
              <button class="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition" onclick="viewPanelResults('${p._id}')">View Details</button>
              ${p.status !== 'completed' ? `<button class="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold hover:bg-slate-50 transition" onclick="openManagePanelModal('${p._id}')">Manage Panel</button>` : ''}
            </div>
          </div>
        </div>
      </div>
    `).join("");
  }

  async function openCreatePanelModal() {
    try {
      const [students, eligiblePanelists] = await Promise.all([
        api.getStudents(),
        api.getEligiblePanelists()
      ]);

      const groups = {
        supervisors: eligiblePanelists.filter(u => u.role === 'supervisor'),
        leadership: eligiblePanelists.filter(u => ['director', 'pg_dean', 'admin'].includes(u.role)),
        faculty: eligiblePanelists.filter(u => u.role === 'faculty')
      };

      const modal = openModal({
        title: "Schedule New Panel Event",
        size: "lg",
        bodyHtml: `
          <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Target Student</label>
                <select id="pStudent" class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-400 focus:ring-4 focus:ring-blue-50">
                  ${students.map(s => `<option value="${s._id}">${s.fullName} (${s.userNumber}) - ${s.stage}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Evaluation Stage</label>
                <select id="pStage" class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm">
                  ${STAGES.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Scheduled Date</label>
              <input type="datetime-local" id="pDate" class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm">
            </div>

              <div class="flex items-center justify-between mb-2">
                <label class="text-xs font-bold text-slate-500 uppercase tracking-widest">Assign Internal Panelists</label>
                <span class="text-[10px] text-slate-400">Directors, Deans, & Faculty</span>
              </div>
              <div class="grid grid-cols-1 gap-4 max-h-64 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
                ${Object.entries(groups).map(([name, members]) => members.length > 0 ? `
                  <div>
                    <div class="px-3 py-1 text-[10px] font-black text-slate-400 uppercase tracking-tighter">${name}</div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                      ${members.map(s => `
                        <label class="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-blue-300 transition">
                          <input type="checkbox" name="internal" value="${s._id}" data-email="${s.userNumber}@rongo.ac.ke" data-name="${s.fullName}" class="h-4 w-4 bg-blue-600">
                          <div class="min-w-0">
                            <div class="text-xs font-semibold truncate">${s.fullName}</div>
                            <div class="text-[9px] text-slate-400">${s.role.toUpperCase()}</div>
                          </div>
                        </label>
                      `).join('')}
                    </div>
                  </div>
                ` : '').join('')}
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">External Examiner Email</label>
              <input type="email" id="pExternal" placeholder="external@university.ac.ke" class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm">
            </div>

            <div class="h-px bg-slate-100 my-4"></div>

            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Designate Chairperson</label>
              <p class="text-[10px] text-slate-400 mb-2">The Chair is responsible for the formal session transcript and AI corrections checklist.</p>
              <select id="pChairSelection" class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50">
                <option value="">Select members above first...</option>
              </select>
            </div>
          </div>
        `,
        footerHtml: `
          <div class="flex justify-end gap-3 w-full">
            <button id="modalSubmitBtn" class="rounded-xl bg-[var(--ru-navy)] px-6 py-2.5 text-sm font-bold text-white hover:bg-[var(--ru-navy-light)] transition shadow-lg shadow-black/10">Schedule Panel Now</button>
          </div>
        `
      });

      modal.qs("#modalSubmitBtn").onclick = async () => {
        const studentId = modal.qs("#pStudent").value;
        const stage = modal.qs("#pStage").value;
        const scheduledDate = modal.qs("#pDate").value;
        const externalEmail = modal.qs("#pExternal").value;

        if (!scheduledDate) return toast("Please select a date", { tone: "yellow" });

        const panelists = [];
        // Add internals
        modal.host.querySelectorAll("input[name='internal']:checked").forEach(cb => {
          panelists.push({ userId: cb.value, email: cb.dataset.email, type: "internal" });
        });

        // Add external
        if (externalEmail) {
          panelists.push({ email: externalEmail, type: "external" });
        }

        const chairEmail = modal.qs("#pChairSelection").value;

        if (panelists.length < 3) return toast("Academic rule: Minimum 3 members (Chair + 2) required.", { tone: "yellow" });
        if (!chairEmail) return toast("Please designate a Chairperson for this session.", { tone: "yellow" });

        try {
          const user = JSON.parse(localStorage.getItem("postgraduate_user"));
          await api.createPanel({
            studentId,
            stage,
            scheduledDate,
            panelists,
            createdBy: user.id || user._id,
            chairEmail // The designated chair
          });
          toast("Formal panel scheduled successfully", { tone: "green" });
          modal.close();
          load();
        } catch (err) {
          toast(err.message, { tone: "red" });
        }
      };

      // --- Dynamic Chairperson Selection Logic ---
      const updateChairChoices = () => {
        const chairSelect = modal.qs("#pChairSelection");
        if (!chairSelect) return;
        
        chairSelect.innerHTML = '<option value="">Select a Chairperson...</option>';
        
        modal.host.querySelectorAll("input[name='internal']:checked").forEach(cb => {
          const opt = document.createElement("option");
          opt.value = cb.dataset.email;
          opt.textContent = `${cb.dataset.name} (Internal)`;
          chairSelect.appendChild(opt);
        });

        const externalEmail = modal.qs("#pExternal").value;
        if (externalEmail) {
          const opt = document.createElement("option");
          opt.value = externalEmail;
          opt.textContent = `${externalEmail} (External)`;
          chairSelect.appendChild(opt);
        }
      };

      modal.host.querySelectorAll("input[name='internal']").forEach(cb => cb.onchange = updateChairChoices);
      modal.qs("#pExternal").oninput = updateChairChoices;

    } catch (err) {
      toast(err.message, { tone: "red" });
    }
  }

  window.viewPanelResults = async (id) => {
    try {
      const results = await api.getPanelResults(id);
      const isProvisional = results.status === "in_progress";
      
      openModal({
        title: "Panel Evaluation Results",
        bodyHtml: `
          <div class="space-y-6">
            ${isProvisional ? `
              <div class="rounded-xl border border-yellow-200 bg-yellow-50 p-3 flex items-center justify-between text-yellow-800 text-xs font-medium">
                <span class="flex items-center gap-2">
                  <svg class="h-4 w-4 animate-spin text-yellow-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Evaluation in progress. Showing real-time provisional scores.
                </span>
                <span class="font-bold text-[10px] tracking-widest uppercase opacity-70">Live Data</span>
              </div>
            ` : ""}
            <div class="grid grid-cols-2 gap-4">
              <div class="rounded-2xl bg-slate-50 p-4 border border-slate-200 text-center">
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Average Score</div>
                <div class="text-3xl font-black text-slate-900">${Math.round(results.averageScore)}%</div>
              </div>
              <div class="rounded-2xl bg-slate-50 p-4 border border-slate-200 text-center">
                <div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${isProvisional ? "Current Verdict" : "Final Verdict"}</div>
                <div class="mt-1">${badge({ label: results.finalVerdict.toUpperCase(), tone: results.finalVerdict === 'pass' ? 'green' : 'red' })}</div>
              </div>
            </div>

            <div>
              <div class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Panelist Breakdown</div>
              <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider">
                    <tr>
                      <th class="px-3 py-2">Panelist</th>
                      <th class="px-3 py-2">Type</th>
                      <th class="px-3 py-2 text-center">Score</th>
                      <th class="px-3 py-2 text-center">Verdict</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    ${results.panelistBreakdown?.map(pb => `
                      <tr>
                        <td class="px-3 py-2 font-semibold text-slate-700">${escapeHtml(pb.name)}</td>
                        <td class="px-3 py-2 text-slate-500">${pb.type}</td>
                        <td class="px-3 py-2 text-center font-bold text-slate-600">${Math.round(pb.score)}%</td>
                        <td class="px-3 py-2 text-center text-[9px] font-black uppercase tracking-tighter ${pb.verdict === 'pass' ? 'text-emerald-500' : 'text-red-500'}">${pb.verdict}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="space-y-4">
              <div class="text-xs font-bold text-slate-500 uppercase tracking-widest">Aggregated Feedback Categories</div>
              
              <div class="grid grid-cols-1 gap-3">
                ${results.summaryFeedback?.critical?.length ? `
                  <div class="rounded-xl border border-red-100 bg-red-50/30 p-3">
                    <div class="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-2 flex items-center gap-1.5 line-through decoration-red-200">
                      <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                      Critical Issues
                    </div>
                    <ul class="list-disc list-inside text-xs text-red-900 space-y-1">
                      ${results.summaryFeedback.critical.map(c => `<li>${escapeHtml(c)}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}

                ${results.summaryFeedback?.minor?.length ? `
                  <div class="rounded-xl border border-blue-100 bg-blue-50/30 p-3">
                    <div class="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      Minor Corrections
                    </div>
                    <ul class="list-disc list-inside text-xs text-blue-900 space-y-1 font-medium">
                      ${results.summaryFeedback.minor.map(m => `<li>${escapeHtml(m)}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}

                ${results.summaryFeedback?.recommendations?.length ? `
                  <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      Development Recommendations
                    </div>
                    <ul class="list-disc list-inside text-xs text-slate-700 space-y-1 italic">
                      ${results.summaryFeedback.recommendations.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        `
      });
    } catch (err) {
      toast(err.status === 404 ? "Evaluation still in progress. Results will be available once all panelists submit." : err.message, { tone: "yellow" });
    }
  };

  /**
   * MANAGEMENT: Reassign or Revoke Panelists
   */
  window.openManagePanelModal = async (panelId) => {
    try {
      const panels = await api.getPanels();
      const p = panels.find(item => item._id === panelId);
      const eligible = await api.getEligiblePanelists();
      const user = JSON.parse(localStorage.getItem("postgraduate_user"));

      const modal = openModal({
        title: `Manage Board: ${p.studentId?.fullName}`,
        size: "lg",
        bodyHtml: `
          <div class="space-y-6">
            <div class="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-4 items-start">
              <div class="h-10 w-10 rounded-xl bg-blue-600 text-white grid place-items-center shrink-0">
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div class="text-sm text-blue-900 leading-relaxed">
                <div class="font-bold mb-1">Dynamic Privileges Control</div>
                Privileges are strictly tied to a user's <strong>active</strong> membership in this presentation's panel. Revoking a member removes their access immediately.
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Active Panel Members</label>
              <div class="space-y-2">
                ${p.members.map(m => `
                  <div class="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
                    <div>
                      <div class="font-bold text-slate-900 text-sm">${m.email}</div>
                      <div class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">${m.role} • ${m.type}</div>
                    </div>
                    <div class="flex items-center gap-2">
                      <button class="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition" onclick="showReassignmentForm('${m._id}', '${m.role}')">Replace</button>
                      <button class="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition" onclick="revokeMembership('${panelId}', '${m._id}')">Revoke</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <div id="reassignmentArea" class="hidden animate-in border-t border-slate-100 pt-6">
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Select Replacement Panelist</label>
              <input type="hidden" id="oldMemberId">
              <input type="hidden" id="targetRole">
              <select id="newPanelist" class="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm mb-4">
                <option value="">-- Choose New Member --</option>
                ${eligible.map(e => `<option value="${e._id}" data-email="${e.userNumber}@rongo.ac.ke">${e.fullName} (${e.role})</option>`).join('')}
              </select>
              <button id="confirmReassignBtn" class="w-full rounded-xl bg-blue-600 py-3 text-white font-bold text-sm shadow-lg shadow-blue-200">Confirm Reassignment</button>
            </div>
          </div>
        `
      });

      window.showReassignmentForm = (memberId, role) => {
        modal.qs("#oldMemberId").value = memberId;
        modal.qs("#targetRole").value = role;
        modal.qs("#reassignmentArea").classList.remove('hidden');
        modal.host.querySelector("#reassignmentArea").scrollIntoView({ behavior: 'smooth' });
      };

      window.revokeMembership = async (panelId, memberId) => {
        if (!confirm("Are you sure? This user will immediately lose access to this presentation assessment board.")) return;
        try {
          await api.revokePanelist(panelId, memberId);
          toast("Access revoked successfully", { tone: "green" });
          modal.close();
          load();
        } catch (err) { toast(err.message, { tone: "red" }); }
      };

      modal.qs("#confirmReassignBtn").onclick = async () => {
        const oldMemberId = modal.qs("#oldMemberId").value;
        const targetRole = modal.qs("#targetRole").value;
        const newUserId = modal.qs("#newPanelist").value;
        const newUserOption = modal.qs("#newPanelist").selectedOptions[0];

        if (!newUserId) return toast("Select a replacement member", { tone: "yellow" });

        try {
          await api.reassignPanelist(panelId, {
            oldMemberId,
            newMember: {
              userId: newUserId,
              email: newUserOption.dataset.email,
              type: "internal"
            },
            role: targetRole,
            assignedBy: user.id || user._id
          });
          toast("Panelist swapped successfully", { tone: "green" });
          modal.close();
          load();
        } catch (err) { toast(err.message, { tone: "red" }); }
      };

    } catch (err) { toast(err.message, { tone: "red" }); }
  };

  load();
});
