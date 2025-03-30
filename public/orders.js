document.addEventListener("DOMContentLoaded", async () => {
  // Update cart count
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalQuantity = cart.reduce((count, item) => count + item.quantity, 0);
  document.getElementById("cart-count").textContent = totalQuantity;

  try {
    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please log in to view your orders.");
      window.location.href = "login.html";
      return;
    }

    const response = await fetch("http://localhost:5000/orders", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error("Failed to fetch orders");

    const orders = await response.json();
    const tbody = document.querySelector("#orders-table tbody");
    tbody.innerHTML = orders
      .map(
        (order) => `
        <tr>
          <td>${order.id}</td>
          <td>$${order.total_amount.toFixed(2)}</td>
          <td>${order.status}</td>
          <td>${order.tracking_number || "N/A"}</td>
          <td>${new Date(order.created_at).toLocaleDateString()}</td>
        </tr>
      `
      )
      .join("");
  } catch (error) {
    console.error("Error loading orders:", error.message);
    alert("Error loading orders: " + error.message);
  }
});
