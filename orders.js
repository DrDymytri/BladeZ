document.addEventListener("DOMContentLoaded", async () => {
  const ordersTableBody = document.querySelector("#orders-table tbody");
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
});
