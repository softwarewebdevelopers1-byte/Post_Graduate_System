const API_URL = 'http://localhost:5000/api';
let students = [];
let editingStudentId = null;

const STAGES = [
    "Coursework",
    "Concept Note (Department)",
    "Concept Note (School)",
    "Proposal (Department)",
    "Proposal (School)",
    "PG School Approval",
    "Fieldwork / NACOSTI",
    "Thesis Draft (Department)",
    "Thesis Draft (School)",
    "External Examination Submission",
    "Under External Examination",
    "Final Defence",
    "Graduation Clearance",
];

const stageMap = {
    'Coursework': 'Stage 1 — Registration & Induction',
    'Concept Note (Department)': 'Stage 2 — Concept Paper (Dept)',
    'Concept Note (School)': 'Stage 3 — Concept Paper (School)',
    'Proposal (Department)': 'Stage 4 — Proposal Defence (Dept)',
    'Proposal (School)': 'Stage 5 — Proposal Defence (School)',
    'PG School Approval': 'Stage 6 — PG Approval & Clearance',
    'Fieldwork / NACOSTI': 'Stage 7 — NACOSTI & Field Work',
    'Thesis Draft (Department)': 'Stage 8 — Thesis Writing (Dept)',
    'Thesis Draft (School)': 'Stage 9 — Thesis Writing (School)',
    'External Examination Submission': 'Stage 10 — External Submission',
    'Under External Examination': 'Stage 11 — External Review',
    'Final Defence': 'Stage 12 — Viva Voce / Defense',
    'Graduation Clearance': 'Stage 13 — Graduation Clearance'
};

const titles = {
    pipeline:'Global Pipeline Dashboard',
    enrollment:'Enrollment & Status Management',
    deferrals:'Deferral Tracking Registry',
    calendar:'Seminar Calendar Management',
    bookings:'Presentation Booking Review',
    nacosti:'NACOSTI Compliance Tracking'
};

/* Auth check */
async function checkAuth() {
    try {
        const res = await fetch(`${API_URL}/is-logged`, { credentials: 'include' });
        if (!res.ok) {
            window.location.href = '../login/login.html';
        }
    } catch (err) {
        console.error('Auth check failed', err);
    }
}

