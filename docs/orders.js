const BACKEND_URL = process.env.BACKEND_URL; // Use environment variable only

document.addEventListener("DOMContentLoaded", async () => {
  // Update cart count
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalQuantity = cart.reduce((count, item) => count + item.quantity, 0);
  document.getElementById("cart-count").textContent = totalQuantity;

  fetchOrders();
});

async function fetchOrders() {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Please log in to view your orders.");
    localStorage.setItem("intendedDestination", "orders.html"); // Save intended destination
    window.location.href = "login.html";
    return;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/orders`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem("token"); // Remove expired or invalid token
      alert("Your session has expired. Please log in again.");
      localStorage.setItem("intendedDestination", "orders.html"); // Save intended destination
      window.location.href = "login.html";
      return;
    }

    if (!response.ok) {
      throw new Error("Failed to fetch orders.");
    }

    const data = await response.json();
    const orders = data.orders || [];
    displayOrders(orders);
  } catch (error) {
    alert("Error loading orders: " + error.message);
  }
}

function displayOrders(orders) {
  const ordersTableBody = document.querySelector("#orders-table tbody");
  if (!ordersTableBody) {
    console.error("Orders table body not found.");
    return;
  }

  if (!orders || orders.length === 0) {
    ordersTableBody.innerHTML = "<tr><td colspan='5'>No orders found.</td></tr>";
    return;
  }

  // Group orders by unique orderId to avoid duplicates
  const uniqueOrders = Array.from(
    new Map(orders.map((order) => [order.orderId, order])).values()
  );

  ordersTableBody.innerHTML = uniqueOrders
    .map(
      (order) => `
      <tr>
        <td>${order.orderId}</td>
        <td>$${order.total?.toFixed(2) || "0.00"}</td>
        <td>${order.status}</td>
        <td>${order.trackingNumber || "N/A"}</td>
        <td>${order.orderDate ? new Date(order.orderDate).toLocaleDateString() : "N/A"}</td>
      </tr>
    `
    )
    .join("");
}
