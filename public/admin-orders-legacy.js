document.addEventListener("DOMContentLoaded", async () => {
  await loadArchivedOrders();
});

async function loadArchivedOrders() {
  const tbody = document.querySelector("#orders-table tbody");
  if (!tbody) {
    console.error("Table body not found. Ensure the #orders-table and its <tbody> exist in the HTML.");
    return;
  }

  try {
    const response = await fetch("http://localhost:5000/api/admin/orders");
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch orders");
    }

    const orders = await response.json();

    // Filter for "Shipped" orders only
    const shippedOrders = orders.filter(order => order.status === "Shipped");

    if (shippedOrders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No archived orders found</td></tr>`;
      return;
    }

    // Populate the table rows with shipped orders
    shippedOrders.forEach((order) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${order.id}</td>
        <td>${order.user_name || "N/A"}</td>
        <td>$${order.total_amount.toFixed(2)}</td>
        <td>${order.status}</td>
        <td>${order.tracking_number || "N/A"}</td>
        <td>${new Date(order.created_at).toLocaleDateString()}</td>
        <td>
          <button onclick="showOrderItems(${order.id})" class="view-items-btn">View Items</button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // Initialize DataTables
    $('#orders-table').DataTable({
      paging: true,
      searching: true,
      ordering: true,
      pageLength: 10,
      stateSave: true,
    });
  } catch (error) {
    console.error("Error loading archived orders:", error.message);
    alert("Failed to load archived orders: " + error.message);
  }
}

async function showOrderItems(orderId) {
  try {
    const response = await fetch(`http://localhost:5000/api/admin/orders/${orderId}/items`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch order items");
    }

    const items = await response.json();

    if (!items || items.length === 0) {
      alert("No items found for this order.");
      return;
    }

    // Fetch the order details to get the user's name and status
    const orderResponse = await fetch(`http://localhost:5000/api/admin/orders`);
    if (!orderResponse.ok) {
      const errorData = await orderResponse.json();
      throw new Error(errorData.error || "Failed to fetch order details");
    }

    const orders = await orderResponse.json();
    const order = orders.find((o) => o.id === orderId);
    const userName = order?.user_name || "Unknown User";
    const orderStatus = order?.status || "Unknown";

    // Generate HTML for the modal with cards
    const itemsHtml = items
      .map(
        (item) => `
        <div class="order-item-card">
          <img src="${item.imageUrl || 'default-image.jpg'}" alt="${item.productName}" class="order-item-image" />
          <div class="order-item-details">
            <h3>${item.productName}</h3>
            <p>Quantity: ${item.quantity}</p>
            <p>Price: $${item.price.toFixed(2)}</p>
          </div>
        </div>
      `
      )
      .join("");

    const modalHtml = `
      <div id="order-items-modal" class="modal">
        <div class="modal-content">
          <span class="close-btn" onclick="closeModal()">&times;</span>
          <h2>${userName} - Order (${orderId}) <br>Purchased Items:</h2>
          <div class="order-items-container">
            ${itemsHtml}
          </div>
        </div>
      </div>
    `;

    // Remove any existing modal before adding a new one
    const existingModal = document.getElementById("order-items-modal");
    if (existingModal) {
      existingModal.remove();
    }

    // Add the modal to the DOM and display it
    document.body.insertAdjacentHTML("beforeend", modalHtml);
    document.getElementById("order-items-modal").style.display = "block";
  } catch (error) {
    console.error("Error fetching order items:", error.message);
    alert("Failed to fetch order items: " + error.message);
  }
}

function closeModal() {
  const modal = document.getElementById("order-items-modal");
  if (modal) {
    modal.remove();
  }
}
