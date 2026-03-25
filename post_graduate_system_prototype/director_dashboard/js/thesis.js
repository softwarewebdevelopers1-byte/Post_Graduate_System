import {
  badge,
  escapeHtml,
  formatDate,
  mountEmptyState,
  openModal,
  setPageContent,
  setPageMeta,
  toast,
} from "./main.js";

document.addEventListener("DOMContentLoaded", async () => {

  function buildShell() {
    setPageMeta({
      title: "Thesis & Defense Board",
      subtitle: "External examination • defense scheduling • result approvals",
    });

    setPageContent(`
      <div class="space-y-6">
        <div class="rounded-2xl dark-glass p-8 power-glow flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div class="text-xs font-bold uppercase tracking-widest text-blue-400">Research Command</div>
            <div class="mt-2 text-2xl font-bold">Thesis Lifecycle Authority</div>
            <div class="mt-2 text-slate-300 max-w-xl text-sm">
              You are viewing all students in External Examination or Defense phase.
              You have authority to appoint examiners and override results.
            </div>
          </div>
          <div class="flex gap-3">
            <button id="assignAllExternal" class="rounded-xl bg-white text-slate-900 px-6 py-3 text-sm font-bold uppercase tracking-widest hover:bg-slate-100 transition shadow-xl">
              Appoint Examiners Pool
            </button>
            <button class="rounded-xl border border-white/20 px-6 py-3 text-sm font-bold text-white uppercase tracking-widest hover:bg-white/10 transition backdrop-blur-md">
              Mass Remind Examiners
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-center">
            <div id="externalReviewCount" class="text-2xl font-bold text-blue-600">0</div>
            <div class="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">External Review</div>
          </div>
          <div class="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 text-center">
            <div id="pendingDefenseCount" class="text-2xl font-bold text-amber-600">0</div>
            <div class="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Pending Defense</div>
          </div>
          <div class="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-center">
            <div id="thesisClearedCount" class="text-2xl font-bold text-emerald-600">0</div>
            <div class="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Thesis Cleared</div>
          </div>
          <div class="rounded-2xl border border-rose-100 bg-rose-50/50 p-4 text-center">
            <div id="resubmissionsCount" class="text-2xl font-bold text-rose-600">0</div>
            <div class="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Resubmissions</div>
          </div>
        </div>

        <div id="thesisGrid" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Loaded dynamically -->
        </div>
      </div>
    `);
  }

  // Helper function to get status badge style
  function getBookingStatusBadge(status) {
    const statusMap = {
      'pending': { label: 'Pending', tone: 'yellow' },
      'confirmed': { label: 'Confirmed', tone: 'green' },
      'scheduled': { label: 'Scheduled', tone: 'blue' },
      'completed': { label: 'Completed', tone: 'green' },
      'cancelled': { label: 'Cancelled', tone: 'red' }
    };
    const config = statusMap[status] || { label: status || 'Unknown', tone: 'slate' };
    return badge({ label: config.label, tone: config.tone });
  }

  function studentThesisCard(student) {
    // Get the first booking (or you can handle multiple bookings per student)
    const booking = student.bookings && student.bookings[0] || student;

    // Get booking status badge
    const bookingStatusBadge = getBookingStatusBadge(booking.status);

    // Get presentation type badge
    const presentationTypeMap = {
      'Proposal Defence': { label: 'Proposal Defence', tone: 'blue' },
      'Progress Seminar': { label: 'Progress Seminar', tone: 'purple' },
      'Pre-oral Examination': { label: 'Pre-oral', tone: 'amber' },
      'Oral Examination': { label: 'Oral Exam', tone: 'red' }
    };
    const presType = presentationTypeMap[booking.presentationType] || { label: booking.presentationType || 'Thesis', tone: 'slate' };
    const presentationTypeBadge = badge({ label: presType.label, tone: presType.tone, size: 'xs' });

    // Format date
    const formattedDate = booking.preferredDate ? formatDate(booking.preferredDate) : 'Not scheduled';

    return `
      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft hover:shadow-lg transition-all">
        <div class="flex items-start justify-between">
          <div class="min-w-0 flex-1">
            <div class="text-xs font-bold uppercase tracking-widest text-blue-500">${escapeHtml(student.stage || 'Thesis Stage')}</div>
            <div class="mt-1 text-lg font-bold text-slate-900 truncate">${escapeHtml(student.name)}</div>
            <div class="text-xs font-medium text-slate-500">${escapeHtml(student.regNo)}</div>
          </div>
          <div class="shrink-0">
            <button data-thesis-action="1" data-id="${student.studentId}" class="rounded-xl border border-blue-200 bg-blue-50 p-2 text-blue-600 hover:bg-blue-100 transition shadow-sm" title="Manage Thesis">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
          ${presentationTypeBadge}
          ${bookingStatusBadge}
        </div>

        <div class="mt-3 text-xs text-slate-500 space-y-1">
          <div class="flex items-center gap-2">
            <span class="font-medium">📅 ${escapeHtml(formattedDate)}</span>
            <span>⏰ ${escapeHtml(booking.preferredTime || 'TBD')}</span>
          </div>
          <div>📍 ${escapeHtml(booking.venue || 'Venue TBD')}</div>
          ${booking.additionalNotes ? `<div class="text-xs text-slate-400 italic mt-2">📝 ${escapeHtml(booking.additionalNotes.substring(0, 80))}${booking.additionalNotes.length > 80 ? '...' : ''}</div>` : ''}
        </div>

        <div class="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
          <div class="grid grid-cols-2 gap-2">
            <div>
              <span class="font-medium">Programme:</span><br>
              ${escapeHtml(student.programme || '—')}
            </div>
            <div>
              <span class="font-medium">Department:</span><br>
              ${escapeHtml(student.department || '—')}
            </div>
          </div>
          <div class="mt-2">
            <span class="font-medium">Student Status:</span> ${escapeHtml(student.studentStatus || 'Active')}
          </div>
          ${booking.createdAt ? `<div class="mt-1 text-slate-400">Submitted: ${formatDate(booking.createdAt)}</div>` : ''}
          ${booking.cancelledAt ? `<div class="mt-1 text-rose-500">Cancelled: ${formatDate(booking.cancelledAt)}${booking.cancellationReason ? `<br>Reason: ${escapeHtml(booking.cancellationReason)}` : ''}</div>` : ''}
        </div>
        
        <div class="mt-4 flex gap-2">
          <button data-view-booking="${booking.bookingId}" class="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition">
            View Details
          </button>
          <button data-remind="${student.studentId}" class="flex-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition">
            Remind
          </button>
        </div>
      </div>
    `;
  }

  async function load() {
    buildShell();
    const grid = document.getElementById("thesisGrid");
    const loadingHtml = `
      <div class="col-span-3 text-center py-12">
        <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <p class="mt-4 text-slate-500">Loading thesis data...</p>
      </div>
    `;
    grid.innerHTML = loadingHtml;

    try {
      const res = await fetch("http://localhost:5000/api/presentations/booked-students", {
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      });
      const data = await res.json();
      console.log("Thesis data:", data);

      // Handle the API response structure: { success: true, students: [...] }
      if (!data.success || !data.students) {
        throw new Error(data.message || "No booked students data");
      }

      const students = data.students;

      if (!students || students.length === 0) {
        grid.innerHTML = mountEmptyState({
          title: "No thesis bookings",
          message: "There are no students currently scheduled for thesis defense or external examination."
        });
        return;
      }

      grid.innerHTML = students.map(studentThesisCard).join("");

      // Update dashboard counts dynamically
      document.getElementById("externalReviewCount").textContent = students.filter(s => s.stage === "External Examination").length;
      document.getElementById("pendingDefenseCount").textContent = students.filter(s => {
        const booking = s.bookings && s.bookings[0] || s;
        return booking.status === "pending";
      }).length;
      document.getElementById("thesisClearedCount").textContent = students.filter(s => {
        const booking = s.bookings && s.bookings[0] || s;
        return booking.status === "completed" || booking.status === "confirmed";
      }).length;
      document.getElementById("resubmissionsCount").textContent = students.filter(s => {
        const booking = s.bookings && s.bookings[0] || s;
        return booking.status === "cancelled" || s.stage === "Resubmission";
      }).length;

    } catch (err) {
      console.error("Error loading thesis data:", err);
      grid.innerHTML = mountEmptyState({
        title: "Thesis data unavailable",
        message: err.message || "Could not load thesis data. Please check your connection."
      });
    }
  }

  async function viewBookingDetails(bookingId) {
    try {
      const res = await fetch(`http://localhost:5000/api/presentations/${bookingId}`, {
        credentials: "include"
      });
      const data = await res.json();

      if (!data.success || !data.booking) {
        throw new Error(data.message || "Could not load booking details");
      }

      const booking = data.booking;

      openModal({
        title: `Booking Details - ${booking._id.slice(-8).toUpperCase()}`,
        size: "lg",
        bodyHtml: `
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-slate-50 p-3 rounded-xl">
                <div class="text-xs font-semibold text-slate-500">Presentation Type</div>
                <div class="font-medium">${escapeHtml(booking.presentationType)}</div>
              </div>
              <div class="bg-slate-50 p-3 rounded-xl">
                <div class="text-xs font-semibold text-slate-500">Status</div>
                <div class="mt-1">${getBookingStatusBadge(booking.status)}</div>
              </div>
              <div class="bg-slate-50 p-3 rounded-xl">
                <div class="text-xs font-semibold text-slate-500">Date & Time</div>
                <div>${formatDate(booking.preferredDate)} at ${escapeHtml(booking.preferredTime)}</div>
              </div>
              <div class="bg-slate-50 p-3 rounded-xl">
                <div class="text-xs font-semibold text-slate-500">Venue</div>
                <div>${escapeHtml(booking.venue)}</div>
              </div>
            </div>
            ${booking.additionalNotes ? `
              <div class="bg-slate-50 p-3 rounded-xl">
                <div class="text-xs font-semibold text-slate-500">Additional Notes</div>
                <div class="text-sm mt-1">${escapeHtml(booking.additionalNotes)}</div>
              </div>
            ` : ''}
            <div class="bg-slate-50 p-3 rounded-xl">
              <div class="text-xs font-semibold text-slate-500">Submission Date</div>
              <div>${formatDate(booking.createdAt)}</div>
            </div>
            ${booking.cancelledAt ? `
              <div class="bg-rose-50 p-3 rounded-xl border border-rose-200">
                <div class="text-xs font-semibold text-rose-600">Cancellation Details</div>
                <div>Cancelled: ${formatDate(booking.cancelledAt)}</div>
                ${booking.cancellationReason ? `<div>Reason: ${escapeHtml(booking.cancellationReason)}</div>` : ''}
              </div>
            ` : ''}
          </div>
        `,
        footerHtml: `
          <div class="flex gap-3">
            <button class="flex-1 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white uppercase tracking-widest shadow-xl" data-modal-close="1">Close</button>
          </div>
        `
      });
    } catch (err) {
      console.error("Error loading booking details:", err);
      toast(err.message || "Could not load booking details", { tone: "red" });
    }
  }

  async function sendReminder(studentId) {
    try {
      const response = await fetch("http://localhost:5000/api/notifications/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience: "students",
          type: "reminder",
          message: "Reminder: Your thesis defense booking requires attention. Please check your schedule.",
          studentId: studentId
        })
      });

      const data = await response.json();
      if (data.success) {
        toast("Reminder sent successfully", { tone: "green" });
      } else {
        toast(data.message || "Failed to send reminder", { tone: "red" });
      }
    } catch (err) {
      console.error("Error sending reminder:", err);
      toast("Failed to send reminder", { tone: "red" });
    }
  }

  async function submitThesisOutcome(studentId, status) {
    const remarks = document.getElementById("thesisRemarks")?.value || "";

    try {
      const response = await fetch(`http://localhost:5000/api/students/${studentId}/thesis/outcome`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, remarks })
      });

      const data = await response.json();
      if (data.success) {
        toast(`Thesis ${status} successfully!`, { tone: "green" });
        // Close modal
        const closeBtn = document.querySelector('[data-modal-close]');
        if (closeBtn) closeBtn.click();
        // Reload data
        load();
      } else {
        toast(data.message || "Failed to update thesis outcome", { tone: "red" });
      }
    } catch (err) {
      console.error("Error submitting thesis outcome:", err);
      toast("Failed to update thesis outcome", { tone: "red" });
    }
  }

  function openThesisGovernanceModal(studentId) {
    openModal({
      title: `Thesis Governance Center`,
      size: "lg",
      bodyHtml: `
        <div class="space-y-6">
          <div class="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <div class="flex items-center gap-3">
              <div class="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                ID
              </div>
              <div>
                <div class="text-sm font-bold text-blue-900">Thesis Decision Authority</div>
                <div class="text-xs text-blue-600">Student ID: ${studentId}</div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <button class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition">
              Appoint Examiners
            </button>
            <button class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition">
              Schedule Defense
            </button>
          </div>

          <div class="rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <div class="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Final Determination</div>
            <div class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Director's Decision Note</label>
                <textarea id="thesisRemarks" rows="3" class="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition" placeholder="Enter findings or justification..."></textarea>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <button data-thesis-outcome="approved" data-id="${studentId}" class="rounded-xl bg-emerald-600 px-4 py-4 text-sm font-bold text-white uppercase tracking-widest hover:bg-emerald-700 transition shadow-lg shadow-emerald-200">
                  Approve Thesis
                </button>
                <button data-thesis-outcome="rejected" data-id="${studentId}" class="rounded-xl bg-rose-600 px-4 py-4 text-sm font-bold text-white uppercase tracking-widest hover:bg-rose-700 transition shadow-lg shadow-rose-200">
                  Reject Thesis
                </button>
              </div>
              <div class="text-center">
                <p class="text-[10px] text-slate-400 font-medium italic">Approving will automatically advance the student to Graduation stage.</p>
              </div>
            </div>
          </div>
        </div>
      `,
      footerHtml: `<button class="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white uppercase tracking-widest shadow-xl" data-modal-close="1">Close Governance Center</button>`
    });
  }

  // Event delegation for dynamic buttons
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-thesis-action]");
    if (btn) {
      openThesisGovernanceModal(btn.dataset.id);
      return;
    }

    const viewBtn = e.target.closest("[data-view-booking]");
    if (viewBtn) {
      await viewBookingDetails(viewBtn.dataset.viewBooking);
      return;
    }

    const remindBtn = e.target.closest("[data-remind]");
    if (remindBtn) {
      await sendReminder(remindBtn.dataset.remind);
      return;
    }

    const outcomeBtn = e.target.closest("[data-thesis-outcome]");
    if (outcomeBtn) {
      const { id, thesisOutcome } = outcomeBtn.dataset;
      await submitThesisOutcome(id, thesisOutcome);
      return;
    }
  });

  load();
});