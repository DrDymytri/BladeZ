document.addEventListener("DOMContentLoaded", async () => {
  const loginDialog = document.getElementById("login-dialog");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const userInfo = document.getElementById("user-info");
  const ordersTableBody = document.querySelector("#orders-table tbody");

  async function checkLoginStatus() {
    const token = localStorage.getItem("token");
    if (!token) {
      openLoginDialog();
      return false;
    }
    return true;
  }

  function openLoginDialog() {
    loginDialog.style.display = "block";
  }

  function closeLoginDialog() {
    loginDialog.style.display = "none";
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
      const response = await apiService.post("/api/login", { email, password });
      if (response.token) {
        localStorage.setItem("token", response.token);
        closeLoginDialog();
        fetchUserInfo();
        fetchOrders();
      } else {
        loginError.style.display = "block";
      }
    } catch (error) {
      console.error("Login error:", error);
      loginError.style.display = "block";
    }
  });

  async function fetchUserInfo() {
    try {
      const response = await apiService.get("/api/user-info", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch user info");

      const user = await response.json();
      userInfo.innerHTML = `
        <h2>Welcome, ${user.first_name} ${user.last_name}</h2>
        <p>Email: ${user.email}</p>
      `;
    } catch (error) {
      console.error("Error fetching user info:", error);
      userInfo.innerHTML = `
        <p style="color: red;">Failed to load user information. Please log in again.</p>
      `;
    }
  }

  async function fetchOrders() {
    try {
      const response = await apiService.get("/api/orders/history", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response || response.length === 0) {
        ordersTableBody.innerHTML = "<tr><td colspan='5'>No orders found.</td></tr>";
        return;
      }
      ordersTableBody.innerHTML = response
        .map(
          (order) => `
          <tr>
            <td>${order.id}</td>
            <td>$${order.total.toFixed(2)}</td>
            <td>${order.status}</td>
            <td>${order.tracking_number || "N/A"}</td>
            <td>${new Date(order.date_processed).toLocaleDateString()}</td>
          </tr>
        `
        )
        .join("");
    } catch (error) {
      console.error("Error fetching orders:", error);
      ordersTableBody.innerHTML = "<tr><td colspan='5'>Failed to load orders. Please try again later.</td></tr>";
    }
  }

  const isLoggedIn = await checkLoginStatus();
  if (isLoggedIn) {
    fetchUserInfo();
    fetchOrders();
  }
});
