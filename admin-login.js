const BACKEND_URL = process.env.BACKEND_URL; // Use environment variable only

document.getElementById("adminLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("adminEmail").value;
  const password = document.getElementById("adminPassword").value;

  try {
    const response = await fetch(`${BACKEND_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem("token", data.token);
      alert("Login successful!");
      window.location.href = `${BACKEND_URL}/admin.html`;
    } else {
      alert("Login failed. Please check your credentials.");
    }
  } catch (error) {
    console.error("Error during login:", error);
    alert("An error occurred. Please try again.");
  }
});
