const API_BASE = "http://localhost:5000/api";

function buildUrl(path, query) {
  const url = new URL(API_BASE + path);
  if (query && typeof query === "object") {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function request(path, { method = "GET", query, body, headers, signal } = {}) {
  const url = buildUrl(path, query);
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": body ? "application/json" : "application/json",
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const message =
      (data && (data.message || data.error)) ||
      `Request failed (${res.status} ${res.statusText})`;
    const err = new Error(message);
    console.log(err);

    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  // Students
  async getStudents({ q, stage, department, status } = {}) {
    return request("/students", { query: { q, stage, department, status } });
  },
  async getStudentDetails(id) {
    return request(`/students/${encodeURIComponent(id)}`);
  },
  async getDeferralRequests() {
    return request("/deferral-requests");
  },
  async reviewDeferralRequest(id, { action, comment } = {}) {
    return request(`/students/${encodeURIComponent(id)}/deferral-review`, {
      method: "POST",
      body: { action, comment },
    });
  },
  async reviewQuarterlyReport(studentId, reportId, { action, comment } = {}) {
    return request(`/students/${encodeURIComponent(studentId)}/qreports/${encodeURIComponent(reportId)}/dean-review`, {
      method: "POST",
      body: { action, comment },
    });
  },
  async getQuarterlyReportsBoard({ status, q } = {}) {
    return request("/qreports/board", {
      query: { status, q },
    });
  },
  async getComplianceUploads() {
    return request("/compliance/uploads");
  },
  async resumeStudent(id) {
    return request(`/students/${encodeURIComponent(id)}/resume`, {
      method: "POST",
    });
  },

  // Director actions (API-ready)
  async updateStudentStage(id, { stage, mode, reason } = {}) {
    // mode: "advance" | "return" | "force"
    return request(`/students/${encodeURIComponent(id)}/stage`, {
      method: "POST",
      body: { stage, mode, reason },
    });
  },
  async overrideStudent(id, { type, note } = {}) {
    // type examples: "skipRequirements", "forceApprovalChain", "bypassMissingReport"
    return request(`/students/${encodeURIComponent(id)}/override`, {
      method: "POST",
      body: { type, note },
    });
  },
  async assignSupervisors(id, { sup1, sup2, override } = {}) {
    return request(`/students/${encodeURIComponent(id)}/supervisors`, {
      method: "POST",
      body: { sup1, sup2, override: !!override },
    });
  },
  async flagStudent(id, { atRisk, note } = {}) {
    return request(`/students/${encodeURIComponent(id)}/flag`, {
      method: "POST",
      body: { atRisk: !!atRisk, note },
    });
  },
  async addStudentNote(id, { note } = {}) {
    return request(`/students/${encodeURIComponent(id)}/notes`, {
      method: "POST",
      body: { note },
    });
  },
  async sendNotification({ audience, studentId, department, supervisorId, message, type } = {}) {
    // audience: "all" | "students" | "supervisors" | "departments" | "finance" | "examiners"
    return request("/notifications/send", {
      method: "POST",
      body: { audience, studentId, department, supervisorId, message, type },
    });
  },

  // Supervisors (API-ready)
  async getSupervisors() {
    return request("/supervisors");
  },
  async supervisorAction(supervisorId, { act, studentId } = {}) {
    return request(`/supervisors/${encodeURIComponent(supervisorId)}/${encodeURIComponent(act)}`, {
      method: "POST",
      body: { studentId },
    });
  },

  // Departments (API-ready)
  async getDepartments() {
    return request("/departments");
  },
  async departmentAction(departmentCode, { act, note } = {}) {
    return request(`/departments/${encodeURIComponent(departmentCode)}/${encodeURIComponent(act)}`, {
      method: "POST",
      body: { note },
    });
  },

  // Thesis & Defense (API-ready)
  async getThesisBoard({ q, stage, status } = {}) {
    return request("/thesis", { query: { q, stage, status } });
  },
  async thesisAction(studentId, { act, payload } = {}) {
    return request(`/thesis/${encodeURIComponent(studentId)}/${encodeURIComponent(act)}`, {
      method: "POST",
      body: payload || {},
    });
  },

  // Graduation (API-ready)
  async getGraduationBoard({ q, status } = {}) {
    return request("/graduation", { query: { q, status } });
  },
  async graduationAction(studentId, { act, payload } = {}) {
    return request(`/graduation/${encodeURIComponent(studentId)}/${encodeURIComponent(act)}`, {
      method: "POST",
      body: payload || {},
    });
  },

  // Analytics (API-ready)
  async getAnalytics() {
    return request("/analytics");
  },

  // Settings (API-ready)
  async getSettings() {
    return request("/settings");
  },
  async updateSettings(payload) {
    return request("/settings/update", {
      method: "POST",
      body: payload || {},
    });
  },
  async resetSettings() {
    return request("/settings/reset", { method: "POST" });
  },

  // Dashboard
  async getDashboardStats() {
    return request("/dashboard/stats");
  },

  // Pipeline
  async getPipeline() {
    return request("/pipeline");
  },

  // Reports
  async getReports({ status, q, page = 1, limit = 20 } = {}) {
    return request("/reports", {
      query: { status, q, page, limit },
    });
  },
  async approveReport(id) {
    return request(`/reports/${encodeURIComponent(id)}/approve`, { method: "POST" });
  },
  async rejectReport(id, { reason } = {}) {
    return request(`/reports/${encodeURIComponent(id)}/reject`, {
      method: "POST",
      body: { reason },
    });
  },
  
  // Panels
  async getPanels() {
    return request("/panels");
  },
  async createPanel(payload) {
    return request("/panels", {
      method: "POST",
      body: payload
    });
  },
  async getPanelResults(panelId) {
    return request(`/panels/${encodeURIComponent(panelId)}/results`);
  },
  async getEligiblePanelists() {
    return request("/users/eligible-panelists");
  },
  async reassignPanelist(panelId, payload) {
    return request(`/panels/${encodeURIComponent(panelId)}/reassign`, {
      method: "POST",
      body: payload
    });
  },
  async revokePanelist(panelId, memberId) {
    return request(`/panels/${encodeURIComponent(panelId)}/revoke`, {
      method: "POST",
      body: { memberId }
    });
  },
};

export { API_BASE };

