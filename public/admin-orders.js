document.addEventListener("DOMContentLoaded", () => {
  loadOrders();
});

async function loadOrders() {
  try {
    const response = await fetch("http://localhost:5000/api/orders");
    if (!response.ok) throw new Error("Failed to fetch orders");

    const orders = await response.json();
    const ordersContainer = document.getElementById("admin-orders-container");
    ordersContainer.innerHTML = orders
      .map(
        (order) => `
        <div class="order-card">
          <h3>Order ID: ${order.id}</h3>
          <p><strong>User ID:</strong> ${order.user_id}</p>
          <p><strong>Total Amount:</strong> $${order.total_amount.toFixed(2)}</p>
          <p><strong>Order Date:</strong> ${new Date(order.order_date).toLocaleString()}</p>
          <p><strong>Shipping Status:</strong> ${order.shipping_status}</p>
          <div class="order-actions">
            <button class="update-btn" data-id="${order.id}">Update</button>
            <button class="delete-btn" data-id="${order.id}">Delete</button>
          </div>
        </div>`
      )
      .join("");

    attachOrderEventListeners();
  } catch (error) {
    console.error("Error loading orders:", error);
  }
}

function attachOrderEventListeners() {
  document.querySelectorAll(".update-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const orderId = event.target.dataset.id;
      editOrder(orderId);
    });
  });

  document.querySelectorAll(".delete-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const orderId = event.target.dataset.id;
      deleteOrder(orderId);
    });
  });
}

async function editOrder(orderId) {
  // Logic to edit an order
  console.log(`Editing order with ID: ${orderId}`);
}

async function deleteOrder(orderId) {
  if (!confirm("Are you sure you want to delete this order?")) return;

  try {
    const response = await fetch(`http://localhost:5000/api/orders/${orderId}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete order");

    alert("Order deleted successfully!");
    loadOrders();
  } catch (error) {
    console.error("Error deleting order:", error);
  }
}
