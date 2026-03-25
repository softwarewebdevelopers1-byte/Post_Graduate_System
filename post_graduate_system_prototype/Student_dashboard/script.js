document.addEventListener("DOMContentLoaded", () => {
  // ===== QUARTERLY REPORTS HANDLER =====
  class QuarterlyReportsHandler {
    constructor() {
      this.apiBaseUrl = 'https://post-graduate-system-prototype.onrender.com/api';
      this.initializeEventListeners();
      this.loadReportHistory();
    }

    initializeEventListeners() {
      const submitButton = document.querySelector('#section-reports .btn-primary');
      if (submitButton) {
        // Remove the existing onclick attribute from HTML
        submitButton.removeAttribute('onclick');

        // Remove any existing listeners to avoid duplicates
        const newButton = submitButton.cloneNode(true);
        submitButton.parentNode.replaceChild(newButton, submitButton);

        // Add the new event listener
        newButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handleReportSubmission(e);
        });
      }

      // Also prevent any form submission if there's a form element
      const reportSection = document.getElementById('section-reports');
      if (reportSection) {
        const forms = reportSection.querySelectorAll('form');
        forms.forEach(form => {
          form.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
          });
        });
      }
    }

    async handleReportSubmission(event) {
      try {
        // Get form data
        const reportData = this.collectReportData();

        // Validate form data
        const validation = this.validateReportData(reportData);
        if (!validation.isValid) {
          this.showNotification(validation.message, 'error');
          return;
        }

        // Get user data
        const userData = this.getUserData();
        if (!userData) {
          this.showNotification('Please login to submit a report', 'error');
          setTimeout(() => {
            window.location.href = '../login/login.html';
          }, 1500);
          return;
        }

        // Show loading state
        this.showLoadingState(true);

        // Submit report
        const response = await this.submitReport(reportData, userData);

        // Handle successful submission
        if (response.success) {
          this.showNotification(response.message || 'Report submitted successfully!', 'success');
          this.resetForm();
          await this.loadReportHistory();
          this.updateWorkflowUI('submitted');

          // Show additional success info if report URL exists
          if (response.reportUrl) {
            this.showNotification('Your PDF has been uploaded successfully.', 'info');
          }

          // Scroll to show the submission history
          const historyContainer = document.querySelector('#section-reports .history-container');
          if (historyContainer) {
            historyContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        } else {
          // Handle server-side errors
          this.showNotification(response.message || 'Failed to submit report', 'error');
        }

      } catch (error) {
        console.error('Report submission error:', error);

        // Handle different types of errors
        if (error.message && error.message.includes('File size')) {
          this.showNotification('File size exceeds 5MB limit. Please compress your PDF.', 'error');
        } else if (error.message && error.message.includes('PDF')) {
          this.showNotification('Only PDF files are allowed. Please upload a PDF document.', 'error');
        } else if (error.message && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
          this.showNotification('Your session has expired. Please login again.', 'error');
          setTimeout(() => {
            window.location.href = '../login/login.html';
          }, 2000);
        } else if (error.message && error.message.includes('Network')) {
          this.showNotification('Network error. Please check your internet connection.', 'error');
        } else if (error.message && (error.message.includes('already submitted') || error.message.includes('duplicate'))) {
          this.showNotification('You have already submitted a report for this quarter. Each quarter only one report is allowed.', 'warning');
          // Refresh history to show the existing report
          await this.loadReportHistory();
        } else {
          this.showNotification(error.message || 'Network error. Please try again.', 'error');
        }
      } finally {
        this.showLoadingState(false);
      }
    }

    collectReportData() {
      const section = document.getElementById('section-reports');
      const reportingQuarter = section.querySelector('.form-group:first-child select')?.value || '';
      const researchActivities = section.querySelector('.form-group:nth-child(2) textarea')?.value || '';
      const challengesEncountered = section.querySelector('.form-group:nth-child(3) textarea')?.value || '';
      const plannedActivities = section.querySelector('.form-group:nth-child(4) textarea')?.value || '';
      const fileInput = section.querySelector('input[type="file"]');
      const file = fileInput?.files?.[0];

      return {
        reportingQuarter,
        researchActivities,
        challengesEncountered,
        plannedActivities,
        file: file || null,
        fileName: file?.name || '',
        fileSize: file?.size || 0,
        fileType: file?.type || ''
      };
    }

    validateReportData(data) {
      if (!data.reportingQuarter) {
        return { isValid: false, message: 'Please select a reporting quarter' };
      }
      if (!data.researchActivities || data.researchActivities.trim().length < 20) {
        return { isValid: false, message: 'Please describe your research activities (minimum 20 characters)' };
      }
      if (!data.plannedActivities || data.plannedActivities.trim().length < 20) {
        return { isValid: false, message: 'Please describe your planned activities (minimum 20 characters)' };
      }
      if (data.file && data.file.size > 5 * 1024 * 1024) {
        return { isValid: false, message: 'File size cannot exceed 5MB' };
      }
      if (data.file && data.file.type !== 'application/pdf') {
        return { isValid: false, message: 'Only PDF files are allowed' };
      }
      return { isValid: true, message: '' };
    }

    async submitReport(reportData, userData) {
      const formData = new FormData();
      formData.append('reportingQuarter', reportData.reportingQuarter);
      formData.append('researchActivities', reportData.researchActivities);
      formData.append('challengesEncountered', reportData.challengesEncountered);
      formData.append('plannedActivities', reportData.plannedActivities);

      if (reportData.file) {
        formData.append('reportFile', reportData.file);
        formData.append('fileName', reportData.fileName);
        formData.append('fileSize', reportData.fileSize.toString());
      }

      const response = await fetch(`${this.apiBaseUrl}/reports/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userData.token}`
        },
        credentials: 'include',
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        // Extract meaningful error message
        const errorMsg = result.message || result.error || `HTTP ${response.status}`;
        throw new Error(errorMsg);
      }

      return result;
    }

    async loadReportHistory() {
      try {
        const userData = this.getUserData();
        if (!userData) return;

        const response = await fetch(`${this.apiBaseUrl}/reports/history`, {
          headers: { 'Authorization': `Bearer ${userData.token}` },
          credentials: 'include'
        });

        if (!response.ok) {
          console.error('Failed to load report history');
          return;
        }

        const result = await response.json();
        if (result.success && result.reports) {
          this.updateHistoryUI(result.reports);
        }
      } catch (error) {
        console.error('Error loading report history:', error);
        // Don't show notification for history load failure to avoid spamming
      }
    }

    updateHistoryUI(reports) {
      // Find or create the history container - NOT the form card
      let historyContainer = document.querySelector('#section-reports .history-container');

      // If history container doesn't exist, create it AFTER the form card
      if (!historyContainer) {
        const reportsSection = document.getElementById('section-reports');
        if (reportsSection) {
          // Find the form card (the first card in the section that contains the form)
          const cards = reportsSection.querySelectorAll('.card');
          let formCard = null;

          // Look for the card that contains the submit button (the form card)
          for (let i = 0; i < cards.length; i++) {
            if (cards[i].querySelector('.btn-primary')) {
              formCard = cards[i];
              break;
            }
          }

          // If we found the form card, create history container after it
          if (formCard) {
            // Check if there's already a history card after it
            let existingHistory = formCard.nextElementSibling;
            if (existingHistory && existingHistory.classList.contains('card') && existingHistory.innerHTML.includes('Submission History')) {
              historyContainer = existingHistory;
              historyContainer.classList.add('history-container');
            } else {
              // Create new history card
              const newCard = document.createElement('div');
              newCard.className = 'card history-container';
              newCard.style.marginTop = '24px';
              formCard.insertAdjacentElement('afterend', newCard);
              historyContainer = newCard;
            }
          } else {
            // If no form card found, create at the end
            const newCard = document.createElement('div');
            newCard.className = 'card history-container';
            newCard.style.marginTop = '24px';
            reportsSection.appendChild(newCard);
            historyContainer = newCard;
          }
        }
      }

      if (!historyContainer) return;

      if (!reports || reports.length === 0) {
        historyContainer.innerHTML = `
          <div class="card-title" style="margin-bottom:12px;">Submission History</div>
          <div style="text-align: center; padding: 20px; color: var(--grey-500);">
            No previous submissions found
          </div>
        `;
        return;
      }

      // Group reports by quarter for better display
      const groupedReports = {};
      reports.forEach(report => {
        const quarter = report.reportingQuarter;
        if (!groupedReports[quarter]) {
          groupedReports[quarter] = [];
        }
        groupedReports[quarter].push(report);
      });

      const historyHTML = `
        <div class="card-title" style="margin-bottom:12px;">Submission History</div>
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${Object.keys(groupedReports).map(quarter => `
            <div style="margin-bottom: 8px;">
              <div style="font-weight: 600; margin-bottom: 8px; color: var(--grey-700); border-left: 3px solid var(--blue); padding-left: 10px;">
                ${quarter}
              </div>
              ${groupedReports[quarter].map(report => `
                <div class="flex-between" style="font-size:0.82rem; padding: 12px 12px; background: ${this.getStatusColor(report.status)}; border-radius:var(--radius-sm); margin-bottom: 8px;">
                  <div style="flex: 1;">
                    <div><strong>Submitted:</strong> ${new Date(report.createdAt || report.submittedAt).toLocaleDateString()}</div>
                    ${report.reportUrl ? `<div style="margin-top: 6px;"><a href="${report.reportUrl}" target="_blank" style="color: var(--blue); text-decoration: none;">📄 View PDF Report</a></div>` : '<div style="margin-top: 6px; color: var(--grey-500);">No PDF attached</div>'}
                    ${report.researchActivities ? `<div style="margin-top: 6px; font-size: 0.7rem; color: var(--grey-600);"><strong>Research:</strong> ${report.researchActivities.substring(0, 100)}${report.researchActivities.length > 100 ? '...' : ''}</div>` : ''}
                    ${report.status ? `<div style="margin-top: 4px; font-size: 0.7rem;"><strong>Status:</strong> ${this.getStatusText(report.status)}</div>` : ''}
                  </div>
                  <span class="badge ${this.getStatusBadgeClass(report.status)}" style="font-size:0.68rem; margin-left: 12px;">${this.getStatusText(report.status)}</span>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      `;

      historyContainer.innerHTML = historyHTML;
    }

    updateWorkflowUI(status) {
      if (status === 'submitted') {
        const step1El = document.getElementById('wf-1');
        const status1El = document.getElementById('wf-1-s');
        if (step1El) step1El.className = 'wf-step wf-active';
        if (status1El) status1El.textContent = 'Under Review';
      }
    }

    getStatusColor(status) {
      const colors = {
        approved: 'var(--green-light)',
        under_review: '#fff3e0',
        rejected: 'var(--red-light)',
        pending: 'var(--grey-100)'
      };
      return colors[status] || 'var(--grey-100)';
    }

    getStatusBadgeClass(status) {
      const classes = {
        approved: 'badge-active',
        under_review: 'badge-pending',
        rejected: 'badge-deferred',
        pending: 'badge-pending'
      };
      return classes[status] || 'badge-pending';
    }

    getStatusText(status) {
      const texts = {
        approved: 'Approved ✓',
        under_review: 'Under Review',
        rejected: 'Rejected ✗',
        pending: 'Pending'
      };
      return texts[status] || 'Pending';
    }

    getUserData() {
      try {
        const rawData = localStorage.getItem('postgraduate_user');
        if (!rawData) return null;
        const userData = JSON.parse(rawData);
        return {
          id: userData.id || userData._id,
          fullName: userData.fullName || userData.name,
          email: userData.email,
          role: userData.role,
          token: userData.token,
          userNumber: userData.userNumber || userData.studentId
        };
      } catch (error) {
        console.error('Error getting user data:', error);
        return null;
      }
    }

    showNotification(message, type = 'info') {
      // Remove any existing notification of the same type to avoid stacking
      const existingNotifications = document.querySelectorAll('.report-notification');
      existingNotifications.forEach(notif => {
        notif.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notif.remove(), 300);
      });

      let notification = document.createElement('div');
      notification.className = `report-notification ${type}`;
      notification.textContent = message;
      document.body.appendChild(notification);

      const style = document.createElement('style');
      style.textContent = `
        .report-notification {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 16px 20px;
          border-radius: 8px;
          font-size: 14px;
          z-index: 10000;
          animation: slideIn 0.3s ease;
          max-width: 400px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .report-notification.success { background: #10b981; color: white; border-left: 4px solid #059669; }
        .report-notification.error { background: #ef4444; color: white; border-left: 4px solid #dc2626; }
        .report-notification.info { background: #3b82f6; color: white; border-left: 4px solid #2563eb; }
        .report-notification.warning { background: #f59e0b; color: white; border-left: 4px solid #d97706; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
      `;

      if (!document.querySelector('#notification-styles')) {
        style.id = 'notification-styles';
        document.head.appendChild(style);
      }

      // Auto-hide after 5 seconds
      setTimeout(() => {
        if (notification && notification.parentNode) {
          notification.style.animation = 'slideOut 0.3s ease';
          setTimeout(() => {
            if (notification && notification.parentNode) {
              notification.remove();
            }
          }, 300);
        }
      }, 5000);
    }

    showLoadingState(isLoading) {
      const button = document.querySelector('#section-reports .btn-primary');
      if (!button) return;

      if (isLoading) {
        button.setAttribute('data-original-text', button.textContent);
        button.textContent = '⏳ Submitting...';
        button.disabled = true;
        button.style.opacity = '0.7';
        button.style.cursor = 'not-allowed';
      } else {
        const originalText = button.getAttribute('data-original-text') || '📤 Submit Report';
        button.textContent = originalText;
        button.disabled = false;
        button.style.opacity = '1';
        button.style.cursor = 'pointer';
      }
    }

    resetForm() {
      const section = document.getElementById('section-reports');
      const select = section.querySelector('select');
      if (select && select.options.length > 0) select.selectedIndex = 0;
      const textareas = section.querySelectorAll('textarea');
      textareas.forEach(textarea => textarea.value = '');
      const fileInput = section.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
    }
  }

  // ===== PRESENTATION BOOKING HANDLER =====
  class PresentationBookingHandler {
    constructor() {
      this.apiBaseUrl = 'https://post-graduate-system-prototype.onrender.com/api';
      this.initializeEventListeners();
      this.loadAndDisplayBookings();
    }

    initializeEventListeners() {
      const bookingButton = document.querySelector('#section-scheduling .btn-primary');
      if (bookingButton) {
        // Remove the existing onclick attribute from HTML
        bookingButton.removeAttribute('onclick');

        const newButton = bookingButton.cloneNode(true);
        bookingButton.parentNode.replaceChild(newButton, bookingButton);
        newButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.handleBooking();
        });
      }
    }

    async loadAndDisplayBookings() {
      const userData = this.getUserData();
      if (!userData) return;

      try {
        const response = await fetch(`${this.apiBaseUrl}/presentations/my-bookings`, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Authorization': `Bearer ${userData.token}` }
        });

        if (!response.ok) {
          console.error('Failed to load bookings');
          return;
        }

        const data = await response.json();
        if (data.success && data.bookings) {
          this.displayBookings(data.bookings, data.hasPendingBooking);
          if (data.hasPendingBooking) {
            const bookingButton = document.querySelector('#section-scheduling .btn-primary');
            if (bookingButton) {
              bookingButton.disabled = true;
              bookingButton.textContent = '📅 Booking Pending (Cannot book)';
              bookingButton.style.opacity = '0.6';
              bookingButton.style.cursor = 'not-allowed';
            }
            this.showNotification('You have a pending booking request. Please wait for approval.', 'warning');
          }
        }
      } catch (error) {
        console.error('Error loading bookings:', error);
      }
    }

    displayBookings(bookings, hasPendingBooking) {
      let bookingsContainer = document.getElementById('my-bookings-container');
      const schedulingSection = document.getElementById('section-scheduling');

      if (!bookingsContainer) {
        bookingsContainer = document.createElement('div');
        bookingsContainer.id = 'my-bookings-container';
        bookingsContainer.className = 'my-bookings-container';
        schedulingSection.appendChild(bookingsContainer);
      }

      if (bookings.length === 0) {
        bookingsContainer.innerHTML = `
          <div class="card" style="margin-top: 24px; text-align: center; padding: 40px;">
            <div style="font-size: 48px; margin-bottom: 16px;">📅</div>
            <h3 style="margin-bottom: 8px;">No Bookings Yet</h3>
            <p style="color: var(--grey-600);">You haven't made any presentation bookings. Use the form above to request a booking.</p>
          </div>
        `;
        return;
      }

      const pendingBookings = bookings.filter(b => b.status === 'pending');
      const confirmedBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'scheduled');
      const completedBookings = bookings.filter(b => b.status === 'completed');
      const cancelledBookings = bookings.filter(b => b.status === 'cancelled');

      let html = `
        <div class="my-bookings-header" style="margin-top: 32px; margin-bottom: 20px;">
          <h2 style="font-size: 20px; font-weight: 600; color: var(--grey-900);">My Presentation Bookings</h2>
          <p style="font-size: 13px; color: var(--grey-600);">View and track your presentation requests</p>
        </div>
      `;

      if (pendingBookings.length > 0) {
        html += `<div class="bookings-section"><div class="section-title" style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;"><span style="display: inline-block; width: 8px; height: 8px; background: #f59e0b; border-radius: 50%;"></span><h3 style="font-size: 16px; font-weight: 600; color: #f59e0b;">Pending Requests (${pendingBookings.length})</h3></div><div class="bookings-grid" style="display: grid; gap: 16px;">`;
        pendingBookings.forEach(booking => { html += this.generateBookingCard(booking, 'pending'); });
        html += `</div></div>`;
      }

      if (confirmedBookings.length > 0) {
        html += `<div class="bookings-section" style="margin-top: 24px;"><div class="section-title" style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;"><span style="display: inline-block; width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></span><h3 style="font-size: 16px; font-weight: 600; color: #10b981;">Confirmed/Scheduled (${confirmedBookings.length})</h3></div><div class="bookings-grid" style="display: grid; gap: 16px;">`;
        confirmedBookings.forEach(booking => { html += this.generateBookingCard(booking, 'confirmed'); });
        html += `</div></div>`;
      }

      if (completedBookings.length > 0) {
        html += `<div class="bookings-section" style="margin-top: 24px;"><div class="section-title" style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;"><span style="display: inline-block; width: 8px; height: 8px; background: #6b7280; border-radius: 50%;"></span><h3 style="font-size: 16px; font-weight: 600; color: var(--grey-600);">Completed (${completedBookings.length})</h3></div><div class="bookings-grid" style="display: grid; gap: 16px;">`;
        completedBookings.forEach(booking => { html += this.generateBookingCard(booking, 'completed'); });
        html += `</div></div>`;
      }

      if (cancelledBookings.length > 0) {
        html += `<div class="bookings-section" style="margin-top: 24px;"><div class="section-title" style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;"><span style="display: inline-block; width: 8px; height: 8px; background: #ef4444; border-radius: 50%;"></span><h3 style="font-size: 16px; font-weight: 600; color: #ef4444;">Cancelled (${cancelledBookings.length})</h3></div><div class="bookings-grid" style="display: grid; gap: 16px;">`;
        cancelledBookings.forEach(booking => { html += this.generateBookingCard(booking, 'cancelled'); });
        html += `</div></div>`;
      }

      bookingsContainer.innerHTML = html;
      this.addBookingStyles();
    }

    generateBookingCard(booking, status) {
      const statusColors = {
        pending: { bg: '#fef3c7', text: '#f59e0b', border: '#f59e0b', icon: '⏳', label: 'Pending' },
        confirmed: { bg: '#d1fae5', text: '#10b981', border: '#10b981', icon: '✅', label: 'Confirmed' },
        scheduled: { bg: '#d1fae5', text: '#10b981', border: '#10b981', icon: '📅', label: 'Scheduled' },
        completed: { bg: '#f3f4f6', text: '#6b7280', border: '#9ca3af', icon: '✓', label: 'Completed' },
        cancelled: { bg: '#fee2e2', text: '#ef4444', border: '#ef4444', icon: '✗', label: 'Cancelled' }
      };
      const colors = statusColors[status] || statusColors.pending;
      const bookingDate = new Date(booking.preferredDate);
      const formattedDate = bookingDate.toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });

      return `
        <div class="booking-card" style="background: white; border: 1px solid var(--grey-200); border-left: 4px solid ${colors.border}; border-radius: 12px; padding: 20px; transition: all 0.2s;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
            <div><h4 style="font-size: 16px; font-weight: 600; color: var(--grey-900); margin-bottom: 4px;">${booking.presentationType}</h4><span style="display: inline-flex; align-items: center; gap: 4px; background: ${colors.bg}; color: ${colors.text}; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 500;">${colors.icon} ${colors.label}</span></div>
            <div style="text-align: right;"><div style="font-size: 12px; color: var(--grey-500);">Booking Ref:</div><div style="font-size: 12px; font-weight: 500; color: var(--grey-700);">${booking._id.slice(-8).toUpperCase()}</div></div>
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 16px;">
            <div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 18px;">📅</span><div><div style="font-size: 11px; color: var(--grey-500);">Date</div><div style="font-size: 13px; font-weight: 500; color: var(--grey-700);">${formattedDate}</div></div></div>
            <div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 18px;">⏰</span><div><div style="font-size: 11px; color: var(--grey-500);">Time</div><div style="font-size: 13px; font-weight: 500; color: var(--grey-700);">${booking.preferredTime}</div></div></div>
            <div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 18px;">📍</span><div><div style="font-size: 11px; color: var(--grey-500);">Venue</div><div style="font-size: 13px; font-weight: 500; color: var(--grey-700);">${booking.venue}</div></div></div>
          </div>
          ${booking.additionalNotes ? `<div style="margin-top: 12px; padding: 12px; background: var(--grey-50); border-radius: 8px;"><div style="font-size: 11px; color: var(--grey-500); margin-bottom: 4px;">Additional Notes:</div><div style="font-size: 13px; color: var(--grey-600);">${booking.additionalNotes}</div></div>` : ''}
          <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--grey-200); display: flex; justify-content: space-between; align-items: center;">
            <div style="font-size: 11px; color: var(--grey-400);">Submitted: ${new Date(booking.createdAt).toLocaleDateString()}</div>
            ${status === 'pending' ? `<button onclick="window.cancelBooking('${booking._id}')" style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer;">Cancel Request</button>` : ''}
          </div>
        </div>
      `;
    }

    addBookingStyles() {
      if (document.getElementById('booking-styles')) return;
      const style = document.createElement('style');
      style.id = 'booking-styles';
      style.textContent = `
        .booking-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .my-bookings-container { animation: fadeIn 0.5s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 768px) { .booking-card { padding: 16px; } .bookings-grid { grid-template-columns: 1fr; } }
      `;
      document.head.appendChild(style);
    }

    async handleBooking() {
      try {
        const bookingData = this.collectBookingData();
        const validation = this.validateBookingData(bookingData);
        if (!validation.isValid) {
          this.showNotification(validation.message, 'error');
          return;
        }
        const userData = this.getUserData();
        if (!userData) {
          this.showNotification('Please login to book a presentation', 'error');
          window.location.href = '../login/login.html';
          return;
        }
        this.showLoadingState(true);
        const response = await this.submitBooking(bookingData, userData);
        if (response.success) {
          this.showNotification('Presentation request submitted successfully!', 'success');
          this.resetForm();
          await this.loadAndDisplayBookings();
        } else {
          this.showNotification(response.message || 'Failed to submit booking request', 'error');
        }
      } catch (error) {
        console.error('Booking error:', error);
        this.showNotification(error.message || 'Network error. Please check your connection.', 'error');
      } finally {
        this.showLoadingState(false);
      }
    }

    collectBookingData() {
      const section = document.getElementById('section-scheduling');
      return {
        presentationType: section.querySelector('.form-group:first-child select')?.value || '',
        preferredDate: section.querySelector('#pres-date')?.value || '',
        preferredTime: section.querySelector('.form-group:nth-child(3) select')?.value || '',
        venue: section.querySelector('.form-group:nth-child(4) select')?.value || '',
        additionalNotes: section.querySelector('.form-group:last-child textarea')?.value || '',
        timestamp: new Date().toISOString()
      };
    }

    validateBookingData(data) {
      if (!data.presentationType) return { isValid: false, message: 'Please select a presentation type' };
      if (!data.preferredDate) return { isValid: false, message: 'Please select a preferred date' };
      const selectedDate = new Date(data.preferredDate);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (selectedDate < today) return { isValid: false, message: 'Please select a future date' };
      const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + 90);
      if (selectedDate > maxDate) return { isValid: false, message: 'Please select a date within the next 90 days' };
      if (!data.preferredTime) return { isValid: false, message: 'Please select a preferred time' };
      if (!data.venue) return { isValid: false, message: 'Please select a venue' };
      if (data.additionalNotes && data.additionalNotes.length > 500) return { isValid: false, message: 'Additional notes cannot exceed 500 characters' };
      return { isValid: true, message: '' };
    }

    getUserData() {
      try {
        const rawData = localStorage.getItem('postgraduate_user');
        if (!rawData) return null;
        const userData = JSON.parse(rawData);
        return {
          id: userData.id || userData._id,
          fullName: userData.fullName || userData.name,
          email: userData.email,
          role: userData.role,
          token: userData.token,
          userNumber: userData.userNumber || userData.studentId
        };
      } catch (error) {
        console.error('Error getting user data:', error);
        return null;
      }
    }

    async submitBooking(bookingData, userData) {
      const payload = {
        presentationType: bookingData.presentationType,
        preferredDate: bookingData.preferredDate,
        preferredTime: bookingData.preferredTime,
        venue: bookingData.venue,
        additionalNotes: bookingData.additionalNotes,
        studentId: userData.id,
        studentName: userData.fullName,
        studentEmail: userData.email,
        studentNumber: userData.userNumber
      };
      const response = await fetch(`${this.apiBaseUrl}/presentations/request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || `HTTP ${response.status}`);
      return result;
    }

    showNotification(message, type = 'info') {
      // Remove existing notifications
      const existingNotifications = document.querySelectorAll('.booking-notification');
      existingNotifications.forEach(notif => notif.remove());

      let notification = document.createElement('div');
      notification.className = `booking-notification ${type}`;
      notification.textContent = message;
      document.body.appendChild(notification);

      const style = document.createElement('style');
      style.textContent = `
        .booking-notification { position: fixed; top: 20px; right: 20px; padding: 16px 20px; border-radius: 8px; font-size: 14px; z-index: 10000; animation: slideIn 0.3s ease; max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .booking-notification.success { background: #10b981; color: white; border-left: 4px solid #059669; }
        .booking-notification.error { background: #ef4444; color: white; border-left: 4px solid #dc2626; }
        .booking-notification.info { background: #3b82f6; color: white; border-left: 4px solid #2563eb; }
        .booking-notification.warning { background: #f59e0b; color: white; border-left: 4px solid #d97706; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
      `;

      if (!document.querySelector('#booking-notification-styles')) {
        style.id = 'booking-notification-styles';
        document.head.appendChild(style);
      }

      setTimeout(() => {
        if (notification && notification.parentNode) {
          notification.style.animation = 'slideOut 0.3s ease';
          setTimeout(() => notification.remove(), 300);
        }
      }, 5000);
    }

    showLoadingState(isLoading) {
      const button = document.querySelector('#section-scheduling .btn-primary');
      if (!button) return;
      if (isLoading) {
        button.setAttribute('data-original-text', button.textContent);
        button.textContent = '⏳ Submitting...';
        button.disabled = true;
        button.style.opacity = '0.7';
      } else {
        const originalText = button.getAttribute('data-original-text') || '📅 Request Booking';
        button.textContent = originalText;
        button.disabled = false;
        button.style.opacity = '1';
      }
    }

    resetForm() {
      const section = document.getElementById('section-scheduling');
      const selects = section.querySelectorAll('select');
      selects.forEach(select => { if (select.options.length > 0) select.selectedIndex = 0; });
      const dateInput = section.querySelector('#pres-date');
      if (dateInput) {
        dateInput.value = '';
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateInput.min = tomorrow.toISOString().split('T')[0];
      }
      const textarea = section.querySelector('textarea');
      if (textarea) textarea.value = '';
    }
  }

  // ===== CANCEL BOOKING FUNCTION =====
  window.cancelBooking = async function (bookingId) {
    if (!confirm('Are you sure you want to cancel this booking request?')) return;
    try {
      const userData = JSON.parse(localStorage.getItem('postgraduate_user'));
      if (!userData) { alert('Please login to cancel booking'); return; }
      const response = await fetch(`https://post-graduate-system-prototype.onrender.com/api/presentations/${bookingId}/cancel`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include'
      });
      const result = await response.json();
      if (result.success) {
        alert('Booking cancelled successfully');
        if (window.bookingHandler) await window.bookingHandler.loadAndDisplayBookings();
      } else {
        alert(result.message || 'Failed to cancel booking');
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('Network error. Please try again.');
    }
  };

  // ===== GLOBAL NAVIGATION FUNCTION =====
  window.navigate = function (target, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const section = document.getElementById('section-' + target);
    if (section) section.classList.add('active');
    if (el) el.classList.add('active');
    const titles = {
      profile: ['My Profile', 'Student academic particulars & status'],
      pipeline: ['Research Pipeline', '10-Stage postgraduate research tracker'],
      reports: ['Quarterly Reports', 'Submit and track progress reports'],
      compliance: ['Compliance Center', 'NACOSTI uploads & thesis submission portal'],
      scheduling: ['Scheduling & Corrections', 'Presentation booking & AI correction checklist'],
      finance: ['ERP Finance', 'Student finance clearance & account status'],
    };
    const pageTitle = document.getElementById('page-title');
    const pageSub = document.getElementById('page-sub');
    if (pageTitle) pageTitle.textContent = titles[target][0];
    if (pageSub) pageSub.textContent = titles[target][1];
  };

  // ===== LOGOUT FUNCTION =====
  window.logoutUser = async function () {
    if (!confirm('Are you sure you want to logout?')) return;
    const logoutBtn = document.getElementById('logout-btn-sidebar');
    const originalText = logoutBtn ? logoutBtn.innerHTML : '';
    if (logoutBtn) {
      logoutBtn.innerHTML = '<span class="nav-icon">⏳</span> Logging out...';
      logoutBtn.disabled = true;
    }
    try {
      const response = await fetch('https://post-graduate-system-prototype.onrender.com/api/user/login/logout', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (response.ok && data.success) {
        localStorage.removeItem('postgraduate_user');
        sessionStorage.removeItem('postgraduate_user');
        localStorage.removeItem('userToken');
        sessionStorage.clear();
        alert('Logged out successfully!');
        window.location.href = '../login/login.html';
      } else {
        throw new Error(data.message || 'Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
      alert('Error during logout: ' + error.message);
      localStorage.removeItem('postgraduate_user');
      sessionStorage.removeItem('postgraduate_user');
      window.location.href = '../login/login.html';
    } finally {
      if (logoutBtn && logoutBtn.innerHTML !== '<span class="nav-icon">🚪</span> Logout') {
        logoutBtn.innerHTML = '<span class="nav-icon">🚪</span> Logout';
        logoutBtn.disabled = false;
      }
    }
  };

  // ===== OVERRIDE THE OLD SUBMIT REPORT FUNCTION =====
  // This prevents the HTML onclick from causing page reload
  window.originalSubmitReport = window.submitReport;
  window.submitReport = function () {
    console.log('Report submission handled by QuarterlyReportsHandler');
    // Find the button and trigger the handler
    const submitButton = document.querySelector('#section-reports .btn-primary');
    if (submitButton) {
      const clickEvent = new Event('click', { bubbles: true, cancelable: true });
      submitButton.dispatchEvent(clickEvent);
    }
    return false;
  };

  // ===== MAIN APPLICATION CODE =====
  (async () => {
    const updateUserStorage = (userData) => {
      try {
        if (userData && userData.id) localStorage.setItem("postgraduate_user", JSON.stringify(userData));
      } catch (error) { console.error("Failed to store user data:", error); }
    };
    const clearUserData = () => {
      try {
        localStorage.removeItem("postgraduate_user");
        sessionStorage.removeItem("postgraduate_user");
      } catch (error) { console.error("Failed to clear user data:", error); }
    };

    let usersData = null;
    try {
      const storedData = localStorage.getItem("postgraduate_user");
      usersData = storedData ? JSON.parse(storedData) : null;
    } catch (error) {
      console.error("Error parsing stored user data:", error);
      clearUserData();
    }

    try {
      const result = await fetch("https://post-graduate-system-prototype.onrender.com/api/islogged", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json", "Accept": "application/json" }
      });

      if (result.status === 401 || !result.ok || usersData === null) {
        console.log("User not authenticated, redirecting to login");
        clearUserData();
        window.location.href = "../login/login.html";
        return;
      }

      if (result.status === 200) {
        let responseData;
        try { responseData = await result.json(); } catch (parseError) {
          console.error("Failed to parse server response:", parseError);
          clearUserData();
          window.location.href = "../login/login.html";
          return;
        }

        if (responseData && responseData.user) {
          const userData = {
            id: responseData.user.id || responseData.user._id,
            fullName: responseData.user.fullName || responseData.user.name || responseData.user.firstName + " " + responseData.user.lastName || "User",
            programme: responseData.user.programme || responseData.user.program || "Not specified",
            department: responseData.user.department || "Not specified",
            userNumber: responseData.user.userNumber || responseData.user.studentId || responseData.user.id,
            role: responseData.user.role || "student",
            supervisor: responseData.user.supervisor || null,
            email: responseData.user.email,
            token: responseData.token || null,
            lastLogin: new Date().toISOString()
          };
          updateUserStorage(userData);
          usersData = userData;
        } else if (responseData && responseData.id) {
          const userData = {
            id: responseData.id,
            fullName: responseData.fullName || responseData.name || "User",
            programme: responseData.programme || "Not specified",
            department: responseData.department || "Not specified",
            userNumber: responseData.userNumber || responseData.id,
            role: responseData.role || "student",
            supervisor: responseData.supervisor || null,
            email: responseData.email,
            token: responseData.token || null,
            lastLogin: new Date().toISOString()
          };
          updateUserStorage(userData);
          usersData = userData;
        } else {
          if (!usersData) {
            clearUserData();
            window.location.href = "../login/login.html";
            return;
          }
        }
      }
    } catch (fetchError) {
      console.error("Network error checking login status:", fetchError);
      if (usersData && usersData.lastLogin) {
        const lastLoginDate = new Date(usersData.lastLogin);
        const now = new Date();
        const hoursSinceLogin = (now - lastLoginDate) / (1000 * 60 * 60);
        if (hoursSinceLogin >= 24) {
          clearUserData();
          window.location.href = "../login/login.html";
          return;
        }
      } else {
        window.location.href = "../login/login.html";
        return;
      }
    }

    let currentUserData = null;
    try {
      const storedData = localStorage.getItem("postgraduate_user");
      currentUserData = storedData ? JSON.parse(storedData) : null;
    } catch (error) { console.error("Error getting final user data:", error); }

    const profileNameElement = document.querySelector(".profile-name");
    if (profileNameElement && currentUserData) {
      profileNameElement.innerHTML = currentUserData.fullName || "Student";
    }

    // ===== STATE =====
    let currentStatus = 'ACTIVE';
    const statuses = ['ACTIVE', 'DEFERRED', 'RESUMED', 'GRADUATED'];
    let currentStage = 3;
    let clearanceGranted = false;
    let reportSubmitted = false;

    const stageData = [
      { label: 'Admission &\nEnrolment', phase: 1, approver: 'Registry', next: 'Complete orientation' },
      { label: 'Concept Paper\nApproval', phase: 1, approver: 'Supervisor + School Board', next: 'Submit proposal draft' },
      { label: 'Data Collection\n& Fieldwork', phase: 1, approver: 'Supervisor + Dean', next: 'Submit Progress Report Q3' },
      { label: 'Proposal\nDefence', phase: 1, approver: 'Proposal Panel', next: 'Prepare defence presentation' },
      { label: 'Research\nPermit (NACOSTI)', phase: 1, approver: 'NACOSTI Board', next: 'Upload NACOSTI docs' },
      { label: 'Data Analysis\n& Write-up', phase: 2, approver: 'Supervisor', next: 'Submit draft thesis chapters' },
      { label: 'Internal\nSeminar', phase: 2, approver: 'School Seminar Panel', next: 'Register for seminar' },
      { label: 'Thesis\nSubmission', phase: 2, approver: 'SGS Dean + Finance', next: 'Upload thesis documents' },
      { label: 'Oral Examination\n(Viva)', phase: 2, approver: 'External Examiners', next: 'Book viva date' },
      { label: 'Graduation\n& Conferment', phase: 2, approver: 'Senate', next: 'Apply for graduation' },
    ];

    const statusConfig = {
      ACTIVE: { cls: 'badge-active', label: '● ACTIVE', btn: 'btn-danger', btnText: 'Request Deferral', showAlert: false },
      DEFERRED: { cls: 'badge-deferred', label: '⏸ DEFERRED', btn: 'btn-outline', btnText: 'Request Reinstatement', showAlert: true },
      RESUMED: { cls: 'badge-resumed', label: '▶ RESUMED', btn: 'btn-danger', btnText: 'Request Deferral', showAlert: false },
      GRADUATED: { cls: 'badge-graduated', label: '🎓 GRADUATED', btn: 'btn-ghost', btnText: 'View Certificate', showAlert: false },
    };

    function updateStatusUI() {
      const cfg = statusConfig[currentStatus];
      ['status-badge', 'status-badge-2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.className = 'badge ' + cfg.cls; el.textContent = cfg.label; }
      });
      const btn = document.getElementById('defer-btn');
      if (btn) { btn.className = 'btn btn-sm ' + cfg.btn; btn.textContent = cfg.btnText; }
      const alertEl = document.getElementById('deferral-alert');
      if (alertEl) alertEl.style.display = cfg.showAlert ? 'block' : 'none';
      const pipelineMsg = document.getElementById('pipeline-locked-msg');
      const gateBtn = document.getElementById('gate-btn');
      if (pipelineMsg && gateBtn) {
        if (currentStatus === 'DEFERRED') { pipelineMsg.style.display = 'flex'; gateBtn.disabled = true; }
        else { pipelineMsg.style.display = 'none'; gateBtn.disabled = (currentStage > 10); }
      }
    }

    function requestDeferral() {
      currentStatus = currentStatus === 'DEFERRED' ? 'RESUMED' : 'DEFERRED';
      updateStatusUI();
    }

    function renderPipeline() {
      const p1El = document.getElementById('pipeline-p1');
      const p2El = document.getElementById('pipeline-p2');
      if (!p1El || !p2El) return;
      p1El.innerHTML = ''; p2El.innerHTML = '';
      for (let i = 1; i <= 10; i++) {
        const s = stageData[i - 1];
        let state = i < currentStage ? 'completed' : i === currentStage ? 'active' : 'locked';
        const el = document.createElement('div');
        el.className = 'pipeline-step ' + state;
        el.innerHTML = `<div class="step-circle ${state}">${state === 'completed' ? '✓' : i}</div><div class="step-label ${state === 'active' ? 'active-label' : state === 'completed' ? 'completed-label' : ''}">${s.label.replace('\n', '<br>')}</div>`;
        if (s.phase === 1) p1El.appendChild(el);
        else p2El.appendChild(el);
      }
      const pct = Math.round(((currentStage - 1) / 10) * 100);
      const progressFill = document.getElementById('pipeline-progress-fill');
      const progressText = document.getElementById('pipeline-progress-text');
      const currentBadge = document.getElementById('pipeline-current-badge');
      const bossStageNum = document.getElementById('boss-stage-num');
      const gateBtn = document.getElementById('gate-btn');
      if (progressFill) progressFill.style.width = pct + '%';
      if (progressText) progressText.innerHTML = `<strong>Stage ${Math.min(currentStage, 10)} of 10</strong> — ${stageData[Math.min(currentStage, 10) - 1].label.replace('\n', ' ')}`;
      if (currentBadge) currentBadge.textContent = currentStage > 10 ? '🎓 Completed' : `Stage ${currentStage} — Active`;
      const sd = stageData[Math.min(currentStage, 10) - 1];
      const sdCurrent = document.getElementById('sd-current');
      const sdApprover = document.getElementById('sd-approver');
      const sdPhase = document.getElementById('sd-phase');
      const sdNext = document.getElementById('sd-next');
      if (sdCurrent) sdCurrent.textContent = `Stage ${Math.min(currentStage, 10)}: ${sd.label.replace('\n', ' ')}`;
      if (sdApprover) sdApprover.textContent = sd.approver;
      if (sdPhase) sdPhase.textContent = sd.phase === 1 ? 'Phase 1 — Foundation' : 'Phase 2 — Research & Completion';
      if (sdNext) sdNext.textContent = sd.next;
      if (bossStageNum) bossStageNum.textContent = currentStage;
      checkBossLevel();
      if (gateBtn) { gateBtn.disabled = (currentStage > 10) || currentStatus === 'DEFERRED'; if (currentStage > 10) gateBtn.textContent = '🎓 All Stages Complete'; }
    }

    function advancePipeline() {
      if (currentStage >= 11 || currentStatus === 'DEFERRED') return;
      currentStage++;
      renderPipeline();
    }

    function checkBossLevel() {
      const locked = document.getElementById('boss-locked-overlay');
      const unlocked = document.getElementById('boss-unlocked');
      const icon = document.getElementById('boss-lock-icon');
      const sub = document.getElementById('boss-sub');
      const nacostiBadge = document.getElementById('nacosti-badge');
      if (currentStage >= 8) {
        if (locked) locked.style.display = 'none';
        if (unlocked) unlocked.style.display = 'block';
        if (icon) icon.textContent = '🔓';
        if (sub) sub.textContent = 'Stage 8 Unlocked — Upload all three required documents to proceed';
        if (nacostiBadge) { nacostiBadge.textContent = '✓'; nacostiBadge.className = 'nav-badge'; }
      } else {
        if (locked) locked.style.display = 'block';
        if (unlocked) unlocked.style.display = 'none';
        if (icon) icon.textContent = '🔒';
        if (sub) sub.innerHTML = `Unlocks at Pipeline Stage 8 — Currently at Stage <span id="boss-stage-num">${currentStage}</span>`;
        if (nacostiBadge) { nacostiBadge.textContent = 'S8'; nacostiBadge.className = 'nav-badge locked'; }
      }
    }

    // The old submitReport function is replaced by the override above
    // This function is kept for compatibility but won't cause page reload
    function oldSubmitReport() {
      reportSubmitted = true;
      const steps = [
        { id: 'wf-1', s: 'wf-1-s', cls: 'wf-active', status: 'Under Review', delay: 0 },
        { id: 'wf-1', s: 'wf-1-s', cls: 'wf-complete', status: 'Approved ✓', delay: 1200 },
        { id: 'wf-2', s: 'wf-2-s', cls: 'wf-active', status: 'Under Review', delay: 1400 },
        { id: 'wf-2', s: 'wf-2-s', cls: 'wf-complete', status: 'Approved ✓', delay: 2600 },
        { id: 'wf-3', s: 'wf-3-s', cls: 'wf-active', status: 'Processing…', delay: 2800 },
        { id: 'wf-3', s: 'wf-3-s', cls: 'wf-complete', status: 'Archived ✓', delay: 4000 },
      ];
      steps.forEach(step => {
        setTimeout(() => {
          const el = document.getElementById(step.id);
          if (el) el.className = 'wf-step ' + step.cls;
          const statusEl = document.getElementById(step.s);
          if (statusEl) statusEl.textContent = step.status;
        }, step.delay);
      });
    }

    function toggleUpload(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('uploaded');
      const statusEl = el.querySelector('.upload-status');
      const iconEl = el.querySelector('.upload-icon');
      if (el.classList.contains('uploaded')) {
        if (statusEl) statusEl.textContent = 'Uploaded — ' + new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        if (iconEl) iconEl.textContent = '✅';
      } else {
        if (statusEl) statusEl.textContent = 'Click to upload';
        if (iconEl) iconEl.textContent = el.id.includes('thesis') ? '📕' : el.id.includes('intent') ? '📝' : el.id.includes('mentor') ? '🤝' : '📄';
      }
    }

    function toggleCheck(itemEl) {
      if (!itemEl.classList.contains('check-item')) return;
      const cb = itemEl.querySelector('input[type="checkbox"]');
      if (cb) {
        cb.checked = !cb.checked;
        itemEl.classList.toggle('checked', cb.checked);
        updateCheckCount();
      }
    }

    function updateCheckCount() {
      const total = document.querySelectorAll('.check-item').length;
      const checked = document.querySelectorAll('.check-item.checked').length;
      const countEl = document.getElementById('check-count');
      if (countEl) countEl.textContent = checked;
      const btn = document.getElementById('signoff-btn');
      if (btn) btn.disabled = (checked < total);
    }

    function requestSignoff() {
      const alertEl = document.getElementById('signoff-alert');
      const btn = document.getElementById('signoff-btn');
      if (alertEl) alertEl.style.display = 'block';
      if (btn) { btn.disabled = true; btn.textContent = '✅ Sign-off Requested'; }
    }

    function toggleClearance() {
      clearanceGranted = !clearanceGranted;
      const display = document.getElementById('clearance-display');
      const statusVal = document.getElementById('erp-status-val');
      const finRow = document.getElementById('finance-row');
      const finBadge = document.getElementById('finance-row-badge');
      const finNavBadge = document.getElementById('finance-badge');
      if (!display || !statusVal) return;
      if (clearanceGranted) {
        display.className = 'clearance-card clearance-granted';
        display.innerHTML = `<div class="clearance-icon">✅</div><div class="clearance-status" style="color:var(--green);">Clearance Granted</div><div class="clearance-message" style="color:#065F46;">Your student finance account has been fully cleared. You are eligible to proceed with examination registration, thesis submission, and graduation application.</div><div class="alert alert-success" style="width:100%; text-align:left;"><span class="alert-icon">📋</span><div>Clearance certificate is available for download from the Finance Office or via the ERP Student Self-Service portal.</div></div>`;
        statusVal.innerHTML = '✅ Granted';
        if (finRow) finRow.style.background = 'var(--green-light)';
        if (finBadge) { finBadge.className = 'badge badge-active'; finBadge.textContent = 'Cleared'; }
        if (finNavBadge) finNavBadge.style.display = 'none';
      } else {
        display.className = 'clearance-card clearance-pending';
        display.innerHTML = `<div class="clearance-icon">⏳</div><div class="clearance-status" style="color:var(--amber);">Clearance Pending</div><div class="clearance-message" style="color:#92400E;">Clearance is pending due to an outstanding balance on your student account. Please contact the Finance Office to resolve this matter before your clearance can be granted.</div><div class="alert alert-error" style="width:100%; text-align:left;"><span class="alert-icon">📧</span><div>Contact Finance: <a href="mailto:finance@university.edu">finance@university.edu</a> — reference your registration number when writing.</div></div>`;
        statusVal.innerHTML = '⏳ Pending';
        if (finRow) finRow.style.background = 'var(--red-light)';
        if (finBadge) { finBadge.className = 'badge badge-deferred'; finBadge.textContent = 'Pending'; }
        if (finNavBadge) finNavBadge.style.display = 'inline-flex';
      }
    }

    // ===== INIT =====
    renderPipeline();
    updateStatusUI();

    // Initialize handlers
    const bookingHandler = new PresentationBookingHandler();
    window.bookingHandler = bookingHandler;

    const reportsHandler = new QuarterlyReportsHandler();
    window.reportsHandler = reportsHandler;

    // Export functions to global scope
    window.requestDeferral = requestDeferral;
    window.advancePipeline = advancePipeline;
    window.toggleUpload = toggleUpload;
    window.toggleCheck = toggleCheck;
    window.requestSignoff = requestSignoff;
    window.toggleClearance = toggleClearance;
  })();
});