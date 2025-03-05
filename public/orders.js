document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Please log in to view your orders.");
    return;
  }
  const response = await fetch("/orders", {
    headers: { Authorization: "Bearer " + token },
  });
  const orders = await response.json();
  const tbody = document.querySelector("#orders-table tbody");
  tbody.innerHTML = orders
    .map(
      (order) => `
    <tr>
      <td>${order.id}</td>
      <td>$${order.total_amount}</td>
      <td>${order.status}</td>
      <td>${order.shipping_status}</td>
      <td>${new Date(order.created_at).toLocaleDateString()}</td>
    </tr>
  `
    )
    .join("");
});
