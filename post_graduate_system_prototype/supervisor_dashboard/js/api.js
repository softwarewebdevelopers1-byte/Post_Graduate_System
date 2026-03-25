const API_BASE = "http://localhost:5000/api";

async function request(path, { method = "GET", body, headers } = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status} ${res.statusText})`);
  }
  return data;
}

export const api = {
  // Fetch Students Assigned to me
  async getAssignedStudents(supervisorId) {
    return request(`/supervisor/${encodeURIComponent(supervisorId)}/students`);
  },

  // Accept / Reject assignment
  async updateAssignmentStatus(studentId, supervisorId, action) {
    return request(`/students/${encodeURIComponent(studentId)}/assign`, {
      method: "POST",
      body: { supervisorId, action }
    });
  },

  // Approve / Return pipeline stages (e.g., Draft Thesis, Quarterly Reports)
  async approveStage(studentId, stageName, { action, comment } = {}) {
    return request(`/students/${encodeURIComponent(studentId)}/stage/${encodeURIComponent(stageName)}/approve`, {
      method: "POST",
      body: { action, comment }
    });
  },

  // Corrections Center
  async getCorrections(studentId) {
    return request(`/students/${encodeURIComponent(studentId)}/corrections`);
  },

  async updateCorrection(studentId, correctionData) {
    // correctionData: { correctionId, completed, validation, text, source }
    return request(`/students/${encodeURIComponent(studentId)}/corrections`, {
      method: "POST",
      body: correctionData
    });
  },

  // Requirement Tracker
  async getDocuments(studentId) {
    return request(`/students/${encodeURIComponent(studentId)}/documents`);
  },

  async getReports(studentId) {
    return request(`/students/${encodeURIComponent(studentId)}/qreports`);
  },

  // Analytics & Automation
  async getAnalytics(supervisorId) {
    return request(`/supervisor/${encodeURIComponent(supervisorId)}/analytics`);
  },

  async approveQReport(studentId, reportId, { supervisorId, role, action, comment } = {}) {
    return request(`/students/${encodeURIComponent(studentId)}/qreports/${encodeURIComponent(reportId)}/approve`, {
      method: "POST",
      body: { supervisorId, role, action, comment }
    });
  },

  async triggerAutoCheck(studentId) {
    return request(`/students/${encodeURIComponent(studentId)}/automation/suggest`, {
      method: "POST"
    });
  },

  // Dashboard Summary (Computed from fetched students)
  async getDashboardSummary(supervisorId) {
    const students = await this.getAssignedStudents(supervisorId);
    return {
      total: students.length,
      pendingApproval: students.filter(s => {
        const slot = s.supervisors?.sup1 === supervisorId ? "sup1" : (s.supervisors?.sup2 === supervisorId ? "sup2" : "sup3");
        return s.assignmentStatus?.[slot] === "pending";
      }).length,
      active: students.filter(s => s.status === "Active").length,
      deferred: students.filter(s => s.status === "Deferred").length,
      staged: students.reduce((acc, s) => {
        acc[s.stage] = (acc[s.stage] || 0) + 1;
        return acc;
      }, {})
    };
  }
};
