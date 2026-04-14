const STUDENT_API_BASE = "http://localhost:5000/api";

async function studentRequest(path, options = {}) {
  const { method = "GET", body, headers } = options;
  const isFormData = body instanceof FormData;

  const response = await fetch(`${STUDENT_API_BASE}${path}`, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(headers || {}),
    },
    body: body
      ? isFormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Request failed");
  }

  return data;
}

window.StudentApi = {
  getSession() {
    return studentRequest("/is-logged");
  },
  getQuarterlyReports() {
    return studentRequest("/students/me/qreports");
  },
  submitQuarterlyReport(payload) {
    return studentRequest("/students/me/qreports", {
      method: "POST",
      body: payload,
    });
  },
  getSlots(department = "") {
    const query = department
      ? `?department=${encodeURIComponent(department)}`
      : "";
    return studentRequest(`/slots/all${query}`);
  },
  getBookings() {
    return studentRequest("/presentations/my-bookings");
  },
  requestPresentation(payload) {
    return studentRequest("/presentations/request", {
      method: "POST",
      body: payload,
    });
  },
  cancelBooking(bookingId, payload = {}) {
    return studentRequest(`/presentations/${bookingId}/cancel`, {
      method: "PUT",
      body: payload,
    });
  },
  remindAdminAboutBooking(bookingId, payload = {}) {
    return studentRequest(`/presentations/${bookingId}/remind-admin`, {
      method: "POST",
      body: payload,
    });
  },
  remindAdminToCreateSlot(payload = {}) {
    return studentRequest("/presentations/remind-admin-slot", {
      method: "POST",
      body: payload,
    });
  },
  getComplianceUploads() {
    return studentRequest("/students/me/compliance");
  },
  getThesisIntent() {
    return studentRequest("/students/me/thesis-intent");
  },
  submitThesisIntent(payload) {
    return studentRequest("/students/me/thesis-intent", {
      method: "POST",
      body: payload,
    });
  },
  submitComplianceUpload(payload) {
    return studentRequest("/students/me/compliance", {
      method: "POST",
      body: payload,
    });
  },
  submitDeferralRequest(payload) {
    return studentRequest("/students/me/deferral-request", {
      method: "POST",
      body: payload,
    });
  },
  submitResumptionRequest() {
    return studentRequest("/students/me/resumption-request", {
      method: "POST",
      body: {},
    });
  },
};
