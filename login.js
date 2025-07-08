const API_BASE_URL = process.env.BACKEND_URL; // Use environment variable only

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");

  async function checkServerConnection() {
    try {
      const response = await fetch(`${API_BASE_URL}/health-check`);
      if (!response.ok) {
        const fallbackResponse = await fetch(`${API_BASE_URL}/api/login`, { method: "OPTIONS" });
        if (!fallbackResponse.ok) {
          alert("Unable to connect to the server. Please try again later.");
          return false;
        }
      }
      return true;
    } catch (error) {
      alert("Network error. Please check your connection.");
      return false;
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    if (!(await checkServerConnection())) return;

    try {
      loginError.style.display = "none"; // Hide error message
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        if (response.status === 401) throw new Error("Invalid email or password.");
        if (response.status === 500) throw new Error("Server error. Please try again later.");
        throw new Error("Unexpected error occurred.");
      }

      const data = await response.json();
      localStorage.setItem("token", data.token); // Save the token

      // Redirect to the intended destination or default to index.html
      const intendedDestination = localStorage.getItem("intendedDestination");
      if (intendedDestination) {
        localStorage.removeItem("intendedDestination"); // Clear the intended destination
        window.location.href = intendedDestination;
      } else {
        window.location.href = "index.html"; // Default to index.html
      }
    } catch (error) {
      loginError.textContent = error.message;
      loginError.style.display = "block"; // Show error message
    }
  });

  // Close login dialog functionality
  document.querySelector(".close").addEventListener("click", () => {
    document.getElementById("login-dialog").style.display = "none";
  });
});