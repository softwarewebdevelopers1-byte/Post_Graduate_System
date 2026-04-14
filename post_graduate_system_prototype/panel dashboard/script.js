/* ── Backend Integration ────────────────────────────────────── */
const API_BASE = "http://localhost:5000/api";

let panels = [];
let activePanelIndex = -1;
let verdict = null;

async function init() {
  const userRaw = localStorage.getItem("postgraduate_user");
  if (!userRaw) {
    window.location.href = "../login/login.html";
    return;
  }
  const user = JSON.parse(userRaw);
  const userId = user._id || user.id;

  // 1. Enhanced Session Display
  if (user.fullName) {
    const parts = user.fullName.split(' ');
    const titles = ['dr.', 'prof.', 'mr.', 'mrs.', 'ms.', 'eng.', 'hon.'];
    let mainName = parts[0];
    
    // Skip academic/formal titles
    if (parts.length > 1 && titles.includes(parts[0].toLowerCase())) {
      mainName = parts[1];
    }

    document.getElementById('userAvatar').textContent = mainName.substring(0, 1).toUpperCase();
    
    // Display Title + First Name (e.g., "Dr. Enos")
    const displayName = parts.length > 1 ? `${parts[0]} ${parts[1]}` : parts[0];
    document.getElementById('userRole').textContent = displayName;
  }

  try {
    const res = await fetch(`${API_BASE}/panels/my/${userId}`);
    if (!res.ok) throw new Error("Failed to fetch assigned panels");
    panels = await res.json();
    renderQueue();

    // Check for deep link to specific panel
    const params = new URLSearchParams(window.location.search);
    const deepPanelId = params.get('panelId');

    if (deepPanelId) {
      const idx = panels.findIndex(p => p._id === deepPanelId);
      if (idx !== -1) {
        loadPanel(idx);
        return;
      }
    }

    if (panels.length > 0) {
      loadPanel(0);
    } else {
      document.getElementById('assessmentWorkspace').style.display = 'none';
      document.getElementById('welcomeState').style.display = 'flex';
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderQueue() {
  const sidebar = document.querySelector('.sidebar');
  const title = sidebar.querySelector('.sidebar-title');
  const titleHtml = title ? title.outerHTML : '<div class="sidebar-title">Boards Queue</div>';
  sidebar.innerHTML = titleHtml;

  panels.forEach((p, idx) => {
    const div = document.createElement('div');
    div.className = `queue-item ${idx === activePanelIndex ? 'active' : ''}`;
    div.id = `qi-${idx}`;
    div.onclick = () => loadPanel(idx);
    
    const date = new Date(p.scheduledDate);
    div.innerHTML = `
      <div class="q-meta">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        ${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        <span class="q-dot"></span>${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div class="q-name">${p.studentId?.fullName || 'Unknown'}</div>
      <div class="q-stage">${p.stage}</div>
      <div style="margin-top:8px">${p.hasSubmitted ? '<span style="color:var(--green);font-size:10px;font-weight:bold;">✓ SUBMITTED</span>' : `<button class="btn-assess" onclick="event.stopPropagation();loadPanel(${idx})">Assess Now →</button>`}</div>
    `;
    sidebar.appendChild(div);
  });
}

function loadPanel(idx) {
  activePanelIndex = idx;
  const p = panels[idx];
  const s = p.studentId || {};
  
  document.getElementById('assessmentWorkspace').style.display = 'block';
  document.getElementById('welcomeState').style.display = 'none';
  
  document.getElementById('studentAvatar').textContent = (s.fullName || 'U').substring(0, 1);
  document.getElementById('studentName').textContent   = s.fullName || 'Unknown';
  document.getElementById('studentReg').textContent    = s.userNumber || 'N/A';
  document.getElementById('studentUniv').textContent   = 'Institutional Portal'; // Placeholder
  document.getElementById('studentStage').textContent  = p.stage;
  
  document.querySelectorAll('.queue-item').forEach((el, i) => el.classList.toggle('active', i === idx));
  resetForm();
  
  // Disable form if already submitted or revoked
  const submitBtn = document.querySelector('.btn-primary');
  const isRevoked = p.membershipStatus === 'revoked';

  if (p.hasSubmitted || isRevoked) {
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.5';
    submitBtn.textContent = isRevoked ? 'Privileges Revoked' : 'Already Submitted';
    
    // Disable all inputs in the form
    document.querySelectorAll('#assessmentWorkspace input, #assessmentWorkspace textarea, #assessmentWorkspace select').forEach(el => el.disabled = true);
  } else {
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    submitBtn.textContent = 'Submit Assessment';
    document.querySelectorAll('#assessmentWorkspace input, #assessmentWorkspace textarea, #assessmentWorkspace select').forEach(el => el.disabled = false);
  }

  // --- Formal Role Logic ---
  const roleBadge = document.getElementById('myRoleBadge');
  const aiPortal = document.getElementById('aiPortalCard');
  const mobileAiBtn = document.getElementById('mbn-ai');

  if (isRevoked) {
    roleBadge.textContent = 'PRIVILEGES REVOKED';
    roleBadge.style.background = '#fee2e2';
    roleBadge.style.color = '#991b1b';
    roleBadge.style.borderColor = '#991b1b';
    if (aiPortal) aiPortal.style.display = 'none';
    if (mobileAiBtn) mobileAiBtn.style.display = 'none';
    showToast(`Access to this board has been revoked or expired.`, 'error');
  } else if (p.role === 'chair') {
    roleBadge.textContent = 'PANEL CHAIR';
    roleBadge.style.background = '#dcfce7';
    roleBadge.style.color = '#166534';
    roleBadge.style.borderColor = '#166534';
    if (aiPortal) aiPortal.style.display = 'block';
    if (mobileAiBtn) mobileAiBtn.style.display = 'flex';
    showToast(`You are the CHAIR for this session`, 'success');
  } else {
    roleBadge.textContent = 'PANEL MEMBER';
    roleBadge.style.background = 'var(--blue-light)';
    roleBadge.style.color = 'var(--blue)';
    roleBadge.style.borderColor = 'var(--blue)';
    if (aiPortal) aiPortal.style.display = 'none';
    if (mobileAiBtn) mobileAiBtn.style.display = 'none';
    showToast(`Loaded: ${s.fullName}`, 'success');
  }
}

/* ── Auto-scoring ──────────────────────────────────────── */
function calcScore() {
  ['lit1', 'lit2', 'meth1', 'meth2', 'prob', 'obj', 'pres'].forEach(id => {
    const el = document.getElementById('s_' + id);
    if (el) document.getElementById('v_' + id).textContent = el.value;
  });

  const probScore = +document.getElementById('s_prob').value * 10; // Scale to 100
  const objScore = +document.getElementById('s_obj').value * 10;
  const presScore = +document.getElementById('s_pres').value * 10;

  const litSlider = (+document.getElementById('s_lit1').value + +document.getElementById('s_lit2').value) / 2;
  const methSlider = (+document.getElementById('s_meth1').value + +document.getElementById('s_meth2').value) / 2;

  let litCheck = 0, methCheck = 0;
  document.querySelectorAll('#litChecks input[type=checkbox]:checked').forEach(cb => litCheck += +cb.dataset.pts);
  document.querySelectorAll('#methChecks input[type=checkbox]:checked').forEach(cb => methCheck += +cb.dataset.pts);

  const litRaw = litSlider + litCheck;
  const methRaw = methSlider + methCheck;
  const litPct = Math.round((litRaw / 30) * 100);
  const methPct = Math.round((methRaw / 30) * 100);
  
  const total = Math.round((probScore + objScore + litPct + methPct + presScore) / 5);

  document.getElementById('scorePct').textContent = total + '%';
  document.getElementById('barLit').style.width = litPct + '%';
  document.getElementById('barMeth').style.width = methPct + '%';
  document.getElementById('litPct').textContent = litPct + '%';
  document.getElementById('methPct').textContent = methPct + '%';

  const circle = document.getElementById('scoreCircle');
  const pctEl = document.getElementById('scorePct');
  let col = total >= 70 ? 'var(--green)' : (total >= 50 ? 'var(--amber)' : 'var(--red)');
  circle.style.borderColor = col;
  pctEl.style.color = col;
}

function setVerdict(v) {
  verdict = v;
  document.getElementById('btnPass').classList.toggle('active', v === 'pass');
  document.getElementById('btnFail').classList.toggle('active', v === 'fail');
  document.getElementById('verdictNote').textContent = v === 'pass' ? 'Student recommended for advancement.' : 'Student recommended for revision.';
}

async function submitAssessment() {
  if (!verdict) { showToast('Please select Pass or Fail before submitting.', 'error'); return; }
  
  const p = panels[activePanelIndex];
  const litPct = parseInt(document.getElementById('litPct').textContent);
  const methPct = parseInt(document.getElementById('methPct').textContent);
  const probScore = +document.getElementById('s_prob').value * 10;
  const objScore = +document.getElementById('s_obj').value * 10;
  const presScore = +document.getElementById('s_pres').value * 10;
  
  const payload = {
    memberId: p.memberId,
    scores: {
      problemScore: probScore,
      objectivesScore: objScore,
      literatureScore: litPct,
      methodologyScore: methPct,
      presentationScore: presScore
    },
    structuredFeedback: {
      criticalIssues: document.getElementById('crit_issues').value || "",
      minorIssues: document.getElementById('minor_issues').value || "",
      recommendations: document.getElementById('recom_remarks').value || ""
    },
    verdict: verdict === 'pass' ? 'pass' : 'revise'
  };

  try {
    const res = await fetch(`${API_BASE}/panels/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Failed to submit evaluation");
    
    showToast(`Assessment submitted successfully!`, 'success');
    init(); // Refresh data
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function resetForm() {
  ['s_lit1', 's_lit2', 's_meth1', 's_meth2', 'prob', 'obj', 'pres'].forEach(id => {
    const el = document.getElementById('s_' + id);
    if (el) el.value = 0;
  });
  document.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
  ['crit_issues', 'minor_issues', 'recom_remarks'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Also clear the individual criteria textareas if needed
  document.querySelectorAll('.rubric-criteria .comment-area').forEach(ta => ta.value = '');
  verdict = null;
  document.getElementById('btnPass').classList.remove('active');
  document.getElementById('btnFail').classList.remove('active');
  document.getElementById('verdictNote').textContent = '';
  calcScore();
}

/* ── UI Helpers & Mobile Logic ──────────────────────────── */
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  sidebar.classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
  document.getElementById('hamburgerBtn').classList.toggle('open');
}

function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
  document.getElementById('hamburgerBtn').classList.remove('open');
}

/* ── AI Transcript & Corrections Logic (Chatbot Refactor) ── */
let currentSuggestedCorrections = [];
let isProcessing = false;

async function handleUpload(event) {
  if (isProcessing) return;
  
  const file = event.target.files[0];
  if (!file) return;

  const panel = panels[activePanelIndex];
  if (panel.role !== 'chair') {
    showToast("Error: Only the Panel Chair can upload transcripts.", "error");
    return;
  }

  isProcessing = true;
  document.getElementById('uploadZone').style.display = 'none';
  
  // 1. Add User Message (Document Card)
  addMessage(`
    <div class="doc-card">
      <div style="color:var(--primary)">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      </div>
      <div class="doc-info">
        <div class="doc-name">${file.name}</div>
        <div class="doc-meta">${(file.size / 1024).toFixed(1)} KB</div>
        <div class="doc-progress"><div class="doc-progress-fill" id="uploadProgress" style="width: 20%"></div></div>
      </div>
      <button class="doc-cancel-btn" onclick="resetChat()" title="Cancel">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `, 'user');

  // 2. Start AI Simulation
  const steps = [
    "Validating document structure...",
    "Reading transcript content...",
    "Analyzing panelist feedback...",
    "Extracting structured corrections...",
    "Finalizing AI suggestions..."
  ];

  try {
    // Artificial delay for "uploading" feel
    await new Promise(r => setTimeout(r, 800));
    document.getElementById('uploadProgress').style.width = '100%';
    
    // 2. Start AI Simulation (Chatbot-style status sequence)
    const statusBubble = addMessage("Analyzing document...", 'status');
    
    // Simulate steps in parallel with real request or sequentially
    for (let i = 0; i < steps.length; i++) {
      if (!isProcessing) return; // Allow cancel
      statusBubble.innerHTML = `<span class="spinner"></span> ${steps[i]}`;
      await new Promise(r => setTimeout(r, 1200));
      // Gradual progress feel
      if (i === 1) document.getElementById('uploadProgress').style.width = '60%';
      if (i === 3) document.getElementById('uploadProgress').style.width = '90%';
    }
    statusBubble.innerHTML = "✓ Analysis Ready";
    statusBubble.classList.add('completed');
    document.getElementById('uploadProgress').style.width = '100%';

    showTypingIndicator();

    const formData = new FormData();
    formData.append("panelId", panel._id);
    formData.append("transcriptFile", file);

    const res = await fetch(`${API_BASE}/panels/transcript`, {
      method: "POST",
      body: formData
    });
    
    hideTypingIndicator();

    if (!res.ok) throw new Error("AI processing failed");
    
    const data = await res.json();
    currentSuggestedCorrections = data.suggestedCorrections.map((c, i) => ({
      ...c,
      id: `cor-${Date.now()}-${i}`,
      status: 'pending' // pending, approved, rejected
    }));
    
    // 3. Render Corrections with Typing Effect
    await renderCorrectionsChat();
    
    const pb = document.getElementById('publishBar');
    pb.style.display = 'flex';
    pb.scrollIntoView({ behavior: 'smooth' });
    showToast("AI Analysis Complete", "success");
  } catch (err) {
    hideTypingIndicator();
    addMessage(`Error: ${err.message}. Please try again.`, 'ai');
    document.getElementById('uploadZone').style.display = 'block';
    isProcessing = false;
  }
}

function addMessage(content, type) {
  const win = document.getElementById('chatWindow');
  const div = document.createElement('div');
  div.className = `chat-bubble ${type}`;
  div.innerHTML = content;
  win.appendChild(div);
  win.scrollTo({ top: win.scrollHeight, behavior: 'smooth' });
  return div;
}

function showTypingIndicator() {
  const win = document.getElementById('chatWindow');
  const div = document.createElement('div');
  div.id = 'typingIndicator';
  div.className = 'typing-indicator';
  div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  win.appendChild(div);
  win.scrollTo({ top: win.scrollHeight, behavior: 'smooth' });
}

function hideTypingIndicator() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

async function renderCorrectionsChat() {
  const greetings = [
    "I've carefully analyzed the transcript. Here are the core issues and recommendations identified during the session:",
    "Analysis complete. I've extracted the following corrections and formal suggestions from the panel's discussion:",
    "The review is ready. Below are the critical, major, and minor points raised by the board during the presentation:",
    "Based on the seminar recording, I've compiled a list of necessary corrections for the candidate's review:"
  ];
  const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
  
  const greetingBubble = addMessage("", "ai");
  greetingBubble.id = "ai-preamble";
  await typeText("ai-preamble", randomGreeting);
  
  for (const cor of currentSuggestedCorrections) {
    if (!isProcessing) return;
    await new Promise(r => setTimeout(r, 800)); // Delay between cards
    const card = document.createElement('div');
    card.id = cor.id;
    card.className = `correction-card ${cor.category}`;
    card.innerHTML = `
      <div class="correction-header">
        <span class="correction-category">${cor.category}</span>
        <span class="ci-status" id="status-${cor.id}" style="display:none"></span>
      </div>
      <div class="correction-issue" id="issue-${cor.id}"></div>
      <div class="correction-suggestion" id="sug-${cor.id}"></div>
      <div class="correction-actions" id="actions-${cor.id}">
        <button class="action-btn btn-approve" onclick="updateCorrectionStatus('${cor.id}', 'approved')">Approve</button>
        <button class="action-btn btn-edit" onclick="editCorrection('${cor.id}')">Edit</button>
        <button class="action-btn btn-reject" onclick="updateCorrectionStatus('${cor.id}', 'rejected')">Reject</button>
      </div>
    `;
    const win = document.getElementById('chatWindow');
    win.appendChild(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Type out the issue and suggestion
    await typeText(`issue-${cor.id}`, cor.description);
    win.scrollTo({ top: win.scrollHeight, behavior: 'smooth' });
  }
}

async function typeText(elementId, text) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const win = document.getElementById('chatWindow');
  
  for (let i = 0; i < text.length; i++) {
    el.textContent += text.charAt(i);
    await new Promise(r => setTimeout(r, 12)); // Slightly faster typing for better flow
    
    // Ensure the line being typed is visible
    win.scrollTop = win.scrollHeight;
  }
}

function updateCorrectionStatus(id, newStatus) {
  const cor = currentSuggestedCorrections.find(c => c.id === id);
  if (!cor) return;

  cor.status = newStatus;
  const card = document.getElementById(id);
  const statusEl = document.getElementById(`status-${id}`);
  const actionsEl = document.getElementById(`actions-${id}`);

  card.classList.remove('approved', 'rejected');
  if (newStatus === 'approved') {
    card.classList.add('approved');
    statusEl.textContent = '✓ Approved';
    statusEl.className = 'ci-status approved';
  } else if (newStatus === 'rejected') {
    card.classList.add('rejected');
    statusEl.textContent = '✕ Rejected';
    statusEl.className = 'ci-status rejected';
  }
  
  statusEl.style.display = 'block';
  actionsEl.innerHTML = `<button class="action-btn btn-edit" onclick="editCorrection('${id}')" style="border:none; background:none; text-decoration:underline; padding:0;">Change Decision</button>`;
}

function editCorrection(id) {
  const cor = currentSuggestedCorrections.find(c => c.id === id);
  if (!cor) return;

  const issueEl = document.getElementById(`issue-${id}`);
  const currentText = cor.description;
  
  issueEl.innerHTML = `
    <textarea class="comment-area" id="edit-input-${id}" style="min-height:50px; margin-bottom:8px;">${currentText}</textarea>
    <div style="display:flex; gap:8px;">
      <button class="btn-primary" onclick="saveEdit('${id}')" style="padding:4px 12px; font-size:11px;">Save</button>
      <button class="btn-secondary" onclick="cancelEdit('${id}')" style="padding:4px 12px; font-size:11px;">Cancel</button>
    </div>
  `;
  document.getElementById(`actions-${id}`).style.display = 'none';
}

function saveEdit(id) {
  const newText = document.getElementById(`edit-input-${id}`).value;
  const cor = currentSuggestedCorrections.find(c => c.id === id);
  if (cor) cor.description = newText;
  
  cancelEdit(id); // Returns to normal view
}

function cancelEdit(id) {
  const cor = currentSuggestedCorrections.find(c => c.id === id);
  const issueEl = document.getElementById(`issue-${id}`);
  const actionsEl = document.getElementById(`actions-${id}`);
  
  issueEl.textContent = cor.description;
  actionsEl.style.display = 'flex';
  actionsEl.innerHTML = `
    <button class="action-btn btn-approve" onclick="updateCorrectionStatus('${id}', 'approved')">Approve</button>
    <button class="action-btn btn-edit" onclick="editCorrection('${id}')">Edit</button>
    <button class="action-btn btn-reject" onclick="updateCorrectionStatus('${id}', 'rejected')">Reject</button>
  `;
  
  // Re-apply status visual if it was already set
  if (cor.status !== 'pending') updateCorrectionStatus(id, cor.status);
}

function resetChat() {
  isProcessing = false;
  currentSuggestedCorrections = [];
  document.getElementById('chatWindow').innerHTML = `
    <div class="chat-bubble ai">
      Hello! I'm your AI assistant. Please upload the seminar transcript or audio recording to begin the analysis.
    </div>
    <div class="upload-zone" id="uploadZone" style="margin: 10px; border-style: dotted;">
      <input type="file" accept=".txt,.pdf,.mp3,.wav,.m4a,.docx" onchange="handleUpload(event)" />
      <div class="upload-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
      </div>
      <p style="font-size: 12px;">Click or drag transcript here</p>
    </div>
  `;
  document.getElementById('publishBar').style.display = 'none';
}

async function publishCorrections() {
  const panel = panels[activePanelIndex];
  
  const finalized = currentSuggestedCorrections
    .filter(c => c.status === 'approved')
    .map(c => ({ category: c.category, description: c.description }));

  if (finalized.length === 0) {
    showToast("Please approve at least one correction before publishing.", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/panels/${panel._id}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ corrections: finalized })
    });
    if (!res.ok) throw new Error("Failed to publish checklist");
    
    showToast("Formal Checklist Published!", "success");
    document.getElementById('chatWindow').innerHTML = "";
    addMessage(`
      <div style="text-align:center; padding:20px;">
        <div style="color:var(--green); margin-bottom:12px;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h3 style="color:var(--text)">Checklist Finalized</h3>
        <p style="color:var(--muted); font-size:13px;">The student has been notified to start revisions based on the ${finalized.length} corrections you approved.</p>
        <button class="btn-secondary" onclick="resetChat()" style="margin-top:16px;">New Analysis</button>
      </div>
    `, 'ai');
    document.getElementById('publishBar').style.display = 'none';
  } catch (err) {
    showToast(err.message, "error");
  }
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.className = 'toast' + (type ? ' ' + type : '');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}

// Mobile tab logic
function mobileTab(tab) {
  document.querySelectorAll('.mbn-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('mbn-' + tab).classList.add('active');
  
  if (tab === 'queue') {
    document.querySelector('.sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('show');
  } else if (tab === 'assess') {
    document.getElementById('assessmentWorkspace').style.display = 'block';
    document.getElementById('aiPortalCard').style.display = 'none';
    closeSidebar();
  } else if (tab === 'ai') {
    document.getElementById('assessmentWorkspace').style.display = 'block';
    document.getElementById('aiPortalCard').style.display = 'block';
    // Scroll to it
    document.getElementById('aiPortalCard').scrollIntoView({ behavior: 'smooth' });
    closeSidebar();
  }
}

window.calcScore = calcScore;
window.setVerdict = setVerdict;
window.submitAssessment = submitAssessment;
window.resetForm = resetForm;
window.loadPanel = loadPanel;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.handleUpload = handleUpload;
window.publishCorrections = publishCorrections;
window.resetChat = resetChat;
window.updateCorrectionStatus = updateCorrectionStatus;
window.editCorrection = editCorrection;
window.saveEdit = saveEdit;
window.cancelEdit = cancelEdit;

// Initial Call
document.addEventListener("DOMContentLoaded", init);
