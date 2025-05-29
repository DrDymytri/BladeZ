const BASE_URL = process.env.BASE_URL; // Use environment variable only

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
    const response = await fetch(`${BASE_URL}/api/admin/orders`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch orders");
    }

    const orders = await response.json();

    // Filter for "Closed" orders only
    const closedOrders = orders.filter(order => order.status === "Closed");

    if (closedOrders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center;">No closed orders found</td></tr>`;
      return;
    }

    // Populate the table rows with closed orders
    closedOrders.forEach((order) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${order.id}</td>
        <td>${order.user_name || "N/A"}</td>
        <td>$${order.total_amount.toFixed(2)}</td>
        <td>${order.status}</td>
        <td>${order.tracking_number || ""}</td>
        <td>${new Date(order.created_at).toLocaleDateString()}</td>
        <td>${order.closed_date ? new Date(order.closed_date).toLocaleDateString() : "N/A"}</td>
        <td>${order.received_confirmation_number || "N/A"}</td>
        <td>${order.confirmation_date_time ? new Date(order.confirmation_date_time).toLocaleString() : "N/A"}</td>
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
    console.error("Error loading closed orders:", error.message);
    alert("Failed to load closed orders: " + error.message);
  }
}

async function updateTrackingNumber(orderId, trackingNumber) {
  const confirmUpdate = confirm(
    `Are you sure you want to update the tracking number for Order ID ${orderId} to "${trackingNumber}"?`
  );

  if (!confirmUpdate) {
    alert("Tracking number update canceled.");
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/api/admin/orders/${orderId}/tracking`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trackingNumber }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to update tracking number");
    }

    alert("Tracking number updated successfully!");
    await loadArchivedOrders(); // Reload the archived orders table
  } catch (error) {
    console.error("Error updating tracking number:", error.message);
    alert("Failed to update tracking number: " + error.message);
  }
}

async function showOrderItems(orderId) {
  try {
    const response = await fetch(`${BASE_URL}/api/admin/orders/${orderId}/items`);

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
    const orderResponse = await fetch(`${BASE_URL}/api/admin/orders`);
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
            <label>
              <input type="checkbox" class="item-boxed-checkbox" data-product-id="${item.productId}" ${
          orderStatus === "Boxed" || orderStatus === "Shipped" ? "checked" : ""
        } />
              Mark as Boxed
            </label>
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
