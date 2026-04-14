(function () {
  const api = window.StudentApi;
  const appBody = document.body;
  const mainStatusPill = document.getElementById("mainStatusPill");
  const gridStatusPill = document.getElementById("gridStatusPill");
  const actionBtn = document.getElementById("mainActionBtn");
  const sup3Container = document.getElementById("sup3Container");
  const progDisplay = document.getElementById("progDisplay");
  const bannerProgDisplay = document.getElementById("bannerProgDisplay");
  const demoTools = document.getElementById("demoTools");
  const editBtn = document.getElementById("editBtn");

  if (demoTools) demoTools.style.display = "none";
  if (editBtn) editBtn.style.display = "none";

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  function openModal(modalId) {
    document.getElementById(modalId)?.classList.add("active");
  }

  function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove("active");
    const form = document.querySelector(`#${modalId} form`);
    if (form) form.reset();
  }

  window.openModal = openModal;
  window.closeModal = closeModal;

  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) closeModal(overlay.id);
    });
  });

  function renderStatus(student) {
    const requestType = student.deferralRequest?.type || "";
    const requestStatus = student.deferralRequest?.status || "";
    const isDeferred = student.status === "Deferred";
    const isPending = requestStatus === "pending";

    appBody.classList.remove("state-active", "state-pending", "state-deferred");
    actionBtn.className = "btn-action";
    actionBtn.disabled = false;
    actionBtn.onclick = null;

    if (isDeferred) {
      appBody.classList.add("state-deferred");
      mainStatusPill.textContent = "DEFERRED";
      gridStatusPill.textContent = "DEFERRED";
      actionBtn.classList.add("btn-green");
      actionBtn.disabled = false;
      actionBtn.innerHTML = "Return to Studies";
      actionBtn.onclick = submitResumptionRequest;
      return;
    }

    if (isPending) {
      appBody.classList.add("state-pending");
      const pendingLabel =
        requestType === "resumption" ? "RESUMPTION PENDING" : "DEFERRAL PENDING";
      mainStatusPill.textContent = pendingLabel;
      gridStatusPill.textContent = pendingLabel;
      actionBtn.classList.add("btn-disabled");
      actionBtn.disabled = true;
      actionBtn.innerHTML = '<i class="fas fa-hourglass-half"></i> Pending Director Review';
      return;
    }

    appBody.classList.add("state-active");
    mainStatusPill.textContent = student.status || "ACTIVE";
    gridStatusPill.textContent = student.status || "ACTIVE";
    actionBtn.classList.add("btn-red");
    actionBtn.innerHTML = "Request Deferral";
    actionBtn.onclick = () => openModal("deferralModal");
  }

  function renderProfile(student) {
    const programme = String(student.programme || "").toLowerCase();
    const supervisors = student.supervisors || {};
    const assignmentStatus = student.assignmentStatus || {};
    const isPhd = programme === "phd";

    setText("studentNameHeading", student.fullName || "-");
    setText("studentNameValue", student.fullName || "-");
    setText("studentRegValue", student.userNumber || "-");
    setText("studentDepartmentValue", String(student.department || "-").toUpperCase());
    setText("progDisplay", isPhd ? "PhD" : "Masters");
    setText("studentYearValue", student.year || "Not set");
    setText("mentorValue", student.mentor || "Pending Allocation");

    const regMeta = document.getElementById("studentRegMeta");
    if (regMeta) regMeta.innerHTML = `<i class="fas fa-id-card"></i> Reg: ${student.userNumber || "-"}`;

    const deptMeta = document.getElementById("studentDeptMeta");
    if (deptMeta) deptMeta.innerHTML = `<i class="fas fa-university"></i> ${String(student.department || "-").toUpperCase()}`;

    bannerProgDisplay.innerHTML = `<i class="fas fa-graduation-cap"></i> ${programme || "masters"}`;

    setText("supervisor1Value", supervisors.sup1 || "Pending Allocation");
    setText("supervisor2Value", supervisors.sup2 || "Pending Allocation");
    setText("supervisor3Value", supervisors.sup3 || "Pending Allocation");
    setText("supervisor1StatusValue", String(assignmentStatus.sup1 || "pending").toUpperCase());
    setText("supervisor2StatusValue", String(assignmentStatus.sup2 || "pending").toUpperCase());
    setText("mentorshipStatusValue", String(student.documents?.mentorship || "pending").toUpperCase());
    sup3Container.style.display = isPhd ? "block" : "none";

    if (student.deferralInfo?.plannedResumption && student.status === "Deferred") {
      const note = document.createElement("div");
      note.className = "info-banner";
      note.style.marginTop = "20px";
      note.innerHTML = `
        <i class="fas fa-info-circle"></i>
        <div class="info-content">
          <h4>Deferral Approved</h4>
          <p>Your studies are paused until the director records your return. Planned resumption: <strong>${student.deferralInfo.plannedResumption}</strong>.</p>
        </div>
      `;
      const contentArea = document.querySelector(".content-area");
      const existing = document.getElementById("deferralApprovedBanner");
      if (!existing && contentArea) {
        note.id = "deferralApprovedBanner";
        contentArea.prepend(note);
      }
    }

    renderStatus(student);
  }

  async function submitResumptionRequest() {
    try {
      actionBtn.disabled = true;
      actionBtn.innerHTML = '<i class="fas fa-hourglass-half"></i> Submitting...';
      await api.submitResumptionRequest();
      await loadProfile();
    } catch (error) {
      alert(error.message || "Failed to submit resumption request");
      actionBtn.disabled = false;
      actionBtn.innerHTML = "Return to Studies";
    }
  }

  async function loadProfile() {
    try {
      const session = await api.getSession();
      const student = session?.user;
      if (!student) throw new Error("Student session not found");

      const dateEl = document.getElementById("currentDate");
      if (dateEl) dateEl.textContent = new Date().toISOString().split("T")[0];

      renderProfile(student);
    } catch (error) {
      alert(error.message || "Failed to load student profile");
    }
  }

  document.getElementById("deferralForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await api.submitDeferralRequest({
        reason: document.getElementById("deferralReason").value,
        plannedResumption: document.getElementById("deferralResumptionDate").value,
      });
      closeModal("deferralModal");
      await loadProfile();
    } catch (error) {
      alert(error.message || "Failed to submit deferral request");
    }
  });

  document.getElementById("resumptionForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api.submitResumptionRequest();
      closeModal("resumptionModal");
      await loadProfile();
    } catch (error) {
      alert(error.message || "Failed to submit resumption request");
    }
  });

  loadProfile();
})();
