document.addEventListener("DOMContentLoaded", async () => {
  await loadOrders(); // Initial table load
});

async function loadOrders() {
  const tbody = document.querySelector("#orders-table tbody");

  if (!tbody) {
    console.error("Required DOM elements are missing.");
    return;
  }

  try {
    const response = await fetchWithTokenRefresh(
      "http://localhost:5000/api/admin/orders",
      {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      }
    );

    if (!response.ok) throw new Error("Failed to fetch orders");

    const orders = await response.json();

    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No orders found</td></tr>`;
      return;
    }

    // Destroy existing DataTable instance if it exists
    if ($.fn.DataTable.isDataTable("#orders-table")) {
      $("#orders-table").DataTable().destroy();
    }

    tbody.innerHTML = orders
      .map(
        (order) => `
        <tr>
          <td>${order.id}</td>
          <td>${order.user_email || "N/A"}</td>
          <td>$${order.total_amount.toFixed(2)}</td>
          <td>
            <select onchange="updateOrderStatus(${order.id}, this.value)">
              <option value="Pending" ${order.status === "Pending" ? "selected" : ""}>Pending</option>
              <option value="Processing" ${order.status === "Processing" ? "selected" : ""}>Processing</option>
              <option value="Boxed" ${order.status === "Boxed" ? "selected" : ""}>Boxed</option>
              <option value="Shipped" ${order.status === "Shipped" ? "selected" : ""}>Shipped</option>
            </select>
          </td>
          <td>${new Date(order.created_at).toLocaleDateString()}</td>
        </tr>
      `
      )
      .join("");

    // Reinitialize DataTable
    $("#orders-table").DataTable({
      paging: true,
      searching: true,
      ordering: true,
      info: true,
    });
  } catch (error) {
    console.error("Error loading orders:", error.message);
    alert("Failed to load orders.");
  }
}

async function fetchWithTokenRefresh(url, options = {}) {
  let token = localStorage.getItem("token");
  if (!token) throw new Error("No token available");

  options.headers = { ...options.headers, Authorization: `Bearer ${token}` };

  let response = await fetch(url, options);
  if (response.status === 401) {
    const refreshResponse = await fetch("http://localhost:5000/api/refresh-token", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (refreshResponse.ok) {
      const { token: newToken } = await refreshResponse.json();
      localStorage.setItem("token", newToken);
      options.headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(url, options);
    } else {
      localStorage.removeItem("token");
      alert("Session expired. Please log in again.");
      window.location.href = "login.html";
      throw new Error("Failed to refresh token");
    }
  }

  return response;
}
