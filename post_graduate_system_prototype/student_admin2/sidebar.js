(() => {
  const API_BASE = "http://localhost:5000/api";
  const LOGIN_URL = "../login/login.html";
  const sidebarRoot = document.getElementById("appSidebar");
  if (!sidebarRoot) return;

  const sidebarPage = document.body.dataset.sidebarPage || "";
  const sidebarTag = document.body.dataset.sidebarTag || "Student";
  const sidebarTagId = document.body.dataset.sidebarTagId || "";
  const defaultUserName = "Student";
  const defaultInitials = "ST";

  const navItems = [
    { section: "DASHBOARD", icon: "fa-user", label: "My Profile", href: "profile.html", key: "profile" },
    { icon: "fa-flask", label: "Research Progress", href: "research.html", key: "research" },
    { section: "ACADEMIC", icon: "fa-file-alt", label: "Quarterly Reports", href: "qr.html", key: "qr" },
    { icon: "fa-shield-alt", label: "Compliance Center", href: "compliance.html", key: "compliance" },
    { icon: "fa-calendar-alt", label: "Scheduling", href: "booking.html", key: "booking" },
    // { section: "ADMINISTRATION", icon: "fa-university", label: "ERP Finance", action: "finance" },
    { section: "ACCOUNT", icon: "fa-sign-out-alt", label: "Logout", action: "logout" },
  ];

  const navHtml = navItems
    .map((item) => {
      const labelHtml = item.section
        ? `<div class="nav-label" style="margin-top: 15px">${item.section}</div>`
        : "";
      const isActive = item.key === sidebarPage ? " active" : "";
      const attrs = item.href
        ? `href="${item.href}"`
        : `href="javascript:void(0)" data-sidebar-action="${item.action}"`;

      return `${labelHtml}<a ${attrs} class="nav-item${isActive}"><i class="fas ${item.icon}"></i> ${item.label}</a>`;
    })
    .join("");

  const tagAttr = sidebarTagId ? ` id="${sidebarTagId}"` : "";

  sidebarRoot.innerHTML = `
    <div class="sidebar">
      <div class="logo-container">
        <h2>RONGO UNIVERSITY</h2>
        <p>STUDENT PROFILE</p>
      </div>
      <div class="nav-section">${navHtml}</div>
      <div class="user-bottom">
        <div class="user-avatar-small" id="sidebarUserAvatar">${defaultInitials}</div>
        <div class="user-info">
          <p id="sidebarUserName">${defaultUserName}</p>
          <span${tagAttr}>${sidebarTag}</span>
        </div>
      </div>
    </div>
  `;

  function toInitials(fullName) {
    const parts = String(fullName || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    if (!parts.length) return defaultInitials;
    return parts.map((part) => part.charAt(0).toUpperCase()).join("");
  }

  async function populateLoggedInStudent() {
    try {
      const response = await fetch(`${API_BASE}/is-logged`, {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) return;

      const data = await response.json();
      const user = data?.user;

      if (!user || user.role !== "student") return;

      const nameEl = document.getElementById("sidebarUserName");
      const avatarEl = document.getElementById("sidebarUserAvatar");

      if (nameEl) nameEl.textContent = user.fullName || defaultUserName;
      if (avatarEl) avatarEl.textContent = toInitials(user.fullName);
    } catch (error) {
      console.error("Failed to populate sidebar user:", error);
    }
  }

  window.showSidebarNotice = function showSidebarNotice(message) {
    alert(message);
  };

  async function logoutStudent() {
    try {
      window.StudentPageLoader?.show?.();
      await fetch(`${API_BASE}/user/login/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      localStorage.removeItem("postgraduate_user");
      localStorage.removeItem("auth_token");
      sessionStorage.removeItem("postgraduate_user");
      sessionStorage.removeItem("auth_token");
      sessionStorage.clear();
      window.StudentSession = null;
      window.location.replace(LOGIN_URL);
    }
  }

  sidebarRoot.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href === "javascript:void(0)") return;

    link.addEventListener("click", () => {
      window.StudentPageLoader?.show?.();
    });
  });

  sidebarRoot.querySelectorAll("[data-sidebar-action]").forEach((link) => {
    link.addEventListener("click", async () => {
      const action = link.dataset.sidebarAction;

      if (action === "finance") {
        window.showSidebarNotice("ERP Finance page is not available yet.");
        return;
      }

      if (action === "logout") {
        await logoutStudent();
      }
    });
  });

  populateLoggedInStudent();
})();
