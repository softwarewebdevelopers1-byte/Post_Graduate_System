import { qs, getSupervisorSession, escapeHtml } from './main.js';
import { api } from './api.js';

export async function initPresentations() {
    const session = getSupervisorSession();
    const root = qs("#section-generic");
    if (!root) return;

    root.innerHTML = `
        <div class="p-8">
            <div class="flex-between mb-8">
                <div>
                    <h2 class="text-3xl font-black text-navy">Student Presentations</h2>
                    <p class="text-sm text-muted">Booked presentation requests from students assigned to you</p>
                </div>
                <button class="btn btn-primary btn-sm" id="refresh-panels">Refresh Schedule</button>
            </div>
            <div id="panels-list" class="grid-2">
                <div class="col-span-2 p-20 text-center animate-pulse">
                    <div class="text-4xl mb-4">P</div>
                    <div class="font-bold text-muted uppercase tracking-widest text-xs">Loading student bookings...</div>
                </div>
            </div>
        </div>
    `;

    loadPanels(session.id);
    qs("#refresh-panels").onclick = () => loadPanels(session.id);
}

async function loadPanels(userId) {
    const list = qs("#panels-list");
    try {
        const response = await api.getMyPresentations(userId);
        const panels = Array.isArray(response?.presentations) ? response.presentations : [];

        if (!panels.length) {
            list.innerHTML = `
                <div class="col-span-2 p-20 text-center bg-white rounded-3xl border border-dashed border-grey-200">
                    <div class="text-6xl mb-6 opacity-20">P</div>
                    <h3 class="text-xl font-bold text-navy">No Student Presentations</h3>
                    <p class="text-sm text-muted mt-2">No booked presentation requests were found for your assigned students.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = panels.map((p) => `
            <div class="card hover-up transition-all group">
                <div class="flex justify-between items-start mb-6">
                    <div class="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl shadow-inner border border-white">
                        ${String(p.presentationType || '').toLowerCase().includes('seminar') ? 'S' : 'P'}
                    </div>
                    <span class="badge ${p.bookingStatus === 'confirmed' ? 'badge-active' : 'badge-pending'}" style="text-transform: uppercase; font-size: 10px; font-weight: 800; letter-spacing: 0.05em;">
                        ${escapeHtml(p.bookingStatus || 'pending')}
                    </span>
                </div>

                <div class="mb-6">
                    <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">${escapeHtml(p.presentationType || 'Presentation')}</div>
                    <h3 class="text-lg font-black text-navy leading-tight mb-2">${escapeHtml(p.studentName || 'Research Candidate')}</h3>
                    <div class="text-xs font-bold text-muted uppercase tracking-tighter">Reg No: ${escapeHtml(p.studentReg || 'Pending')}</div>
                </div>

                <div class="flex items-center gap-4 py-4 border-y border-slate-50 mb-6 bg-slate-50/30 -mx-8 px-8">
                    <div class="flex-1">
                        <div class="text-[9px] font-black text-slate-400 uppercase">Scheduled Date</div>
                        <div class="text-sm font-bold text-navy">${formatDisplayDate(p.preferredDate)}</div>
                    </div>
                    <div class="flex-1 text-right">
                        <div class="text-[9px] font-black text-slate-400 uppercase">Time / Venue</div>
                        <div class="text-sm font-bold text-green-500">${escapeHtml(p.preferredTime || 'Pending')}${p.venue ? ` • ${escapeHtml(p.venue)}` : ''}</div>
                    </div>
                </div>

                <div class="mb-6 text-xs text-slate-500 space-y-1">
                    <div><span class="font-bold text-slate-700">Stage:</span> ${escapeHtml(p.stage || 'Coursework')}</div>
                    <div><span class="font-bold text-slate-700">Programme:</span> ${escapeHtml(String((p.programme || '-')).toUpperCase())} • ${escapeHtml(p.department || '-')}</div>
                    <div><span class="font-bold text-slate-700">Supervisor Status:</span> ${escapeHtml(p.assignmentStatus || 'pending')}</div>
                    ${p.additionalNotes ? `<div><span class="font-bold text-slate-700">Notes:</span> ${escapeHtml(p.additionalNotes)}</div>` : ''}
                </div>

                <div class="flex gap-3">
                    
                    ${p.bookingStatus === 'confirmed' ? `
                    <button class="btn btn-primary btn-sm w-full btn-assess" data-student-id="${p.studentId}">
                        Assess Now
                    </button>
                    ` : ''}
                </div>
            </div>
        `).join('');

        setupPresentationEvents(userId);
    } catch (err) {
        list.innerHTML = `<div class="col-span-2 alert alert-error">${escapeHtml(err.message || 'Failed to load presentations')}</div>`;
    }
}

async function setupPresentationEvents(userId) {
    const session = getSupervisorSession();

    // 1. View Profile
    document.querySelectorAll('.btn-view-profile').forEach(btn => {
        btn.onclick = () => {
            const studentId = btn.dataset.id;
            navigateTo('student-detail', null, studentId);
        };
    });

    // 2. Assess Now
    document.querySelectorAll('.btn-assess').forEach(async (btn) => {
        btn.onclick = async () => {
            const studentId = btn.dataset.studentId;
            try {
                // Try to find the specific panel for this student to deep link
                const panels = await api.getMyPanelAssignments(session.id);
                const relevantPanel = panels.find(p => String(p.studentId?._id || p.studentId) === String(studentId));
                
                if (relevantPanel) {
                    window.location.href = `../panel dashboard/index.html?panelId=${relevantPanel._id}`;
                } else {
                    // Fallback to general dashboard if panel not found/assigned yet
                    window.location.href = `../panel dashboard/index.html`;
                }
            } catch (err) {
                console.error("Link to panel failed:", err);
                window.location.href = `../panel dashboard/index.html`;
            }
        };
    });
}

function formatDisplayDate(value) {
    if (!value) return 'Pending';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return escapeHtml(String(value));
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
