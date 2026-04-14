document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.querySelector(".login-form");
    const submitBtn = document.querySelector(".login-btn");
    const userNumberInput = document.getElementById("userNumber");
    const passwordInput = document.getElementById("password");
    const messageBox = document.getElementById("messageBox");
    const API_BASE = "http://localhost:5000/api";

    function getRedirectByRole(role) {
        if (role === "student") return "../student_admin2/profile.html";
        if (role === "supervisor") return "../supervisor_dashboard/index.html";
        if (role === "director") return "../director_dashboard/index.html";
        if (role === "admin") return "../Admin_dashboard/index.html";
        if (role === "panelMember") return "../panel dashboard/index.html";
        return null;
    }

    function showMessage(message, type) {
        messageBox.textContent = message;
        messageBox.className = `message-box ${type}`;
        messageBox.style.display = "block";

        setTimeout(() => {
            messageBox.style.display = "none";
        }, 4000);
    }

    async function checkExistingSession() {
        try {
            const response = await fetch(`${API_BASE}/is-logged`, {
                method: "GET",
                credentials: "include",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) return;

            const result = await response.json();
            const redirectPath = getRedirectByRole(result?.user?.role);

            if (result?.isLoggedIn && redirectPath) {
                localStorage.setItem("postgraduate_user", JSON.stringify(result.user));
                window.location.replace(redirectPath);
            }
        } catch (error) {
            console.error("Session check failed:", error);
        }
    }

    checkExistingSession();

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        submitBtn.disabled = true;
        submitBtn.innerHTML = "Signing in...";

        const userNumber = userNumberInput.value.trim();
        const password = passwordInput.value;

        if (!userNumber || !password) {
            showMessage("Please enter credentials and password.", "error");
            submitBtn.disabled = false;
            submitBtn.innerHTML = "Sign In";
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/user/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({ userNumber, password })
            });

            const result = await response.json();

            console.log("Login response:", result);

            if (response.ok) {
                showMessage("Login successful! Redirecting...", "success");

                // Store user data in localStorage
                localStorage.setItem("postgraduate_user", JSON.stringify({
                    id: result.user.id,
                    fullName: result.user.fullName || "User",
                    programme: result.user.programme,
                    department: result.user.department,
                    userNumber: result.user.userNumber,
                    role: result.user.role,
                    supervisor: result.user.supervisor,
                    token: result.token
                }));

                // Also store token separately for easy access
                localStorage.setItem("auth_token", result.token);

                // Redirect based on role
                const role = result.user.role;

                const redirectPath = getRedirectByRole(role);
                if (redirectPath) {
                    setTimeout(() => {
                        window.location.href = redirectPath;
                    }, 1200);
                } else {
                    showMessage("Login succeeded, but no destination is configured for this role.", "error");
                }
            } else {
                showMessage(result.message || "Login failed", "error");
            }
        } catch (error) {
            console.error("Error logging in:", error);
            showMessage("Server error. Try again later.", "error");
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = "Sign In";
        }
    });
});