async function fetchStudents() {
    try {
        const res = await fetch(`${API_URL}/students`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch students');
        const data = await res.json();
        students = data.map(s => ({
            _id: s._id,
            name: s.fullName,
            id: s.userNumber.toUpperCase(),
            prog: s.programme === 'phd' ? 'PhD' : (s.programme === 'masters' ? 'Masters' : s.programme),
            dept: s.department.toUpperCase(),
            year: s.year || '',
            mentor: s.mentor || '',
            stage: s.stage || 'Coursework',
            full: stageMap[s.stage] || s.stage || 'Stage 1 — Registration & Induction',
            days: calculateDays(s.updatedAt || s.createdAt),
            status: (s.status || 'Active').toLowerCase(),
            nacosti: (s.documents?.nacosti || 'pending').toLowerCase(),
            supervisor: s.supervisors?.sup1 || '',
            supervisor2: s.supervisors?.sup2 || '',
            assignmentStatus: s.assignmentStatus || {},
            mentorship: s.documents?.mentorship || 'pending'
        }));
        renderAll();
        updateKPICards();
        fetchPresentations();
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

async function fetchPresentations() {
    try {
        const res = await fetch(`${API_URL}/presentations/admin/all`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch presentations');
        const data = await res.json();
        renderSlotReminderNotification(data.slotReminders || []);
        renderPresentations(data.bookings, data.slotReminders || []);
    } catch (err) {
        console.error('Presentations error:', err);
    }
}

function renderSlotReminderNotification(slotReminders = []) {
    const notification = document.getElementById('slotReminderNotification');
    const count = document.getElementById('slotReminderCount');
    const text = document.getElementById('slotReminderText');
    if (!notification || !count || !text) return;

    if (!slotReminders.length) {
        notification.style.display = 'none';
        return;
    }

    const latestReminder = slotReminders[0];
    notification.style.display = 'flex';
    count.textContent = `${slotReminders.length} active slot reminder${slotReminders.length === 1 ? '' : 's'}`;
    text.textContent = `${latestReminder.fullName} requested a slot for ${latestReminder.department}`;
    notification.title = `${latestReminder.fullName} (${latestReminder.owner}) requested a slot for ${latestReminder.department}. ${latestReminder.message || ''}`.trim();
}

async function fetchCalendarSlots() {
    try {
        const res = await fetch(`${API_URL}/slots/all`, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            renderSlots(data.slots);
        }
    } catch (err) { console.error('Slots error:', err); }
}

function calculateDays(dateStr) {
    if (!dateStr) return 0;
    const diff = new Date().getTime() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function updateKPICards() {
    const totalActive = students.filter(s => s.status === 'active' || s.status === 'resumed').length;
    const totalStalled = students.filter(s => s.days > 90 && s.status === 'active').length;
    const totalDeferred = students.filter(s => s.status === 'deferred').length;
    const totalCleared = students.filter(s => s.stage === 'Graduation').length;
    
    const cards = document.querySelectorAll('.kpi-card');
    if (cards[0]) cards[0].querySelector('.kpi-value').textContent = totalActive;
    if (cards[1]) cards[1].querySelector('.kpi-value').textContent = totalStalled;
    if (cards[2]) cards[2].querySelector('.kpi-value').textContent = totalDeferred;
    if (cards[3]) cards[3].querySelector('.kpi-value').textContent = totalCleared;
}

  /*  */
  /* PIPELINE TABLE RENDER                                              */
  /*  */
  function dayClass(days, status) {
    if (status === 'deferred' || status === 'graduated') return '';
    if (days > 90) return 'crit';
    if (days > 45) return 'warn';
    return '';
  }

  function renderRow(s) {
    const dc = dayClass(s.days, s.status);
    return `<tr data-name="${s.name.toLowerCase()}" data-id="${s.id.toLowerCase()}" data-prog="${s.prog}" data-dept="${s.dept}">
      <td><div class="s-name">${s.name}</div><div class="s-id">${s.id}</div></td>
      <td><span class="prog-pill ${s.prog==='PhD'?'phd':'msc'}">${s.prog}</span><div class="dept-tag">${s.dept}</div></td>
      <td><span style="font-family:var(--font-mono);font-size:12px;">${s.year || '—'}</span></td>
      <td><span class="stage-badge">${s.stage}</span><div style="font-size:10.5px;color:var(--text-3);margin-top:2px;">${s.full}</div></td>
      <td><span class="days-val ${dc}">${s.days}d</span></td>
      <td><span class="status ${s.status}">${s.status.toUpperCase()}</span></td>
      <td><div class="btn-gap">
        <button class="btn btn-ghost btn-sm" onclick="viewProfile('${s._id}', '${s.id}')">View</button>
        <button class="btn btn-outline btn-sm" onclick="editStudent('${s._id}')">Edit</button>
        <button class="btn btn-outline btn-sm" onclick="advanceStage('${s._id}', '${s.name.replace(/'/g,"\\'")}')">Advance</button>
      </div></td>
    </tr>`;
  }

  function renderAll() {
    const body = document.getElementById('pipelineBody');
    if (body) {
        body.innerHTML = students.map(renderRow).join('');
        updateCount();
    }
    renderDeferrals();
    renderNacosti();
  }

  function renderDeferrals() {
      const body = document.querySelector('#view-deferrals tbody');
      if (!body) return;
      const deferred = students.filter(s => s.status === 'deferred');
      body.innerHTML = deferred.map(s => `
        <tr>
            <td><div class="s-name">${s.name}</div><div class="s-id">${s.id}</div></td>
            <td><span class="prog-pill ${s.prog==='PhD'?'phd':'msc'}">${s.prog}</span><div class="dept-tag">${s.dept}</div></td>
            <td><span style="font-family:var(--font-mono);font-size:12px;">Recent</span></td>
            <td><span style="font-family:var(--font-mono);font-size:12px;color:var(--gold);font-weight:700;">Wait Review</span></td>
            <td><span class="status deferred">Study Break</span></td>
            <td><span class="stage-badge">${s.stage}</span></td>
            <td><button class="btn btn-success btn-sm" onclick="processResumption('${s._id}', '${s.name.replace(/'/g,"\\'")}')">Process Resumption</button></td>
        </tr>
      `).join('');
      
      const countEl = document.querySelector('#view-deferrals .card-title');
      if (countEl) countEl.innerHTML = `<div class="ct-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg></div> Active Deferrals — ${deferred.length} Students`;
  }

  function renderNacosti() {
      const body = document.querySelector('#view-nacosti tbody');
      if (!body) return;
      const candidates = students.filter(s => s.stage === 'Fieldwork');
      body.innerHTML = candidates.map(s => {
          const status = s.nacosti || 'pending';
          const nLabel = status === 'verified' ? 'Verified' : (status === 'exempted' ? 'Exempted' : 'Pending');
          const nCls   = status === 'verified' ? 'received' : (status === 'exempted' ? 'not-req' : 'pending');
          const pNo    = status === 'verified' ? 'P/26/' + Math.floor(10000 + Math.random() * 90000) : (status === 'exempted' ? 'N/A: Desk-based' : '—');
          
          return `
            <tr>
                <td><div class="s-name">${s.name}</div><div class="s-id">${s.id}</div></td>
                <td><span class="prog-pill ${s.prog==='PhD'?'phd':'msc'}">${s.prog}</span><div class="dept-tag">${s.dept}</div></td>
                <td><span style="font-family:var(--font-mono);font-size:12px;">Recent</span></td>
                <td><span class="status ${nCls}">${nLabel}</span></td>
                <td><span style="font-family:var(--font-mono);font-size:11px;color:var(--text-2);">${pNo}</span></td>
                <td class="btn-gap">
                    ${status === 'pending' ? `
                        <button class="btn btn-success btn-sm" onclick="verifyNacosti('${s._id}', '${s.name.replace(/'/g,"\\'")}')">Verify Upload</button>
                        <button class="btn btn-amber btn-sm" onclick="exemptNacosti('${s._id}', '${s.name.replace(/'/g,"\\'")}')">Mark Not Required</button>
                    ` : `<span style="font-size:11px;color:var(--text-3);font-style:italic;">Verified by Admin</span>`}
                </td>
            </tr>
          `;
      }).join('');
      
      const countEl = document.querySelector('.view#view-nacosti .card-count');
      const pendLen = candidates.filter(s => s.nacosti === 'pending').length;
      if (countEl) countEl.textContent = `${pendLen} students requiring review`;
  }

  function renderPresentations(bookings) {
      const list = document.querySelector('.pipeline-layout .card:last-child .card-body');
      if (!list) return;
      
      const upcoming = bookings.filter(b => ['pending', 'approved', 'confirmed'].includes(b.status)).slice(0, 5);
      if (upcoming.length === 0) {
          list.innerHTML = '<p style="padding:20px;text-align:center;color:var(--text-3);">No upcoming presentations scheduled.</p>';
          return;
      }
      
      list.innerHTML = upcoming.map(b => {
        const student = students.find(s => s.id === b.owner.toUpperCase());
        const dispName = student ? student.name : b.owner;
        const isPending = b.status === 'pending';
        const statusTone = (b.status === 'approved' || b.status === 'confirmed') ? 'ok' : 'pend';
        const topicHtml = b.additionalNotes
          ? `<div style="font-size:12px;color:var(--text-2);margin-top:6px;">Topic: ${b.additionalNotes}</div>`
          : '';
        const actionsHtml = isPending
          ? `<div class="btn-gap" style="margin-top:10px;">
                <button class="btn btn-success btn-sm" onclick="reviewBooking('${b._id}', 'approve')">Approve</button>
                <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="reviewBooking('${b._id}', 'reject')">Reject</button>
             </div>`
          : '';
        return `
          <div class="pres-item">
            <div class="pres-date">${b.preferredDate} · ${b.preferredTime}</div>
            <div class="pres-student">${dispName}</div>
            <div class="pres-meta"><span>${b.presentationType}</span><span>${b.venue}</span></div>
            ${topicHtml}
            <div class="pres-panel"><div class="panel-dot ${statusTone}"></div><span class="panel-label">Status: ${b.status.toUpperCase()}</span></div>
            ${actionsHtml}
          </div>
        `;
      }).join('');
  }

  function renderPresentationSummary(bookings) {
      const list = document.getElementById('dashboardPresentationSummary');
      if (!list) return;

      const upcoming = bookings.filter(b => ['pending', 'approved', 'confirmed'].includes(b.status)).slice(0, 5);
      if (upcoming.length === 0) {
          list.innerHTML = '<p style="padding:20px;text-align:center;color:var(--text-3);">No upcoming presentations scheduled.</p>';
          return;
      }

      list.innerHTML = upcoming.map(b => {
        const student = students.find(s => s.id === b.owner.toUpperCase());
        const dispName = student ? student.name : b.owner;
        const statusTone = (b.status === 'approved' || b.status === 'confirmed') ? 'ok' : 'pend';
        return `
          <div class="pres-item">
            <div class="pres-date">${b.preferredDate} · ${b.preferredTime}</div>
            <div class="pres-student">${dispName}</div>
            <div class="pres-meta"><span>${b.presentationType}</span><span>${b.venue}</span></div>
            <div class="pres-panel"><div class="panel-dot ${statusTone}"></div><span class="panel-label">Status: ${b.status.toUpperCase()}</span></div>
          </div>
        `;
      }).join('');
  }

  function renderBookingReviewPage(bookings, slotReminders = []) {
      const list = document.getElementById('bookingReviewList');
      const countEl = document.getElementById('bookingCount');
      if (!list) return;

      const reviewable = bookings.filter(b => ['pending', 'approved', 'confirmed', 'rejected', 'cancelled'].includes(b.status));
      if (countEl) countEl.textContent = `${reviewable.length} bookings · ${slotReminders.length} slot reminders`;

      const reminderCards = slotReminders.map(reminder => `
        <div class="pres-item" style="margin-bottom:14px;border-left:4px solid #f59e0b;">
          <div class="pres-date">Slot Reminder · ${new Date(reminder.createdAt).toLocaleString()}</div>
          <div class="pres-student">${reminder.fullName}</div>
          <div class="pres-meta"><span>${reminder.programme}</span><span>${reminder.department}</span></div>
          <div style="font-size:12px;color:var(--text-2);margin-top:6px;">Student ID: ${reminder.owner}</div>
          <div style="margin-top:8px;padding:10px 12px;border-radius:10px;background:#fff7ed;border:1px solid #fdba74;font-size:12px;color:#9a3412;">
            <strong>Requested:</strong> ${reminder.message}
            <div style="margin-top:4px;color:#c2410c;">Expires: ${new Date(reminder.expiresAt).toLocaleString()}</div>
          </div>
        </div>
      `).join('');

      if (reviewable.length === 0 && slotReminders.length === 0) {
          list.innerHTML = '<p style="padding:20px;text-align:center;color:var(--text-3);">No booking requests found.</p>';
          return;
      }

      const bookingCards = reviewable.map(b => {
        const student = students.find(s => s.id === b.owner.toUpperCase());
        const dispName = student ? student.name : b.owner;
        const isPending = b.status === 'pending';
        const statusTone = (b.status === 'approved' || b.status === 'confirmed') ? 'ok' : (b.status === 'rejected' || b.status === 'cancelled' ? 'crit' : 'pend');
        const topicHtml = b.additionalNotes
          ? `<div style="font-size:12px;color:var(--text-2);margin-top:6px;">Topic: ${b.additionalNotes}</div>`
          : '<div style="font-size:12px;color:var(--text-3);margin-top:6px;">Topic: Not provided</div>';
        const actionsHtml = isPending
          ? `<div class="btn-gap" style="margin-top:10px;">
                <button class="btn btn-success btn-sm" onclick="reviewBooking('${b._id}', 'approve')">Approve</button>
                <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="reviewBooking('${b._id}', 'reject')">Reject</button>
             </div>`
          : '';
        const reminderHtml = b.reminderRequestedAt
          ? `<div style="margin-top:8px;padding:10px 12px;border-radius:10px;background:#fff7ed;border:1px solid #fdba74;font-size:12px;color:#9a3412;">
               <strong>Student Reminder:</strong> ${b.reminderMessage || 'Student requested admin follow-up for this booking.'}
               <div style="margin-top:4px;color:#c2410c;">Sent: ${new Date(b.reminderRequestedAt).toLocaleString()}</div>
             </div>`
          : '';
        const reasonHtml = b.cancellationReason
          ? `<div style="font-size:12px;color:var(--red);margin-top:6px;">Reason: ${b.cancellationReason}</div>`
          : '';
        return `
          <div class="pres-item" style="margin-bottom:14px;">
            <div class="pres-date">${b.preferredDate} · ${b.preferredTime}</div>
            <div class="pres-student">${dispName}</div>
            <div class="pres-meta"><span>${b.presentationType}</span><span>${b.venue}</span></div>
            ${topicHtml}
            <div style="font-size:12px;color:var(--text-2);margin-top:6px;">Requested: ${new Date(b.createdAt).toLocaleString()}</div>
            <div class="pres-panel"><div class="panel-dot ${statusTone}"></div><span class="panel-label">Status: ${b.status.toUpperCase()}</span></div>
            ${reminderHtml}
            ${reasonHtml}
            ${actionsHtml}
          </div>
        `;
      }).join('');

      list.innerHTML = `${reminderCards}${bookingCards}`;
  }

  renderPresentations = function(bookings, slotReminders = []) {
      renderPresentationSummary(bookings);
      renderBookingReviewPage(bookings, slotReminders);
  };

  function renderSlots(slots) {
      const list = document.getElementById('slotList');
      if (!list) return;
      if (slots.length === 0) {
          list.innerHTML = '<p style="padding:40px;text-align:center;color:var(--text-3);">No scheduled seminar slots found.</p>';
          return;
      }
      list.innerHTML = slots.map(s => {
          const d = new Date(s.date);
          const day = String(d.getDate()).padStart(2,'0');
          const mon = d.toLocaleString('default', {month:'short'});
          const filled = s.presenters.length;
          const statusCls = s.status === 'Open' ? 'active' : (s.status === 'Full' ? 'resumed' : 'deferred');
          const statusLab = s.status === 'Open'
            ? `${filled}/${s.maxPresenters} Booked`
            : (s.status === 'Full' ? `${filled}/${s.maxPresenters} Filled` : 'Closed');
          
          return `
            <div class="slot-item">
              <div class="slot-date-blk"><div class="slot-day">${day}</div><div class="slot-mon">${mon}</div></div>
              <div class="slot-info">
                  <div class="slot-time">${s.startTime} – ${s.endTime}</div>
                  <div class="slot-level">${s.level} Seminar</div>
                  <div class="slot-venue">${s.venue} · ${s.department}</div>
              </div>
              <div style="text-align:right;">
                  <span class="status ${statusCls}">${statusLab}</span>
                  <div class="btn-gap" style="margin-top:8px;">
                      <button class="btn btn-ghost btn-sm" onclick="toggleSlotStatus('${s._id}')">${s.status==='Closed'?'Open':'Close'}</button>
                      <button class="btn btn-ghost btn-sm" style="color:var(--red);" onclick="deleteSlot('${s._id}')">Delete</button>
                  </div>
              </div>
            </div>
          `;
      }).join('');
  }

  function updateCount() {
    const rows = document.querySelectorAll('#pipelineBody tr');
    let v = 0;
    rows.forEach(r => { if (r.style.display !== 'none') v++; });
    const countEl = document.getElementById('rowCount');
    if (countEl) countEl.textContent = `Showing ${v} of ${students.length} students`;
  }
  
  function applyFilters() {
    const q    = document.getElementById('searchInput').value.toLowerCase().trim();
    const prog = document.getElementById('progFilter').value;
    const dept = document.getElementById('deptFilter').value;
    document.querySelectorAll('#pipelineBody tr').forEach(row => {
      const ok = (!q    || row.dataset.name.includes(q) || row.dataset.id.includes(q))
              && (!prog || row.dataset.prog === prog)
              && (!dept || row.dataset.dept === dept);
      row.style.display = ok ? '' : 'none';
    });
    updateCount();
  }
  
  const si = document.getElementById('searchInput');
  if (si) {
    si.addEventListener('input', applyFilters);
    document.getElementById('progFilter').addEventListener('change', applyFilters);
    document.getElementById('deptFilter').addEventListener('change', applyFilters);
  }
  
  function exportDeferrals() {
    const deferred = students.filter(s => s.status === 'deferred');
    if (deferred.length === 0) {
        alert('No deferred students to export.');
        return;
    }
    let csv = 'Full Name,Reg Number,Programme,Department,Current Stage,Days at Stage\n';
    deferred.forEach(s => {
        csv += `"${s.name}","${s.id}","${s.prog}","${s.dept}","${s.stage}","${s.days}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `deferral_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /*  */
  /* FORM HANDLERS                                                      */
  /*  */
  async function handleEnrollment() {
    const name = document.getElementById('enroll-name').value.trim();
    const reg  = document.getElementById('enroll-reg').value.trim();
    const prog = document.getElementById('enroll-prog').value;
    const dept = document.getElementById('enroll-dept').value;
    if (!name || !reg || !prog || !dept) { alert('⚠️  Fields required.'); return; }

    try {
        const res = await fetch(`${API_URL}/user/signUp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullName: name, userNumber: reg, password: 'student123',
                programme: prog.toLowerCase(), department: dept.toLowerCase(), role: 'student'
            })
        });
        if (res.ok) { alert('✅ Student Enrolled!'); clearEnrollForm(); fetchStudents(); }
        else { const err = await res.json(); alert('❌ ' + err.message); }
    } catch (err) { alert('❌ Network error.'); }
  }

  function clearEnrollForm() {
    ['enroll-name','enroll-reg','enroll-sup','enroll-date','enroll-title'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('enroll-prog').value = '';
    document.getElementById('enroll-dept').value = '';
  }
  
  const ssi = document.getElementById('status-search');
  if (ssi) {
    ssi.addEventListener('input', function() {
        const q = this.value.toLowerCase().trim();
        const resEl = document.getElementById('status-results');
        if (q.length < 2) { resEl.style.display = 'none'; return; }
        const found = students.find(s => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
        if (found) {
          resEl.style.display = 'block';
          resEl.dataset.foundId = found._id;
          document.getElementById('status-found-name').textContent = found.name;
          document.getElementById('status-found-meta').textContent = `${found.id} · ${found.prog} · ${found.dept}`;
          const sc = document.getElementById('status-current');
          sc.className = 'status ' + found.status;
          sc.textContent = found.status.toUpperCase();
        } else {
          resEl.style.display = 'none';
        }
      });
  }

  async function handleStatusUpdate() {
    const resEl = document.getElementById('status-results');
    const studentId = resEl.dataset.foundId;
    if (!studentId || resEl.style.display === 'none') { alert('⚠️  Search for student.'); return; }
    
    const ns = document.getElementById('new-status').value;
    const reason = document.getElementById('status-reason').value;

    try {
        const res = await fetch(`${API_URL}/students/${studentId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: ns, reason })
        });
        if (res.ok) {
            alert('✅ Status Updated!');
            clearStatusForm();
            fetchStudents();
        }
    } catch (err) { alert('❌ Error.'); }
  }

  function clearStatusForm() {
      document.getElementById('status-search').value = '';
      document.getElementById('status-results').style.display = 'none';
      document.getElementById('status-reason').value = '';
      document.getElementById('new-status').value = 'Active';
  }

  async function advanceStage(id, name) {
      const current = students.find(s => s._id === id);
      const currentIndex = STAGES.indexOf(current.stage);
      const nextStage = STAGES[currentIndex + 1];
      if (!nextStage) { alert('Student has reached final stage.'); return; }

      if (confirm(`Advance ${name} to ${nextStage}?`)) {
          try {
              const res = await fetch(`${API_URL}/students/${id}/stage`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ stage: nextStage })
              });
              if (res.ok) { alert('✅ Pipeline advanced.'); fetchStudents(); }
          } catch (err) { alert('❌ Error.'); }
      }
  }
  
  async function processResumption(id, name) {
    if (confirm(`Process resumption for ${name}?`)) {
        try {
            const res = await fetch(`${API_URL}/students/${id}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'Active' })
            });
            if (res.ok) { alert(`✅ Resumption processed.`); fetchStudents(); }
        } catch (err) { alert('❌ Network error.'); }
    }
  }

  async function verifyNacosti(id, name) {
      if (confirm(`Verify NACOSTI Permit for ${name}?`)) {
          try {
              const res = await fetch(`${API_URL}/students/${id}/documents`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ type: 'nacosti', status: 'verified' })
              });
              if (res.ok) { alert('✅ NACOSTI Permit Verified.'); fetchStudents(); }
          } catch (err) { console.error(err); }
      }
  }

  async function exemptNacosti(id, name) {
      if (confirm(`Grant NACOSTI exemption for ${name}?`)) {
          try {
              const res = await fetch(`${API_URL}/students/${id}/documents`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ type: 'nacosti', status: 'exempted' })
              });
              if (res.ok) { alert('✅ Student exempted.'); fetchStudents(); }
          } catch (err) { console.error(err); }
      }
  }

  async function addSlot() {
    const date  = document.getElementById('slot-date').value;
    const start = document.getElementById('slot-start').value;
    const end   = document.getElementById('slot-end').value;
    const level = document.getElementById('slot-level').value;
    const venue = document.getElementById('slot-venue').value || 'TBC';
    const dept  = document.getElementById('slot-dept').value;
    const max   = document.getElementById('slot-max').value || 3;
    if (!date || !start || !end) { alert('⚠️  Date and Time are required.'); return; }

    try {
        const res = await fetch(`${API_URL}/slots/admin/create`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date, startTime: start, endTime: end, level, venue, department: dept, maxPresenters: max
            })
        });
        if (res.ok) { alert('✅ Seminar Slot Added!'); clearSlotForm(); fetchCalendarSlots(); }
    } catch (err) { alert('❌ Error adding slot.'); }
  }

  async function toggleSlotStatus(id) {
      try {
          const res = await fetch(`${API_URL}/slots/${id}/status`, { method: 'PATCH', credentials: 'include' });
          if (res.ok) { fetchCalendarSlots(); }
      } catch (err) { console.error(err); }
  }

  async function deleteSlot(id) {
    if (confirm('Permanently delete this seminar slot?')) {
        try {
            const res = await fetch(`${API_URL}/slots/${id}`, { method: 'DELETE', credentials: 'include' });
            if (res.ok) { fetchCalendarSlots(); }
        } catch (err) { console.error(err); }
    }
  }

  async function reviewBooking(id, action) {
    const isApprove = action === 'approve';
    let reason = '';

    if (!isApprove) {
        reason = prompt('Reason for rejecting this booking:', 'Rejected by admin') || '';
        if (!reason.trim()) return;
    }

    if (!confirm(`Are you sure you want to ${isApprove ? 'approve' : 'reject'} this booking request?`)) return;

    try {
        const res = await fetch(`${API_URL}/presentations/admin/${id}/review`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, reason })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Failed to review booking');
        alert(isApprove ? '✅ Booking approved.' : '✅ Booking rejected.');
        fetchPresentations();
        fetchCalendarSlots();
    } catch (err) {
        alert(`❌ ${err.message || 'Error reviewing booking.'}`);
    }
  }

  function clearSlotForm() {
    ['slot-date','slot-start','slot-end','slot-venue','slot-max'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
  }
  
  async function handleLogout() {
      try {
          await fetch(`${API_URL}/user/login/logout`, { method: 'POST', credentials: 'include' });
      } catch (err) {
          console.error('Logout failed:', err);
      } finally {
          localStorage.removeItem('postgraduate_user');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('userToken');
          sessionStorage.removeItem('postgraduate_user');
          sessionStorage.removeItem('auth_token');
          sessionStorage.removeItem('userToken');
          sessionStorage.clear();
          window.location.replace('../login/login.html');
      }
  }

  const lib = document.getElementById('logoutBtn');
  if (lib) lib.addEventListener('click', handleLogout);

  function viewProfile(dbId, regNo) {
      const s = students.find(x => x._id === dbId);
      if (!s) return;
      alert(`STUDENT PROFILE: ${s.name}\n\nRegistration: ${s.id}\nProgramme: ${s.prog}\nDepartment: ${s.dept}\nCurrent Stage: ${s.stage}\nDays at Stage: ${s.days}d\nNACOSTI Status: ${s.nacosti.toUpperCase()}`);
  }
  
  /* SPA NAVIGATION */
  const itms = document.querySelectorAll('.nav-item');
  itms.forEach(it => {
    it.addEventListener('click', () => {
      const v = it.dataset.view;
      itms.forEach(n => n.classList.remove('active'));
      it.classList.add('active');
      document.querySelectorAll('.view').forEach(s => s.classList.remove('active'));
      document.getElementById('view-' + v).classList.add('active');
      document.getElementById('topbarTitle').innerHTML = titles[v] + '<span>Rongo University</span>';
    });
  });

  /* TOPBAR DATE */
  (function(){
    const d = new Date();
    const el = document.getElementById('topbarDate');
    if (el) el.textContent = d.toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
  })();

  async function handleEnrollment() {
    const name = document.getElementById('enroll-name').value.trim();
    const reg  = document.getElementById('enroll-reg').value.trim();
    const prog = document.getElementById('enroll-prog').value;
    const dept = document.getElementById('enroll-dept').value;
    const year = document.getElementById('enroll-year').value.trim();
    const mentor = document.getElementById('enroll-mentor').value.trim();
    const supervisor = document.getElementById('enroll-sup').value.trim();
    const supervisor2 = document.getElementById('enroll-sup2').value.trim();
    if (!name || !reg || !prog || !dept || !year) { alert('Fields required.'); return; }

    try {
        const res = await fetch(editingStudentId ? `${API_URL}/students/${editingStudentId}` : `${API_URL}/user/signUp`, {
            method: editingStudentId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullName: name,
                userNumber: reg,
                password: 'student123',
                programme: prog.toLowerCase(),
                department: dept.toLowerCase(),
                role: 'student',
                year,
                mentor,
                supervisor,
                supervisor2,
                supervisors: { sup1: supervisor }
            })
        });
        if (res.ok) {
            alert(editingStudentId ? 'Student details updated!' : 'Student Enrolled!');
            clearEnrollForm();
            fetchStudents();
        } else {
            const err = await res.json();
            alert(err.message || 'Request failed');
        }
    } catch (err) {
        alert('Network error.');
    }
  }

  function clearEnrollForm() {
    ['enroll-name','enroll-reg','enroll-year','enroll-mentor','enroll-sup','enroll-sup2','enroll-date','enroll-title'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('enroll-prog').value = '';
    document.getElementById('enroll-dept').value = '';
    editingStudentId = null;
    const actionLabel = document.getElementById('enrollActionLabel');
    if (actionLabel) actionLabel.textContent = 'Complete Registration';
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.style.display = 'none';
  }

  function editStudent(id) {
    const student = students.find(s => s._id === id);
    if (!student) return;

    editingStudentId = id;
    document.getElementById('enroll-name').value = student.name || '';
    document.getElementById('enroll-reg').value = student.id || '';
    document.getElementById('enroll-prog').value = student.prog || '';
    document.getElementById('enroll-dept').value = student.dept || '';
    document.getElementById('enroll-year').value = student.year || '';
    document.getElementById('enroll-mentor').value = student.mentor || '';
    document.getElementById('enroll-sup').value = student.supervisor || '';
    document.getElementById('enroll-sup2').value = student.supervisor2 || '';

    const actionLabel = document.getElementById('enrollActionLabel');
    if (actionLabel) actionLabel.textContent = 'Update Student Details';
    const cancelBtn = document.getElementById('cancelEditBtn');
    if (cancelBtn) cancelBtn.style.display = 'inline-flex';
    document.getElementById('view-enrollment')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEditStudent() {
    clearEnrollForm();
  }

  function viewProfile(dbId, regNo) {
      const s = students.find(x => x._id === dbId);
      if (!s) return;
      alert(`STUDENT PROFILE: ${s.name}\n\nRegistration: ${s.id}\nProgramme: ${s.prog}\nDepartment: ${s.dept}\nYear: ${s.year || 'Not set'}\nMentor: ${s.mentor || 'Not assigned'}\nMentorship Status: ${String(s.mentorship || 'pending').toUpperCase()}\nSupervisor 1: ${s.supervisor || 'Not assigned'} (${String(s.assignmentStatus?.sup1 || 'pending').toUpperCase()})\nSupervisor 2: ${s.supervisor2 || 'Not assigned'} (${String(s.assignmentStatus?.sup2 || 'pending').toUpperCase()})\nCurrent Stage: ${s.stage}\nDays at Stage: ${s.days}d\nNACOSTI Status: ${s.nacosti.toUpperCase()}`);
  }
  
  /* INIT */
  checkAuth();
  fetchStudents();
  fetchPresentations();
  fetchCalendarSlots();
