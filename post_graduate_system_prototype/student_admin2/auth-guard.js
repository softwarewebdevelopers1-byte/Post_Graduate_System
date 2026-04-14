(function () {
  const LOGIN_URL = "../login/login.html";
  const SESSION_URL = "http://localhost:5000/api/is-logged";

  function ensureStudentLoader() {
    let style = document.getElementById("studentPageLoaderStyle");
    if (!style) {
      style = document.createElement("style");
      style.id = "studentPageLoaderStyle";
      style.textContent = `
        body.student-page-loading {
          overflow: hidden;
        }

        body.student-page-loading #appSidebar,
        body.student-page-loading .main-content {
          visibility: hidden;
        }

        #studentPageLoader {
          position: fixed;
          inset: 0;
          display: none;
          align-items: center;
          justify-content: center;
          background: rgba(244, 246, 249, 0.92);
          backdrop-filter: blur(2px);
          z-index: 9999;
        }

        body.student-page-loading #studentPageLoader {
          display: flex;
        }

        .student-loader-card {
          min-width: 220px;
          padding: 22px 24px;
          border-radius: 16px;
          background: white;
          box-shadow: 0 18px 40px rgba(28, 75, 121, 0.12);
          border: 1px solid rgba(28, 75, 121, 0.08);
          text-align: center;
          color: #1c4b79;
          font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        }

        .student-loader-spinner {
          width: 42px;
          height: 42px;
          margin: 0 auto 14px;
          border-radius: 50%;
          border: 4px solid rgba(28, 75, 121, 0.12);
          border-top-color: #1c4b79;
          animation: student-loader-spin 0.9s linear infinite;
        }

        .student-loader-title {
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .student-loader-subtitle {
          font-size: 12px;
          color: #6b7a88;
        }

        @keyframes student-loader-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `;
      document.head.appendChild(style);
    }

    let loader = document.getElementById("studentPageLoader");
    if (!loader) {
      loader = document.createElement("div");
      loader.id = "studentPageLoader";
      loader.innerHTML = `
        <div class="student-loader-card">
          <div class="student-loader-spinner"></div>
          <div class="student-loader-title">Loading student dashboard</div>
          <div class="student-loader-subtitle">Please wait a moment...</div>
        </div>
      `;
      document.body.appendChild(loader);
    }

    return {
      show() {
        document.body.classList.add("student-page-loading");
      },
      hide() {
        document.body.classList.remove("student-page-loading");
      },
    };
  }

  const loader = ensureStudentLoader();
  loader.show();
  window.StudentPageLoader = loader;

  fetch(SESSION_URL, {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.isLoggedIn || payload?.user?.role !== "student") {
        window.location.replace(LOGIN_URL);
        return;
      }

      window.StudentSession = payload.user;
      loader.hide();
    })
    .catch(() => {
      window.location.replace(LOGIN_URL);
    });
})();
