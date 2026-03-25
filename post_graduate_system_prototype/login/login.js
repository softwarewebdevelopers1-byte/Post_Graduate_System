document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.querySelector(".login-form");
    const submitBtn = document.querySelector(".login-btn");
    const userNumberInput = document.getElementById("userNumber");
    const passwordInput = document.getElementById("password");
    const messageBox = document.getElementById("messageBox");

    function showMessage(message, type) {
        messageBox.textContent = message;
        messageBox.className = `message-box ${type}`;
        messageBox.style.display = "block";

        setTimeout(() => {
            messageBox.style.display = "none";
        }, 4000);
    }

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
            const response = await fetch("http://localhost:5000/api/user/login", {
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

                if (role === "student") {
                    setTimeout(() => {
                        window.location.href = "../Student_dashboard/index.html";
                    }, 1500);
                } else if (role === "supervisor") {
                    setTimeout(() => {
                        window.location.href = "../supervisor_dashboard/index.html";
                    }, 1500);
                } else if (role === "director") {
                    setTimeout(() => {
                        window.location.href = "../director_dashboard/index.html";
                    }, 1500);
                }
                else if (role === "admin") {
                    setTimeout(() => {
                        window.location.href = "../Admin_dashboard/index.html"
                    })
                }
                else if (role === "panelMember") {
                    setTimeout(() => {
                        window.location.href = "../panel dashboard/index.html"
                    })
                }
                // else {
                //     // Default fallback
                //     setTimeout(() => {
                //         window.location.href = "../dashboard/index.html";
                //     }, 1500);
                // }
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