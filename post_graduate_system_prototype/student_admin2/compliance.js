(function () {
  const api = window.StudentApi;
  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  const tableBody = document.getElementById("complianceTableBody");
  const warningBanner = document.getElementById("erpWarningBanner");
  const erpPill = document.getElementById("erpStatusPill");
  const feedback = document.getElementById("complianceFeedback");
  const intentDateInput = document.getElementById("intentDate");
  const intentDeclarationInput = document.getElementById("intentDeclaration");
  const intentBadge = document.getElementById("badgeIntent");
  const intentTrackingArea = document.getElementById("intentTrackingArea");
  const intentSubmitButton = document.getElementById("btnSubmitIntent");

  const docConfig = {
    Proposal: {
      type: "Final Approved Proposal",
      badgeId: "badgeProposal",
      boxId: "boxProposal",
      inputId: "inputProposal",
      displayId: "displayProposal",
      nameId: "nameProposal",
      metaId: "metaProposal",
    },
    Nacosti: {
      type: "NACOSTI Research License",
      badgeId: "badgeNacosti",
      boxId: "boxNacosti",
      inputId: "inputNacosti",
      displayId: "displayNacosti",
      nameId: "nameNacosti",
      metaId: "metaNacosti",
    },
    Other: {
      type: "Other Related Compliance Document",
      badgeId: "badgeOther",
      boxId: "boxOther",
      inputId: "inputOther",
      displayId: "displayOther",
      nameId: "nameOther",
      metaId: "metaOther",
    },
  };

  let isDeferred = false;
  let submittingDocKey = "";
  let currentUploads = [];
  let currentSession = null;
  const selectedFiles = {
    Proposal: null,
    Nacosti: null,
    Other: null,
  };

  function showFeedback(message, tone) {
    if (!feedback) return;
    feedback.className = `action-feedback show ${tone || "info"}`;
    feedback.textContent = message;
  }

  function clearFeedback() {
    if (!feedback) return;
    feedback.className = "action-feedback";
    feedback.textContent = "";
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  function setBadge(docKey, uploaded) {
    const badge = document.getElementById(docConfig[docKey].badgeId);
    if (!badge) return;
    badge.className = uploaded
      ? "status-badge badge-approved"
      : "status-badge badge-missing";
    badge.textContent = uploaded ? "Submitted" : "Pending Upload";
  }

  function setPendingBadge(docKey) {
    const badge = document.getElementById(docConfig[docKey].badgeId);
    if (!badge) return;
    badge.className = "status-badge badge-review";
    badge.textContent = "Ready To Submit";
  }

  function setSubmitButtonState(docKey, enabled, loading) {
    const button = document.getElementById(`submit${docKey}`);
    if (!button) return;
    button.disabled = !enabled || isDeferred || !!loading;
    button.innerHTML = loading
      ? '<i class="fas fa-spinner fa-spin"></i> Submitting...'
      : '<i class="fas fa-paper-plane"></i> Submit Document';
  }

  function setCardState(docKey, upload) {
    const cfg = docConfig[docKey];
    const box = document.getElementById(cfg.boxId);
    const input = document.getElementById(cfg.inputId);
    const display = document.getElementById(cfg.displayId);
    const name = document.getElementById(cfg.nameId);
    const meta = document.getElementById(cfg.metaId);
    const isLoading = submittingDocKey === docKey;
    const selectedFile = selectedFiles[docKey];

    if (box) box.classList.toggle("disabled", isDeferred);
    if (box) box.classList.toggle("is-loading", isLoading);
    if (input) input.disabled = isDeferred;

    if (selectedFile) {
      if (box) box.style.display = "none";
      if (display) display.style.display = "flex";
      if (name) name.textContent = selectedFile.name;
      if (meta) meta.textContent = isLoading ? "Uploading document..." : "Selected file ready for submission";
      setPendingBadge(docKey);
      setSubmitButtonState(docKey, true, isLoading);
      return;
    }

    if (!upload) {
      if (box) box.style.display = "block";
      if (display) display.style.display = "none";
      setBadge(docKey, false);
      setSubmitButtonState(docKey, false, false);
      return;
    }

    if (box) box.style.display = "none";
    if (display) display.style.display = "flex";
    if (name) name.textContent = upload.title || cfg.type;
    if (meta) meta.textContent = `Submitted ${formatDateTime(upload.submittedAt)}`;
    setBadge(docKey, true);
    setSubmitButtonState(docKey, false, false);
  }

  function renderHistory(uploads) {
    if (!tableBody) return;
    if (!uploads.length) {
      tableBody.innerHTML =
        '<tr><td colspan="4" class="empty-row">No compliance submissions yet.</td></tr>';
      return;
    }

    const normalizeHistoryType = (upload) => {
      const rawType = String(upload?.type || "").toLowerCase();
      if (rawType.includes("proposal")) return docConfig.Proposal.type;
      if (rawType.includes("nacosti")) return docConfig.Nacosti.type;
      if (rawType.includes("other")) return docConfig.Other.type;
      return upload?.type || "-";
    };

    tableBody.innerHTML = uploads
      .map((upload) => {
        const openLink = upload.url
          ? `<a class="history-link" href="${upload.url}" target="_blank" rel="noopener">Open</a>`
          : '<span style="color: var(--text-muted)">No link</span>';

        return `
          <tr>
            <td>${normalizeHistoryType(upload)}</td>
            <td>${upload.title || "-"}</td>
            <td>${openLink}</td>
            <td>${formatDateTime(upload.submittedAt)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function latestUploadForType(uploads, type) {
    return uploads.find((item) => item.type === type) || null;
  }

  function populateIntentDetails(session, intent) {
    const safeSession = session || {};
    const safeIntent = intent || {};
    const supervisors = [
      safeIntent.supervisorName,
      safeIntent.coSupervisorName,
      safeSession.supervisors?.sup1,
      safeSession.supervisors?.sup2,
      safeSession.supervisors?.sup3,
      safeSession.supervisor,
    ].filter(Boolean);

    const setText = (id, value, fallback = "Not available") => {
      const el = document.getElementById(id);
      if (el) el.textContent = value || fallback;
    };

    setText("intentCandidateName", safeSession.fullName, "Student");
    setText("intentRegistrationNo", safeSession.userNumber, "-");
    setText("intentDegreeDisplay", safeSession.programme || safeSession.program, "-");
    setText("intentDepartmentDisplay", safeSession.department, "-");
    setText("intentThesisTitleDisplay", safeIntent.thesisTitle, "Awaiting saved thesis intent");
    setText(
      "intentSupervisorsDisplay",
      supervisors.length ? [...new Set(supervisors)].join(", ") : "",
      "Pending allocation",
    );

    if (document.body) {
      document.body.dataset.sidebarTag = safeSession.userNumber || "Student";
    }

    if (intentDateInput) {
      intentDateInput.value = safeIntent.targetSubmissionDate || "";
    }

    if (intentDeclarationInput) {
      intentDeclarationInput.checked = safeIntent.status === "submitted";
    }

    if (intentBadge) {
      const submitted = safeIntent.status === "submitted";
      intentBadge.className = submitted ? "status-badge badge-approved" : "status-badge badge-missing";
      intentBadge.textContent = submitted ? "Submitted" : "Not Submitted";
    }

    if (intentTrackingArea) {
      intentTrackingArea.style.display = safeIntent.status === "submitted" ? "block" : "none";
    }
  }

  function renderAll(uploads, status) {
    currentUploads = Array.isArray(uploads) ? uploads.slice() : [];
    currentUploads.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

    applyDeferredState(String(status || "").toLowerCase() === "deferred");
    setCardState("Proposal", latestUploadForType(currentUploads, docConfig.Proposal.type));
    setCardState("Nacosti", latestUploadForType(currentUploads, docConfig.Nacosti.type));
    setCardState("Other", latestUploadForType(currentUploads, docConfig.Other.type));
    renderHistory(currentUploads);
  }

  function applyDeferredState(deferred) {
    isDeferred = deferred;

    if (warningBanner) {
      warningBanner.style.display = deferred ? "flex" : "none";
    }

    if (erpPill) {
      erpPill.innerHTML = deferred
        ? '<i class="fas fa-pause-circle" style="color: white"></i> Compliance: Paused'
        : '<i class="fas fa-check-circle" style="color: #1abc9c"></i> ERP: Cleared';
      erpPill.style.backgroundColor = deferred
        ? "var(--status-missing-text)"
        : "var(--primary-blue)";
    }
  }

  async function load() {
    if (!api || typeof api.getComplianceUploads !== "function") {
      throw new Error("Compliance API is unavailable on this page.");
    }
    const [sessionData, data, intentData] = await Promise.all([
      typeof api.getSession === "function" ? api.getSession() : Promise.resolve(null),
      api.getComplianceUploads(),
      typeof api.getThesisIntent === "function"
        ? api.getThesisIntent().catch(() => null)
        : Promise.resolve(null),
    ]);
    currentSession = sessionData?.user || null;
    renderAll(data?.uploads || [], data?.status || "");
    populateIntentDetails(currentSession, intentData?.intent || null);
  }

  async function submitFile(docKey, file) {
    if (!file) return;
    if (submittingDocKey) return;
    if (isDeferred) {
      showFeedback("Compliance submissions are paused while the student is deferred.", "error");
      return;
    }
    if (!api || typeof api.submitComplianceUpload !== "function") {
      showFeedback("Compliance upload service is unavailable right now.", "error");
      return;
    }

    submittingDocKey = docKey;
    setCardState(docKey, null);
    showFeedback(`Uploading ${file.name}...`, "info");

    const formData = new FormData();
    formData.append("type", docConfig[docKey].type);
    formData.append("note", `Submitted from Compliance Center on ${new Date().toLocaleString()}`);
    formData.append("documentFile", file);

    try {
      const response = await api.submitComplianceUpload(formData);
      submittingDocKey = "";
      selectedFiles[docKey] = null;
      renderAll(response?.uploads || currentUploads, response?.status || (isDeferred ? "deferred" : "active"));
      showFeedback(`${docConfig[docKey].type} submitted successfully.`, "success");
    } catch (error) {
      submittingDocKey = "";
      renderAll(currentUploads, isDeferred ? "deferred" : "active");
      throw error;
    }
  }

  async function submitIntent() {
    if (isDeferred) {
      showFeedback("Intent submission is paused while the student is deferred.", "error");
      return;
    }

    if (!api || typeof api.submitThesisIntent !== "function") {
      showFeedback("Intent submission service is unavailable right now.", "error");
      return;
    }

    const targetSubmissionDate = intentDateInput?.value || "";
    const declarationChecked = !!intentDeclarationInput?.checked;
    const thesisTitle =
      document.getElementById("intentThesisTitleDisplay")?.textContent?.trim() || "";

    if (!targetSubmissionDate) {
      showFeedback("Please select your expected submission date.", "error");
      return;
    }

    if (!declarationChecked) {
      showFeedback("Please confirm the declaration before submitting.", "error");
      return;
    }

    if (!thesisTitle || thesisTitle === "Awaiting saved thesis intent") {
      showFeedback("Please complete your thesis intent details first so the approved title is available.", "error");
      return;
    }

    try {
      if (intentSubmitButton) {
        intentSubmitButton.disabled = true;
        intentSubmitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
      }

      const response = await api.submitThesisIntent({
        thesisTitle,
        submissionCategory: "Intent Notice",
        targetSubmissionDate,
        supervisorName: document.getElementById("intentSupervisorsDisplay")?.textContent?.trim() || "",
        notes: "Submitted from Compliance Center declaration form",
        email: currentSession?.email || "",
      });

      populateIntentDetails(currentSession, response?.intent || null);
      showFeedback("Notice of intent submitted successfully.", "success");
    } catch (error) {
      showFeedback(error.message || "Failed to submit notice of intent.", "error");
    } finally {
      if (intentSubmitButton) {
        intentSubmitButton.disabled = false;
        intentSubmitButton.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Notice of Intent';
      }
    }
  }

  function triggerInput(docKey) {
    if (isDeferred) {
      showFeedback("Compliance submissions are paused while the student is deferred.", "error");
      return;
    }
  }

  async function handleFileSelect(event, docKey) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const isPdf =
      String(file.type || "").toLowerCase() === "application/pdf" ||
      String(file.name || "").toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      showFeedback("Only PDF documents are allowed.", "error");
      if (event?.target) {
        event.target.value = "";
      }
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      showFeedback("File too large. Maximum size is 5MB.", "error");
      if (event?.target) {
        event.target.value = "";
      }
      return;
    }

    clearFeedback();
    selectedFiles[docKey] = file;
    setCardState(docKey, null);
    showFeedback(`${file.name} selected. Click Submit Document to upload it.`, "info");
    if (event?.target) {
      event.target.value = "";
    }
  }

  function removeFile(docKey) {
    const input = document.getElementById(docConfig[docKey]?.inputId || "");
    if (input) input.value = "";
    selectedFiles[docKey] = null;
    setCardState(docKey, null);
  }

  async function submitSelectedDocument(docKey) {
    const file = selectedFiles[docKey];
    if (!file) {
      showFeedback("Choose a file first before submitting.", "error");
      return;
    }

    try {
      await submitFile(docKey, file);
    } catch (error) {
      showFeedback(error.message || "Failed to submit compliance document.", "error");
    }
  }

  Object.keys(docConfig).forEach((docKey) => {
    const uploadBox = document.querySelector(`[data-upload-doc="${docKey}"]`);
    const input = document.getElementById(docConfig[docKey].inputId);
    const removeButton = document.querySelector(`[data-remove-doc="${docKey}"]`);
    const submitButton = document.querySelector(`[data-submit-doc="${docKey}"]`);

    uploadBox?.addEventListener("click", (event) => {
      clearFeedback();
      triggerInput(docKey);
      if (isDeferred || submittingDocKey) return;
      if (event.target === input) return;
      input?.click();
    });

    input?.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    input?.addEventListener("change", (event) => {
      handleFileSelect(event, docKey);
    });

    removeButton?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeFile(docKey);
    });

    submitButton?.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await submitSelectedDocument(docKey);
    });
  });

  load().catch((error) => {
    console.error("Failed to load compliance data:", error);
    showFeedback("Failed to load compliance history.", "error");
    if (tableBody) {
      tableBody.innerHTML =
        '<tr><td colspan="4" class="empty-row">Failed to load compliance history.</td></tr>';
    }
  });

  window.submitIntent = submitIntent;
})();
