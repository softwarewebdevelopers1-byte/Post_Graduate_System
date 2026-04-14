(function () {
  const api = window.StudentApi;

  const state = {
    user: null,
    slots: [],
    bookings: [],
    selectedSlotId: null,
  };

  const ACTIVE_BOOKING_STATUSES = ["pending"];

  function $(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeDepartment(value) {
    const normalized = String(value || "").trim().toUpperCase();
    if (normalized === "CJM") return "CMJ";
    return normalized;
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function formatShortDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getSlotTime(slot) {
    if (!slot) return "-";
    if (slot.startTime && slot.endTime) {
      return `${slot.startTime} - ${slot.endTime}`;
    }
    return "-";
  }

  function getSlotType(slot) {
    if (!slot) return "Select a slot";
    return `${slot.level || "Seminar"} Seminar`;
  }

  function getActiveBooking() {
    return state.bookings.find((booking) =>
      ACTIVE_BOOKING_STATUSES.includes(String(booking.status || "").toLowerCase()),
    );
  }

  function getResearchTopicInput() {
    return $("researchTopicInput");
  }

  function getResearchTopicValue() {
    return getResearchTopicInput()?.value.trim() || "";
  }

  function getSelectedSlot() {
    return state.slots.find((slot) => slot._id === state.selectedSlotId) || null;
  }

  function studentDepartment() {
    return normalizeDepartment(state.user?.department);
  }

  function renderSupervisors() {
    const container = $("supervisorInputsContainer");
    if (!container) return;

    const supervisors = state.user?.supervisors || {};
    const names = [supervisors.sup1, supervisors.sup2, supervisors.sup3].filter(Boolean);

    $("supervisorCountLabel").textContent = `(${names.length || 1} Assigned)`;

    container.innerHTML = (names.length ? names : ["Pending Allocation"])
      .map(
        (name) =>
          `<input type="text" class="form-input-text supervisor-input" value="${escapeHtml(
            name,
          )}" readonly style="background-color: #f1f2f6; color: #7f8c8d; cursor: not-allowed; border-color: #dfe4ea; font-weight: 500; margin-bottom: 8px;">`,
      )
      .join("");
  }

  function setContext() {
    $("currentDateDisplay").textContent = new Date().toISOString().split("T")[0];

    const department = studentDepartment() || "STUDENT";
    const sidebarDeptTag = $("sidebarDeptTag");
    if (sidebarDeptTag) sidebarDeptTag.textContent = `${department} Department`;

    const notificationTarget = $("notificationTarget");
    if (notificationTarget) notificationTarget.textContent = "Director, School of Postgraduate Studies";

    renderSupervisors();
  }

  function renderFormDetails() {
    const selectedSlot = getSelectedSlot();
    $("formDateDisplay").textContent = selectedSlot
      ? formatDate(selectedSlot.date)
      : "Select a slot...";
    $("formTypeDisplay").textContent = selectedSlot
      ? getSlotType(selectedSlot)
      : (state.user?.stage || "Seminar Request");
  }

  function applyRequestState() {
    const requestForm = $("requestForm");
    const successOverlay = $("successOverlay");
    const slotsContainer = $("slotsContainer");
    const confirmButton = $("confirmBookingBtn");
    const researchTopicInput = getResearchTopicInput();
    const activeBooking = getActiveBooking();
    const isDeferred = String(state.user?.status || "").toLowerCase() === "deferred";
    const hasTopic = Boolean(getResearchTopicValue());

    if (confirmButton) {
      confirmButton.disabled =
        !getSelectedSlot() || !hasTopic || Boolean(activeBooking) || isDeferred;
    }

    if (researchTopicInput) {
      researchTopicInput.disabled = Boolean(activeBooking) || isDeferred;
    }

    if (isDeferred) {
      requestForm.style.display = "none";
      successOverlay.classList.add("active");
      successOverlay.innerHTML = `
        <i class="fas fa-pause-circle"></i>
        <h4>Bookings Paused</h4>
        <p>Your student actions are paused while your deferral is active.</p>
      `;
      slotsContainer.style.opacity = "0.6";
      slotsContainer.style.pointerEvents = "none";
      return;
    }

    if (activeBooking) {
      requestForm.style.display = "none";
      successOverlay.classList.add("active");
      successOverlay.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <h4>Pending Booking Request</h4>
        <p>Your current booking for <strong>${escapeHtml(
          formatDate(activeBooking.preferredDate),
        )}</strong> is still being processed.</p>
        <div style="text-align: left; background: white; padding: 15px; border-radius: 8px; width: 100%; margin-top: 10px; border: 1px solid #bdc3c7;">
          <span style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase;">Current Status</span>
          <p style="margin-top: 8px; font-size: 13px; color: var(--text-main);">${escapeHtml(
            String(activeBooking.status || "").toUpperCase(),
          )} · ${escapeHtml(activeBooking.preferredTime || "-")} · ${escapeHtml(
            activeBooking.venue || "-",
          )}</p>
          ${
            activeBooking.additionalNotes
              ? `<p style="margin-top: 8px; font-size: 13px; color: var(--text-main);"><strong>Research Topic:</strong> ${escapeHtml(activeBooking.additionalNotes)}</p>`
              : ""
          }
        </div>
      `;
      slotsContainer.style.opacity = "0.6";
      slotsContainer.style.pointerEvents = "none";
      return;
    }

    requestForm.style.display = "block";
    successOverlay.classList.remove("active");
    slotsContainer.style.opacity = "1";
    slotsContainer.style.pointerEvents = "auto";
  }

  function renderSlots() {
    const container = $("slotsContainer");
    if (!container) return;

    if (!state.slots.length) {
      container.innerHTML = `
        <div class="slot-card disabled">
          <div class="slot-date">No Slots Available</div>
          <div class="slot-type">The admin has not published any booking windows for your department yet.</div>
          <button class="btn-primary" style="margin-top: 14px; width: 100%;" onclick="remindAdminToCreateSlot()">
            <i class="fas fa-bell"></i> Remind Admin To Create Booking Slot
          </button>
        </div>
      `;
      return;
    }

    const activeBooking = getActiveBooking();
    const isDeferred = String(state.user?.status || "").toLowerCase() === "deferred";

    container.innerHTML = state.slots
      .map((slot) => {
        const filled = Array.isArray(slot.presenters) ? slot.presenters.length : 0;
        const slotsLeft = Math.max((Number(slot.maxPresenters) || 0) - filled, 0);
        const isSelected = state.selectedSlotId === slot._id;
        const isClosed = slot.status === "Closed";
        const isFull = slot.status === "Full" || slotsLeft === 0;
        const isDisabled = isClosed || isFull || Boolean(activeBooking) || isDeferred;
        const cssClass = isDisabled ? "slot-card disabled" : `slot-card${isSelected ? " selected" : ""}`;
        const action = isDisabled ? "" : `onclick="selectSlot('${slot._id}')"`; 

        let badge = "";
        let meta = `
          <span><i class="fas fa-clock"></i> ${escapeHtml(getSlotTime(slot))}</span>
          <span class="capacity"><i class="fas fa-users"></i> ${filled}/${slot.maxPresenters} booked</span>
        `;

        if (isClosed) {
          badge = '<span class="slot-tag-closed">Window Closed</span>';
          meta = '<span><i class="fas fa-lock"></i> Booking window closed by admin</span>';
        } else if (isFull) {
          badge = '<span class="slot-tag-closed" style="background:#fef3c7;color:#b45309;">Full</span>';
          meta = `<span><i class="fas fa-users"></i> ${filled}/${slot.maxPresenters} booked</span>`;
        } else {
          meta += `<span><i class="fas fa-chair"></i> ${slotsLeft} slot${slotsLeft === 1 ? "" : "s"} left</span>`;
        }

        return `
          <div class="${cssClass}" ${action}>
            ${badge}
            <div class="slot-date">${escapeHtml(formatDate(slot.date))}</div>
            <div class="slot-type">${escapeHtml(getSlotType(slot))}</div>
            <div class="slot-meta">
              ${meta}
            </div>
          </div>
        `;
      })
      .join("");
  }

  function statusPill(status) {
    const normalized = String(status || "").toLowerCase();

    if (normalized === "completed") {
      return '<span class="status-pill pill-approved">COMPLETED</span>';
    }

    if (normalized === "confirmed" || normalized === "approved") {
      return '<span class="status-pill pill-approved">CONFIRMED</span>';
    }

    if (normalized === "cancelled") {
      return '<span class="status-pill pill-retracted">CANCELLED</span>';
    }

    if (normalized === "rejected") {
      return '<span class="status-pill pill-retracted">REJECTED</span>';
    }

    return '<span class="status-pill pill-pending">PENDING</span>';
  }

  function renderHistory() {
    const tbody = $("historyTableBody");
    if (!tbody) return;

    if (!state.bookings.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">
            No booking requests yet.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = state.bookings
      .map((booking) => {
        const normalizedStatus = String(booking.status || "").toLowerCase();
        const canCancel = normalizedStatus === "pending";
        const reminderNote = booking.reminderRequestedAt
          ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">Admin reminder sent on ${escapeHtml(formatShortDate(booking.reminderRequestedAt))}</div>`
          : "";
        const actions = canCancel
          ? `${statusPill(normalizedStatus)}<button class="btn-danger" style="margin-left:10px;" onclick="cancelBooking('${booking._id}')">Cancel</button><button class="btn-primary" style="margin-left:10px;" onclick="remindAdmin('${booking._id}')">Remind Admin</button>${reminderNote}`
          : `${statusPill(normalizedStatus)}${reminderNote}`;

        return `
          <tr>
            <td>
              <strong>${escapeHtml(formatShortDate(booking.preferredDate))}</strong><br />
              <span style="font-size: 12px; color: var(--text-muted)">${escapeHtml(
                booking.preferredTime || "-",
              )}</span>
            </td>
            <td>${escapeHtml(booking.presentationType || "-")}${
              booking.additionalNotes
                ? `<br /><span style="font-size: 12px; color: var(--text-muted)">Topic: ${escapeHtml(booking.additionalNotes)}</span>`
                : ""
            }</td>
            <td>${escapeHtml(booking.venue || "-")}</td>
            <td>${actions}</td>
          </tr>
        `;
      })
      .join("");
  }

  async function loadData() {
    const sessionResponse = await api.getSession();
    const department = normalizeDepartment(sessionResponse.user?.department);
    const [slotsResponse, bookingsResponse] = await Promise.all([
      api.getSlots(department),
      api.getBookings(),
    ]);

    state.user = sessionResponse.user || null;
    state.slots = slotsResponse.slots || [];
    state.bookings = bookingsResponse.bookings || [];
  }

  async function refresh() {
    await loadData();

    if (!getActiveBooking()) {
      const selected = getSelectedSlot();
      if (!selected || selected.status !== "Open") {
        state.selectedSlotId = null;
      }
    }

    setContext();
    renderFormDetails();
    renderSlots();
    renderHistory();
    applyRequestState();
  }

  window.selectSlot = function (slotId) {
    if (getActiveBooking()) return;
    state.selectedSlotId = slotId;
    renderFormDetails();
    renderSlots();
    applyRequestState();
  };

  window.submitBooking = async function () {
    const selectedSlot = getSelectedSlot();
    const researchTopic = getResearchTopicValue();
    if (!selectedSlot) {
      alert("Select an open slot first.");
      return;
    }

    if (!researchTopic) {
      alert("Enter your research topic before submitting the booking request.");
      getResearchTopicInput()?.focus();
      return;
    }

    const button = $("confirmBookingBtn");

    try {
      button.disabled = true;
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
      await api.requestPresentation({
        slotId: selectedSlot._id,
        additionalNotes: researchTopic,
      });
      const input = getResearchTopicInput();
      if (input) input.value = "";
      state.selectedSlotId = null;
      await refresh();
    } catch (error) {
      alert(error.message || "Failed to submit booking request");
      button.disabled = false;
      button.innerHTML = '<i class="fas fa-calendar-check"></i> Submit Booking Request';
    }
  };

  window.cancelBooking = async function (bookingId) {
    if (!window.confirm("Cancel this booking request and free the slot?")) {
      return;
    }

    try {
      await api.cancelBooking(bookingId, { reason: "Cancelled by student" });
      await refresh();
    } catch (error) {
      alert(error.message || "Failed to cancel booking");
    }
  };

  window.remindAdmin = async function (bookingId) {
    const message =
      window.prompt(
        "Add a short note for the admin about this booking:",
        "Please review my booking request. It appears to be missing or still pending.",
      ) || "";

    try {
      await api.remindAdminAboutBooking(bookingId, { message });
      alert("Reminder sent to the admin.");
      await refresh();
    } catch (error) {
      alert(error.message || "Failed to send reminder to admin");
    }
  };

  window.remindAdminToCreateSlot = async function () {
    const message =
      window.prompt(
        "Add a short note for the admin about creating a booking slot:",
        "Please create a booking slot for my department.",
      ) || "";

    try {
      await api.remindAdminToCreateSlot({ message });
      alert("Reminder sent to the admin to create a booking slot.");
      await refresh();
    } catch (error) {
      alert(error.message || "Failed to send slot reminder to admin");
    }
  };

  async function init() {
    const demoTools = document.querySelector(".demo-tools");
    if (demoTools) demoTools.style.display = "none";

    getResearchTopicInput()?.addEventListener("input", () => {
      applyRequestState();
    });

    try {
      await refresh();
    } catch (error) {
      console.error(error);
      $("slotsContainer").innerHTML =
        '<div class="slot-card disabled"><div class="slot-date">Unable to Load Slots</div><div class="slot-type">Please refresh the page or sign in again.</div></div>';
      $("historyTableBody").innerHTML =
        '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;">Could not load your booking history.</td></tr>';
    }
  }

  init();
})();
