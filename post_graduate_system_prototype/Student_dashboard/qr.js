(function () {
  const api = window.StudentApi;

  const state = {
    session: null,
    reports: [],
    nextQuarter: 1,
  };

  const chainContainer = document.getElementById("approvalChainContainer");
  const commentsListContainer = document.getElementById("commentsListContainer");
  const approvalCard = document.getElementById("approvalCard");
  const reportStatusPill = document.getElementById("reportStatusPill");
  const submitBtn = document.getElementById("submitReportBtn");
  const formControls = document.querySelectorAll(".form-control");
  const deferralAlert = document.getElementById("deferralAlert");
  const financeAlert = document.getElementById("financeAlert");
  const activeReportCard = document.getElementById("activeReportCard");
  const reportTitleDisplay = document.getElementById("reportTitleDisplay");
  const reportSubtitleDisplay = document.getElementById("reportSubtitleDisplay");
  const quarterProgressFill = document.getElementById("quarterProgressFill");
  const quarterMarkers = document.getElementById("quarterMarkers");
  const historyTableBody = document.getElementById("historyTableBody");
  const demoTools = document.querySelector(".demo-tools");
  const sidebarProgTag = document.getElementById("sidebarProgTag");

  const fieldIds = ["f1", "f2", "f3", "f4"];

  function currentProgramme() {
    return String(state.session?.programme || "masters").toLowerCase();
  }

  function totalQuarters() {
    return currentProgramme() === "phd" ? 6 : 4;
  }

  function currentQuarter() {
    const active = getActiveReport();
    return active ? Number(active.quarter || 1) : Number(state.nextQuarter || 1);
  }

  function getActiveReport() {
    return (
      [...state.reports]
        .sort((a, b) => {
          if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
          return (b.quarter || 0) - (a.quarter || 0);
        })
        .find((report) => report.status !== "approved") || null
    );
  }

  function isDeferred() {
    return String(state.session?.status || "").toLowerCase() === "deferred";
  }

  function requiredSupervisorSteps() {
    const steps = [
      { key: "sup1", label: "Supervisor 1" },
      { key: "sup2", label: "Supervisor 2" },
    ];
    if (currentProgramme() === "phd" && state.session?.supervisors?.sup3) {
      steps.push({ key: "sup3", label: "Supervisor 3" });
    }
    return steps;
  }

  function approvalSteps(report) {
    const approvals = report?.approvals || {};
    return [
      ...requiredSupervisorSteps().map((step) => ({
        label: step.label,
        status: approvals[step.key] || "pending",
      })),
      {
        label: "PG Dean",
        status: approvals.dean || "pending",
      },
    ];
  }

  function setQuarterTracker() {
    const quarter = currentQuarter();
    const total = totalQuarters();
    const clampedQuarter = Math.max(1, Math.min(quarter, total));

    reportTitleDisplay.innerText = `Q${clampedQuarter} Progress Report`;
    reportSubtitleDisplay.innerText = `Report ${clampedQuarter} of ${total} Required in Research Phase`;
    quarterProgressFill.style.width = `${(clampedQuarter / total) * 100}%`;

    let markersHtml = "";
    for (let i = 1; i <= total; i += 1) {
      const color = i <= clampedQuarter ? "var(--primary-blue)" : "var(--text-muted)";
      markersHtml += `<span style="color: ${color};">Q${i}</span>`;
    }
    quarterMarkers.innerHTML = markersHtml;
  }

  function renderChain() {
    const report = getActiveReport();
    if (!report) {
      chainContainer.innerHTML = "";
      return;
    }

    const html = approvalSteps(report)
      .map((step) => {
        const normalized = String(step.status || "pending").toLowerCase();
        let nodeClass = "";
        let iconHtml = '<i class="fas fa-clock"></i>';

        if (normalized === "approved") {
          nodeClass = "completed";
          iconHtml = '<i class="fas fa-check"></i>';
        } else if (normalized === "returned" || normalized === "rejected") {
          nodeClass = "error";
          iconHtml = '<i class="fas fa-times"></i>';
        } else {
          const priorApproved = approvalSteps(report)
            .slice(0, approvalSteps(report).findIndex((s) => s.label === step.label))
            .every((s) => String(s.status || "").toLowerCase() === "approved");
          if (priorApproved && report.status !== "approved") {
            nodeClass = "active";
            iconHtml = '<i class="fas fa-pen-nib"></i>';
          }
        }

        return `
          <div class="chain-node ${nodeClass}">
            <div class="node-icon">${iconHtml}</div>
            <div class="node-label">${step.label}</div>
          </div>
        `;
      })
      .join("");

    chainContainer.innerHTML = html;
  }

  function renderComments() {
    const report = getActiveReport();
    const trail = report?.reviewTrail || [];
    if (!trail.length) {
      commentsListContainer.innerHTML =
        '<div class="empty-log">No comments or feedback recorded yet.</div>';
      return;
    }

    commentsListContainer.innerHTML = [...trail]
      .reverse()
      .map((entry) => {
        const action = String(entry.action || "").toLowerCase();
        const badgeClass = action.includes("approved") ? "cb-approved" : "cb-returned";
        const textClass = action.includes("returned") ? "returned" : "";
        const initials = String(entry.actor || entry.role || "?")
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part.charAt(0).toUpperCase())
          .join("");
        const when = entry.at ? new Date(entry.at).toLocaleString() : "Just now";

        return `
          <div class="comment-item">
            <div class="comment-avatar">${initials || "NA"}</div>
            <div class="comment-body">
              <div class="comment-header">
                <div class="comment-name">
                  ${entry.actor || entry.role}
                  <span class="comment-badge ${badgeClass}">${entry.action}</span>
                </div>
                <div class="comment-time">${when}</div>
              </div>
              <div class="comment-text ${textClass}">"${entry.comment || "No comment provided."}"</div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  function renderHistory() {
    if (!state.reports.length) {
      historyTableBody.innerHTML =
        '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); font-style:italic;">No quarterly reports submitted yet.</td></tr>';
      return;
    }

    historyTableBody.innerHTML = [...state.reports]
      .sort((a, b) => {
        if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
        return (b.quarter || 0) - (a.quarter || 0);
      })
      .map((report) => {
        const statusClass =
          report.status === "approved"
            ? "pill-approved"
            : report.status === "returned"
              ? "pill-returned"
              : "pill-pending";
        const approvers = approvalSteps(report)
          .map((step) => `${step.label}: ${String(step.status || "pending").toUpperCase()}`)
          .join("<br>");

        return `
          <tr>
            <td><strong>Q${report.quarter} Report</strong></td>
            <td>${new Date(report.submittedAt).toLocaleDateString()}</td>
            <td><span class="status-pill ${statusClass}">${String(report.status || "").replace("_", " ").toUpperCase()}</span></td>
            <td>${approvers}</td>
            <td><button class="btn-text" data-report-view="${report.id}">View</button></td>
          </tr>
        `;
      })
      .join("");
  }

  function fillForm(report) {
    document.getElementById("f1").value = report?.progressSummary || "";
    document.getElementById("f2").value = report?.objectivesAchieved || "";
    document.getElementById("f3").value = report?.challengesAndMitigation || "";
    document.getElementById("f4").value = report?.nextQuarterPlan || "";
  }

  function setFormDisabled(disabled) {
    formControls.forEach((control) => {
      control.disabled = disabled;
    });
  }

  function updateFormUI() {
    setQuarterTracker();

    if (sidebarProgTag) {
      sidebarProgTag.innerText = currentProgramme() === "phd" ? "PhD Candidate" : "Masters Student";
    }
    if (demoTools) demoTools.style.display = "none";

    financeAlert.classList.remove("active");

    if (isDeferred()) {
      deferralAlert.classList.add("active");
      approvalCard.style.display = "none";
      activeReportCard.style.opacity = "0.5";
      activeReportCard.style.pointerEvents = "none";
      reportStatusPill.className = "status-pill pill-returned";
      reportStatusPill.innerText = "DEFERRED";
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-pause"></i> Quarterly Reporting Paused';
      setFormDisabled(true);
      return;
    }

    deferralAlert.classList.remove("active");
    activeReportCard.style.opacity = "1";
    activeReportCard.style.pointerEvents = "auto";

    const activeReport = getActiveReport();
    fillForm(activeReport);

    if (!activeReport) {
      approvalCard.style.display = "none";
      reportStatusPill.className = "status-pill pill-draft";
      reportStatusPill.innerText = "DRAFT";
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit to Supervisor 1';
      setFormDisabled(false);
      return;
    }

    approvalCard.style.display = "block";
    renderChain();
    renderComments();

    if (activeReport.status === "returned") {
      reportStatusPill.className = "status-pill pill-returned";
      reportStatusPill.innerText = "RETURNED";
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update & Resubmit';
      setFormDisabled(false);
      return;
    }

    if (activeReport.status === "approved") {
      reportStatusPill.className = "status-pill pill-approved";
      reportStatusPill.innerText = "APPROVED";
      submitBtn.disabled = true;
      submitBtn.style.display = "none";
      setFormDisabled(true);
      return;
    }

    submitBtn.style.display = "inline-flex";
    reportStatusPill.className = "status-pill pill-pending";
    reportStatusPill.innerText = activeReport.status === "pending_dean" ? "AWAITING DEAN" : "IN REVIEW";
    submitBtn.disabled = true;
    const nextStep = approvalSteps(activeReport).find(
      (step) => String(step.status || "").toLowerCase() !== "approved",
    );
    submitBtn.innerHTML = `<i class="fas fa-hourglass-half"></i> Awaiting ${nextStep ? nextStep.label : "Review"}`;
    setFormDisabled(true);
  }

  async function loadData() {
    const [sessionResponse, reportsResponse] = await Promise.all([
      api.getSession(),
      api.getQuarterlyReports(),
    ]);

    state.session = sessionResponse.user || {};
    state.reports = reportsResponse.reports || [];
    state.nextQuarter = reportsResponse.nextQuarter || 1;
  }

  async function refresh() {
    await loadData();
    renderHistory();
    updateFormUI();
  }

  function currentPayload() {
    return {
      quarter: currentQuarter(),
      year: new Date().getFullYear(),
      progressSummary: document.getElementById("f1").value.trim(),
      objectivesAchieved: document.getElementById("f2").value.trim(),
      challengesAndMitigation: document.getElementById("f3").value.trim(),
      nextQuarterPlan: document.getElementById("f4").value.trim(),
    };
  }

  document.getElementById("reportForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
      await api.submitQuarterlyReport(currentPayload());
      await refresh();
    } catch (error) {
      alert(error.message || "Failed to submit quarterly report");
      updateFormUI();
    }
  });

  historyTableBody.addEventListener("click", (event) => {
    const button = event.target.closest("[data-report-view]");
    if (!button) return;

    const report = state.reports.find((entry) => entry.id === button.dataset.reportView);
    if (!report) return;

    fillForm(report);
    commentsListContainer.innerHTML = "";
    approvalCard.style.display = "block";
    chainContainer.innerHTML = "";
    const currentActive = getActiveReport();
    const restoreId = currentActive?.id || null;
    const tempReports = state.reports;
    state.reports = [report];
    renderChain();
    renderComments();
    state.reports = tempReports;
    if (restoreId && restoreId !== report.id) {
      renderChain();
      renderComments();
    }
  });

  refresh().catch((error) => {
    console.error(error);
    alert(error.message || "Failed to load quarterly report data");
  });
})();
