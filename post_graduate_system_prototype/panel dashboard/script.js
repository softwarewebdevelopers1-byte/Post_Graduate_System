/* ── Student data ──────────────────────────────────────── */
const students = [
    { name: 'Enos Mulongo',   initials: 'EM', reg: 'GCA/012/2023', univ: 'Rongo University',  stage: 'Stage 3: Proposal Dept.' },
    { name: 'Amara Osei',     initials: 'AO', reg: 'GCA/047/2022', univ: 'UoN Nairobi',       stage: 'Stage 2: Concept Paper'   },
    { name: 'Fatuma Wanjiku', initials: 'FW', reg: 'GCA/089/2021', univ: 'Kenyatta University',stage: 'Stage 4: Final Defense'   },
    { name: 'Kevin Otieno',   initials: 'KO', reg: 'GCA/003/2024', univ: 'Maseno University', stage: 'Stage 1: Title Approval'  },
  ];
  
  let activeStudent = 0;
  let verdict = null;
  
  function _loadStudentBase(idx) {
    activeStudent = idx;
    const s = students[idx];
    document.getElementById('studentAvatar').textContent = s.initials;
    document.getElementById('studentName').textContent   = s.name;
    document.getElementById('studentReg').textContent    = s.reg;
    document.getElementById('studentUniv').textContent   = s.univ;
    document.getElementById('studentStage').textContent  = s.stage;
    document.querySelectorAll('.queue-item').forEach((el, i) => el.classList.toggle('active', i === idx));
    resetForm();
    // reset upload
    document.getElementById('uploadStatus').classList.remove('show');
    document.getElementById('correctionsSection').style.display = 'none';
    showToast(`Loaded: ${s.name}`, 'success');
  }
  
  /* ── Auto-scoring ──────────────────────────────────────── */
  function calcScore() {
    // Update slider labels
    ['lit1','lit2','meth1','meth2'].forEach(id => {
      const val = document.getElementById('s_' + id).value;
      document.getElementById('v_' + id).textContent = val;
    });
  
    const litSlider  = (+document.getElementById('s_lit1').value  + +document.getElementById('s_lit2').value)  / 2; // 0-10
    const methSlider = (+document.getElementById('s_meth1').value + +document.getElementById('s_meth2').value) / 2; // 0-10
  
    let litCheck = 0, methCheck = 0;
    document.querySelectorAll('#litChecks  input[type=checkbox]:checked').forEach(cb => litCheck  += +cb.dataset.pts);
    document.querySelectorAll('#methChecks input[type=checkbox]:checked').forEach(cb => methCheck += +cb.dataset.pts);
  
    // Max: slider 10pts + checks 20pts = 30 pts each section
    const litRaw  = litSlider  + litCheck;   // 0-30
    const methRaw = methSlider + methCheck;  // 0-30
    const litPct  = Math.round((litRaw  / 30) * 100);
    const methPct = Math.round((methRaw / 30) * 100);
    const total   = Math.round((litPct + methPct) / 2);
  
    document.getElementById('scorePct').textContent  = total + '%';
    document.getElementById('barLit').style.width    = litPct  + '%';
    document.getElementById('barMeth').style.width   = methPct + '%';
    document.getElementById('litPct').textContent    = litPct  + '%';
    document.getElementById('methPct').textContent   = methPct + '%';
  
    // Color the circle
    const circle = document.getElementById('scoreCircle');
    const pctEl  = document.getElementById('scorePct');
    let col;
    if (total >= 70) { col = 'var(--green)'; }
    else if (total >= 50) { col = 'var(--amber)'; }
    else { col = 'var(--red)'; }
    circle.style.borderColor = col;
    pctEl.style.color        = col;
  }
  
  function setVerdict(v) {
    verdict = v;
    document.getElementById('btnPass').classList.toggle('active', v === 'pass');
    document.getElementById('btnFail').classList.toggle('active', v === 'fail');
    document.getElementById('verdictNote').textContent = v === 'pass' ? 'Student recommended for advancement.' : 'Student recommended for revision.';
  }
  
  function submitAssessment() {
    if (!verdict) { showToast('Please select Pass or Fail before submitting.', 'error'); return; }
    showToast(`Assessment for ${students[activeStudent].name} submitted successfully!`, 'success');
    setTimeout(() => document.getElementById('btnPass').classList.remove('active'), 1800);
    setTimeout(() => document.getElementById('btnFail').classList.remove('active'), 1800);
    verdict = null;
    document.getElementById('verdictNote').textContent = '';
  }
  
  function resetForm() {
    ['s_lit1','s_lit2','s_meth1','s_meth2'].forEach(id => { document.getElementById(id).value = 0; });
    document.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
    document.querySelectorAll('.comment-area').forEach(ta => ta.value = '');
    verdict = null;
    document.getElementById('btnPass').classList.remove('active');
    document.getElementById('btnFail').classList.remove('active');
    document.getElementById('verdictNote').textContent = '';
    calcScore();
  }
  
  /* ── Upload & Corrections ──────────────────────────────── */
  const corrections = {
    critical: [
      { id: 'c1', source: 'Panel Chair (pg. 4)', text: 'The theoretical framework is absent. The student must clearly state and justify the theoretical underpinning of the study before resubmission.' },
      { id: 'c2', source: 'Prof. Wanjala (pg. 7)', text: 'Research objectives and research questions are misaligned — Objective 3 has no corresponding research question. This is a fundamental structural flaw.' },
    ],
    major: [
      { id: 'm1', source: 'Dr. Achieng (pg. 5)',  text: 'Population sampling methodology lacks justification. Purposive sampling is applied but no rationale for sample size is provided.' },
      { id: 'm2', source: 'Prof. Wanjala (pg. 9)', text: 'Literature from 2005–2010 cited extensively. Student must update with sources from the past 10 years to reflect current scholarly discourse.' },
      { id: 'm3', source: 'Panel Chair (pg. 12)',  text: 'Data analysis plan mentions both SPSS and NVivo but the study is purely quantitative. Clarify the mixed-methods approach or remove NVivo reference.' },
    ],
    minor: [
      { id: 'n1', source: 'Dr. Achieng (pg. 2)',  text: 'Abstract exceeds the required 300-word limit (current: 412 words). Revise and condense to highlight only key elements.' },
      { id: 'n2', source: 'Peer Reviewer',         text: 'Inconsistent citation style detected — APA 7th edition guidelines not uniformly applied. Run a citation audit before final submission.' },
    ],
  };
  
  const correctionStates = {}; // id → 'approved' | 'rejected' | null
  
  function renderCorrections() {
    ['critical','major','minor'].forEach(urgency => {
      const container = document.getElementById('corrections-' + urgency);
      container.innerHTML = '';
      corrections[urgency].forEach(c => {
        const state = correctionStates[c.id] || null;
        const div = document.createElement('div');
        div.className = 'correction-item' + (state ? ' ' + state : '');
        div.id = 'item-' + c.id;
  
        const icon = urgency === 'critical' ? '⚠' : urgency === 'major' ? '▲' : '✓';
        const statusHtml = state
          ? `<span class="ci-status ${state}">${state}</span>`
          : `<button class="ci-btn approve" onclick="approveCorrection('${c.id}')">Approve</button>
             <button class="ci-btn edit"    onclick="editCorrection('${c.id}')">Edit</button>
             <button class="ci-btn reject"  onclick="rejectCorrection('${c.id}')">Reject</button>`;
  
        div.innerHTML = `
          <div class="correction-icon ${urgency}">${icon}</div>
          <div class="ci-body">
            <div class="ci-source">${c.source}</div>
            <div class="ci-text" id="text-${c.id}">${c.text}</div>
            <div class="ci-edit-form" id="edit-${c.id}">
              <input class="ci-edit-input" id="inp-${c.id}" value="${c.text}" />
              <div style="display:flex;gap:8px;margin-top:8px;">
                <button class="ci-btn save" onclick="saveEdit('${c.id}')">Save</button>
                <button class="ci-btn edit" onclick="cancelEdit('${c.id}')">Cancel</button>
              </div>
            </div>
            <div class="ci-actions">${statusHtml}</div>
          </div>`;
        container.appendChild(div);
      });
    });
    updatePublishSummary();
  }
  
  function approveCorrection(id) {
    correctionStates[id] = 'approved';
    renderCorrections();
    showToast('Correction approved.', 'success');
  }
  function rejectCorrection(id) {
    correctionStates[id] = 'rejected';
    renderCorrections();
    showToast('Correction rejected.', 'error');
  }
  function editCorrection(id) {
    const item = document.getElementById('item-' + id);
    item.classList.add('editing');
    document.getElementById('inp-' + id).focus();
  }
  function saveEdit(id) {
    const val = document.getElementById('inp-' + id).value.trim();
    if (!val) return;
    // Update all urgency lists
    ['critical','major','minor'].forEach(u => {
      const c = corrections[u].find(x => x.id === id);
      if (c) { c.text = val; }
    });
    renderCorrections();
    showToast('Correction updated.', 'success');
  }
  function cancelEdit(id) {
    document.getElementById('item-' + id).classList.remove('editing');
  }
  function updatePublishSummary() {
    const all = Object.entries(correctionStates);
    const approved = all.filter(([,v]) => v === 'approved').length;
    const rejected = all.filter(([,v]) => v === 'rejected').length;
    const total = corrections.critical.length + corrections.major.length + corrections.minor.length;
    document.getElementById('publishSummary').textContent =
      `${approved} approved, ${rejected} rejected, ${total - all.length} pending review.`;
  }
  function publishCorrections() {
    const all = Object.values(correctionStates);
    const approved = all.filter(v => v === 'approved').length;
    if (approved === 0) { showToast('Approve at least one correction before publishing.', 'error'); return; }
    showToast(`${approved} correction(s) published to ${students[activeStudent].name}'s portal!`, 'success');
  }
  
  function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl   = document.getElementById('uploadStatus');
    const statusText = document.getElementById('uploadStatusText');
    statusText.textContent = `Processing "${file.name}" with AI…`;
    statusEl.style.background = 'var(--amber-lt)';
    statusEl.style.color      = 'var(--amber)';
    statusEl.classList.add('show');
    setTimeout(() => {
      statusText.textContent = `"${file.name}" processed — ${corrections.critical.length + corrections.major.length + corrections.minor.length} corrections extracted.`;
      statusEl.style.background = 'var(--green-lt)';
      statusEl.style.color      = 'var(--green)';
      Object.keys(correctionStates).forEach(k => delete correctionStates[k]);
      renderCorrections();
      document.getElementById('correctionsSection').style.display = 'block';
      showToast('AI extraction complete!', 'success');
    }, 1800);
  }
  
  /* ── Notification Bell ─────────────────────────────────── */
  document.getElementById('notifBtn').addEventListener('click', () => {
    showToast('3 upcoming seminars this week. Next: Mon 23 Jun at 09:00 AM.', '');
    document.getElementById('notifDot').style.display = 'none';
  });
  
  /* ── Toast ─────────────────────────────────────────────── */
  let toastTimer;
  function showToast(msg, type = '') {
    clearTimeout(toastTimer);
    const t = document.getElementById('toast');
    t.className = 'toast' + (type ? ' ' + type : '');
    document.getElementById('toastMsg').textContent = msg;
    t.classList.add('show');
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }
  
  /* ── Mobile sidebar toggle ─────────────────────────────── */
  function toggleSidebar() {
    const sidebar  = document.querySelector('.sidebar');
    const overlay  = document.getElementById('sidebarOverlay');
    const hamburger = document.getElementById('hamburgerBtn');
    const isOpen   = sidebar.classList.contains('open');
    if (isOpen) { closeSidebar(); }
    else {
      sidebar.classList.add('open');
      overlay.classList.add('show');
      hamburger.classList.add('open');
      // On mobile tab mode, switch to queue view
      if (window.innerWidth <= 600) mobileTab('queue', true);
    }
  }
  function closeSidebar() {
    document.querySelector('.sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
    document.getElementById('hamburgerBtn').classList.remove('open');
  }
  
  /* ── Mobile bottom tab navigation ─────────────────────── */
  let currentTab = 'queue';
  function mobileTab(tab, fromHamburger = false) {
    if (window.innerWidth > 600) return;
    currentTab = tab;
  
    // Update bottom nav active state
    document.querySelectorAll('.mbn-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('mbn-' + tab);
    if (btn) btn.classList.add('active');
  
    const rubricCard  = document.querySelector('.card:nth-of-type(1)');
    const aiCard      = document.querySelector('.card:nth-of-type(2)');
    const studentHdr  = document.getElementById('studentHeader');
  
    if (tab === 'queue') {
      // Open sidebar drawer
      if (!fromHamburger) toggleSidebar();
      if (rubricCard)  rubricCard.style.display  = 'block';
      if (aiCard)      aiCard.style.display      = 'block';
      if (studentHdr)  studentHdr.style.display  = 'flex';
    } else {
      closeSidebar();
      if (tab === 'assess') {
        if (rubricCard)  rubricCard.style.display  = 'block';
        if (aiCard)      aiCard.style.display      = 'none';
        if (studentHdr)  studentHdr.style.display  = 'flex';
        rubricCard && rubricCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (tab === 'ai') {
        if (rubricCard)  rubricCard.style.display  = 'none';
        if (aiCard)      aiCard.style.display      = 'block';
        if (studentHdr)  studentHdr.style.display  = 'flex';
        aiCard && aiCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
  
  // When a student is loaded on mobile, switch to assess tab
  function loadStudent(idx) {
    _loadStudentBase(idx);
    closeSidebar();
    if (window.innerWidth <= 600) {
      mobileTab('assess');
      document.getElementById('mbn-assess').classList.add('active');
      document.getElementById('mbn-queue').classList.remove('active');
    }
  }
  
  /* ── Init ──────────────────────────────────────────────── */
  loadStudent(0);
  calcScore();