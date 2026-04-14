(() => {
  "use strict";

  // ── CONFIG ─────────────────────────────────────────────────────────────────
  const API = "http://localhost:5000/api";

  // Full ordered pipeline (matches panel.routes.ts STAGES)
  const PIPELINE_STAGES = [
    { key: "Coursework",                    icon: "📚", desc: "Complete coursework requirements" },
    { key: "Concept Note (Department)",     icon: "📝", desc: "Department-level concept note review" },
    { key: "Concept Note (School)",         icon: "🏫", desc: "School-level concept note review" },
    { key: "Proposal (Department)",         icon: "📄", desc: "Submit & defend research proposal (Dept)" },
    { key: "Proposal (School)",             icon: "🎓", desc: "School-level proposal approval" },
    { key: "PG School Approval",            icon: "✅", desc: "PG School endorses your research" },
    { key: "Fieldwork / NACOSTI",           icon: "🔬", desc: "Data collection & NACOSTI clearance" },
    { key: "Thesis Draft (Department)",     icon: "📃", desc: "Department thesis draft review" },
    { key: "Thesis Draft (School)",         icon: "📖", desc: "School-level thesis review" },
    { key: "External Examination Submission", icon: "📤", desc: "Submit thesis for external examination" },
    { key: "Under External Examination",    icon: "🔍", desc: "Thesis under external examiner review" },
    { key: "Final Defence",                 icon: "🛡️", desc: "Final viva voce / defence" },
    { key: "Graduation Clearance",          icon: "🎉", desc: "Financial & academic clearance for graduation" },
  ];

  const CN_STAGES = ["Concept Note (Department)", "Concept Note (School)"];

  // Sub-steps shown inside both Concept Note stages
  const SUBSTEPS = [
    { key: "slot_booking",    label: "Book Presentation Slot",   icon: "📅", desc: "Request a slot for your concept note presentation" },
    { key: "awaiting_panel",  label: "Panel Being Scheduled",    icon: "⏳", desc: "Director is assigning your panel members & date" },
    { key: "document_upload", label: "Upload Concept Note",      icon: "📤", desc: "Upload your concept note PDF for panel review" },
    { key: "panel_review",    label: "Panel Reviewing",          icon: "🔎", desc: "Panel members are evaluating your concept note" },
    { key: "completed",       label: "Concept Note Approved",    icon: "✅", desc: "Passed — advancing to next stage" },
  ];

  // ── HELPERS ────────────────────────────────────────────────────────────────
  function toast(msg, type = "info") {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.className = `toast ${type} show`;
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 4000);
  }

  function getUser() {
    try {
      return (
        JSON.parse(localStorage.getItem("postgraduate_user")) ||
        JSON.parse(localStorage.getItem("userInfo"))
      );
    } catch { return null; }
  }

  function subStepIndex(key) {
    return SUBSTEPS.findIndex(s => s.key === key);
  }

  function stageClass(stageKey, currentStage) {
    const ci = PIPELINE_STAGES.findIndex(s => s.key === currentStage);
    const si = PIPELINE_STAGES.findIndex(s => s.key === stageKey);
    if (si < ci) return "completed";
    if (si === ci) return "active";
    return "locked";
  }

  // ── RENDER: SUB-STEP TIMELINE ──────────────────────────────────────────────
  function renderSubsteps(workflow, userId) {
    const subStage = workflow?.subStage ?? "slot_booking";
    const activeIdx = subStepIndex(subStage);

    const rows = SUBSTEPS.map((step, i) => {
      let cls = "ss-locked";
      if (i < activeIdx) cls = "ss-done";
      else if (i === activeIdx) cls = "ss-active";

      const dotContent = i < activeIdx ? "✓" : step.icon;

      return `
        <div class="ss-row ${cls}" id="ss-${step.key}">
          <div class="ss-dot">${dotContent}</div>
          <div class="ss-body">
            <div class="ss-title">${step.label}</div>
            <div class="ss-note">${step.desc}</div>
            ${i === activeIdx ? renderSubstepAction(step.key, workflow, userId) : ""}
            ${step.key === "document_upload" && workflow?.correctionsList?.length > 0 && i === activeIdx
              ? renderCorrections(workflow.correctionsList) : ""}
          </div>
        </div>`;
    }).join("");

    return `<div class="substeps">${rows}</div>`;
  }

  function renderCorrections(list) {
    const items = list.map(c => `<div class="corr-item">⚠️ ${c}</div>`).join("");
    return `
      <div style="margin-top:8px;">
        <div style="font-size:.73rem;font-weight:700;color:var(--red);margin-bottom:6px;">
          CORRECTIONS REQUIRED (Attempt #${1}) — Address all items before re-uploading:
        </div>
        <div class="corrections-list">${items}</div>
      </div>`;
  }

  function renderSubstepAction(subStage, workflow, userId) {
    switch (subStage) {

      case "slot_booking":
        return `
          <div class="action-box" id="slot-form-box">
            <div style="font-size:.8rem;font-weight:600;color:var(--blue);margin-bottom:10px;">
              🗓 Request a Presentation Slot
            </div>
            <div class="form-row">
              <div>
                <label>Preferred Date</label>
                <input type="date" id="pref-date" min="${new Date(Date.now()+86400000).toISOString().split('T')[0]}" />
              </div>
              <div>
                <label>Preferred Time</label>
                <select id="pref-time">
                  <option value="">Select time…</option>
                  <option>08:00 AM</option><option>09:00 AM</option>
                  <option>10:00 AM</option><option>11:00 AM</option>
                  <option>12:00 PM</option><option>02:00 PM</option>
                  <option>03:00 PM</option><option>04:00 PM</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div>
                <label>Venue</label>
                <select id="pref-venue">
                  <option value="">Select venue…</option>
                  <option>Seminar Room A</option><option>Seminar Room B</option>
                  <option>Conference Hall</option><option>Board Room</option>
                  <option>Online (MS Teams)</option>
                </select>
              </div>
              <div>
                <label>Additional Notes (optional)</label>
                <input type="text" id="pref-notes" placeholder="Any special requirements…" />
              </div>
            </div>
            <button class="btn btn-primary" id="btn-book-slot">📅 Submit Booking Request</button>
          </div>`;

      case "awaiting_panel":
        return `
          <div class="action-box warn">
            <div style="font-size:.8rem;font-weight:600;color:var(--amber);">⏳ Awaiting Panel Assignment</div>
            <div style="font-size:.73rem;color:var(--sub);margin-top:6px;">
              Your slot request has been submitted. The Director is assigning panel members and confirming your presentation date.
              You will be able to upload your concept note once the panel is scheduled.
            </div>
            ${workflow?.preferredDate ? `
              <div style="margin-top:10px;font-size:.73rem;color:var(--text);">
                <span style="color:var(--sub);">Your preferred date:</span>
                <strong>${workflow.preferredDate}</strong>
                at <strong>${workflow.preferredTime || "TBD"}</strong>
                — <strong>${workflow.venue || ""}</strong>
              </div>` : ""}
          </div>`;

      case "document_upload":
        return `
          <div class="action-box" id="upload-form-box">
            <div style="font-size:.8rem;font-weight:600;color:var(--purple);margin-bottom:4px;">
              📤 Upload Your Concept Note (PDF)
            </div>
            ${workflow?.panelScheduledDate ? `
              <div style="font-size:.73rem;color:var(--sub);margin-bottom:10px;">
                Panel scheduled:
                <strong style="color:var(--text)">${new Date(workflow.panelScheduledDate).toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</strong>
                ${workflow.panelMembers?.length ? `· Panel: <strong>${workflow.panelMembers.join(", ")}</strong>` : ""}
              </div>` : ""}
            <div class="form-row one">
              <div>
                <label>Select PDF (max 10MB)</label>
                <input type="file" id="cn-file" accept="application/pdf"
                  style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px;width:100%;color:var(--sub);font-size:.8rem;" />
              </div>
            </div>
            <button class="btn btn-upload" id="btn-upload-cn">🚀 Upload Concept Note</button>
            ${workflow?.panelDecision === "corrections"
              ? `<div style="margin-top:8px;font-size:.73rem;color:var(--amber);">⚠ Re-upload after addressing all corrections below.</div>`
              : ""}
          </div>`;

      case "panel_review":
        return `
          <div class="action-box success">
            <div style="font-size:.8rem;font-weight:600;color:var(--green);">🔎 Document Submitted — Under Panel Review</div>
            <div style="font-size:.73rem;color:var(--sub);margin-top:6px;">
              Your concept note has been uploaded and is now being reviewed by the panel.
              You will be notified of the outcome.
            </div>
            ${workflow?.uploadedFileName ? `
              <div style="margin-top:8px;font-size:.73rem;">
                📄 <a href="${workflow.uploadedFileUrl}" target="_blank"
                  style="color:var(--blue);text-decoration:underline;">${workflow.uploadedFileName}</a>
                uploaded ${workflow.uploadedAt ? new Date(workflow.uploadedAt).toLocaleDateString() : ""}
              </div>` : ""}
          </div>`;

      case "completed":
        return `
          <div class="action-box success">
            <div style="font-size:.8rem;font-weight:600;color:var(--green);">🏆 Concept Note Approved!</div>
            <div style="font-size:.73rem;color:var(--sub);margin-top:6px;">
              Your concept note has been approved by the panel.
              You are now advancing to the next stage.
            </div>
            ${workflow?.panelScore ? `
              <div style="margin-top:8px;font-size:.73rem;color:var(--text);">
                Final panel score: <strong style="color:var(--green)">${Math.round(workflow.panelScore)}%</strong>
              </div>` : ""}
          </div>`;

      default: return "";
    }
  }

  // ── RENDER: FULL PIPELINE ──────────────────────────────────────────────────
  function renderPipeline(currentStage, workflow) {
    const user = getUser();
    const userId = user?.id || user?._id;

    const stages = PIPELINE_STAGES.map(stage => {
      const cls = stageClass(stage.key, currentStage);
      const isConceptNote = CN_STAGES.includes(stage.key);
      const isActive = cls === "active";
      const isDone = cls === "completed";

      const dotIcon = isDone ? "✓" : stage.icon;

      const badge = isDone
        ? `<span class="p-badge badge-done">Complete</span>`
        : isActive
        ? `<span class="p-badge badge-active">Current</span>`
        : `<span class="p-badge badge-locked">Upcoming</span>`;

      const subStepsHtml = (isActive || isDone) && isConceptNote && workflow
        ? renderSubsteps(workflow, userId)
        : "";

      return `
        <div class="p-stage ${cls}">
          <div class="p-dot">${dotIcon}</div>
          <div class="p-card">
            <div class="p-label">${stage.key} ${badge}</div>
            <div class="p-desc">${stage.desc}</div>
            ${subStepsHtml}
          </div>
        </div>`;
    }).join("");

    document.getElementById("root").innerHTML = `
      <div class="pipeline">${stages}</div>`;

    wireActions(userId);
  }

  // ── WIRE DOM ACTIONS ───────────────────────────────────────────────────────
  function wireActions(userId) {

    // ── Book Slot ────────────────────────────────────────────────────────────
    const btnBook = document.getElementById("btn-book-slot");
    if (btnBook) {
      btnBook.addEventListener("click", async () => {
        const preferredDate = document.getElementById("pref-date")?.value;
        const preferredTime = document.getElementById("pref-time")?.value;
        const venue         = document.getElementById("pref-venue")?.value;
        const additionalNotes = document.getElementById("pref-notes")?.value || "";

        if (!preferredDate) return toast("Please select a preferred date.", "error");
        if (!preferredTime) return toast("Please select a preferred time.", "error");
        if (!venue)         return toast("Please select a venue.", "error");

        btnBook.disabled = true;
        btnBook.textContent = "⏳ Submitting…";

        try {
          const res = await fetch(`${API}/concept-note/${userId}/book-slot`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ preferredDate, preferredTime, venue, additionalNotes }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Request failed");

          toast("Slot request submitted! Awaiting panel scheduling.", "success");
          setTimeout(init, 1500); // Refresh
        } catch (err) {
          toast(err.message, "error");
          btnBook.disabled = false;
          btnBook.textContent = "📅 Submit Booking Request";
        }
      });
    }

    // ── Upload Concept Note ──────────────────────────────────────────────────
    const btnUpload = document.getElementById("btn-upload-cn");
    if (btnUpload) {
      btnUpload.addEventListener("click", async () => {
        const fileInput = document.getElementById("cn-file");
        const file = fileInput?.files?.[0];

        if (!file) return toast("Please select a PDF file to upload.", "error");
        if (file.type !== "application/pdf") return toast("Only PDF files are allowed.", "error");
        if (file.size > 10 * 1024 * 1024) return toast("File exceeds 10MB limit.", "error");

        btnUpload.disabled = true;
        btnUpload.textContent = "⏳ Uploading…";

        try {
          const formData = new FormData();
          formData.append("conceptNoteFile", file);

          const res = await fetch(`${API}/concept-note/${userId}/upload`, {
            method: "POST",
            credentials: "include",
            body: formData,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Upload failed");

          toast("Concept note uploaded! Panel is now reviewing.", "success");
          setTimeout(init, 1500);
        } catch (err) {
          toast(err.message, "error");
          btnUpload.disabled = false;
          btnUpload.textContent = "🚀 Upload Concept Note";
        }
      });
    }
  }

  // ── INIT ──────────────────────────────────────────────────────────────────
  async function init() {
    const user = getUser();
    if (!user) {
      document.getElementById("root").innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:var(--muted);">
          <div style="font-size:2rem;margin-bottom:12px;">🔒</div>
          <div>Please <a href="../login/login.html" style="color:var(--blue);">log in</a> to view your pipeline.</div>
        </div>`;
      return;
    }

    const userId = user.id || user._id;
    const currentStage = user.stage || user.stageName || "Coursework";

    // If at a Concept Note stage, fetch sub-stage data
    let workflow = null;
    if (CN_STAGES.includes(currentStage)) {
      try {
        const res = await fetch(`${API}/concept-note/${userId}/status`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          workflow = data.workflow;
        }
      } catch (err) {
        console.warn("Could not fetch concept note status:", err);
      }
    }

    renderPipeline(currentStage, workflow);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
