document.addEventListener("DOMContentLoaded", async () => {
  await loadOrders(); // Load orders when the page is ready
});

async function loadOrders() {
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

    // Filter out "Shipped" orders from the table
    const filteredOrders = orders.filter(order => order.status !== "Shipped");

    if (filteredOrders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No orders found</td></tr>`;
      return;
    }

    // Clear the table body before populating
    tbody.innerHTML = "";

    // Populate the table rows with filtered orders
    filteredOrders.forEach((order) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${order.id}</td>
        <td>${order.user_name || "N/A"}</td>
        <td>$${order.total_amount.toFixed(2)}</td>
        <td>
          <select onchange="updateOrderStatus(${order.id}, this.value)">
            <option value="Pending" ${order.status === "Pending" ? "selected" : ""}>Pending</option>
            <option value="Processing" ${order.status === "Processing" ? "selected" : ""}>Processing</option>
            <option value="Boxed" ${order.status === "Boxed" ? "selected" : ""}>Boxed</option>
            <option value="Shipped" ${order.status === "Shipped" ? "selected" : ""}>Shipped</option> <!-- Ensure "Shipped" remains -->
          </select>
        </td>
        <td>
          <input 
            type="text" 
            value="${order.tracking_number || ""}" 
            onchange="updateTrackingNumber(${order.id}, this.value)" 
            placeholder="Enter tracking number" 
            ${order.status !== "Shipped" ? "disabled" : ""}
          />
        </td>
        <td>${new Date(order.created_at).toLocaleDateString()}</td>
        <td>
          <button onclick="showOrderItems(${order.id})" class="view-items-btn">View Items</button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // Reinitialize DataTables after dynamically populating the table
    if ($.fn.DataTable.isDataTable("#orders-table")) {
      $('#orders-table').DataTable().destroy(); // Destroy the existing DataTable instance
    }
    $('#orders-table').DataTable({
      paging: true,
      searching: true,
      ordering: true,
      pageLength: 10, // Default number of rows per page
      stateSave: true, // Enable state saving to persist sort order
    });
  } catch (error) {
    console.error("Error loading orders:", error.message);
    alert("Failed to load orders: " + error.message);
  }
}

function filterByStatus() {
  const filterValue = document.getElementById("status-filter").value;
  const rows = document.querySelectorAll("#orders-table tbody tr");

  rows.forEach((row) => {
    const statusCell = row.querySelector("td:nth-child(4) select");
    const status = statusCell ? statusCell.value : "";

    if (filterValue === "All" || status === filterValue) {
      row.style.display = ""; // Show the row
    } else {
      row.style.display = "none"; // Hide the row
    }
  });
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
    const response = await fetch(`http://localhost:5000/api/admin/orders/${orderId}/tracking`, {
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
    await loadOrders(); // Reload the orders table
  } catch (error) {
    console.error("Error updating tracking number:", error.message);
    alert("Failed to update tracking number: " + error.message);
  }
}

async function updateOrderStatus(orderId, newStatus) {
  let trackingNumber = null;

  if (newStatus === "Shipped") {
    trackingNumber = prompt("Enter the tracking number:");
    if (!trackingNumber) {
      alert("Tracking number is required for shipped orders.");
      return;
    }
  }

  try {
    const response = await fetch(`http://localhost:5000/api/admin/orders/${orderId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: newStatus, trackingNumber }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to update order status");
    }

    alert("Order status updated successfully!");
    location.reload(); // Reload the page to reflect the changes
  } catch (error) {
    console.error("Error updating order status:", error.message);
    alert("Failed to update order status: " + error.message);
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
            <label>
              <input type="checkbox" class="item-boxed-checkbox" data-product-id="${item.productId}" ${
          orderStatus === "Shipped" ? "checked" : ""
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
          <button class="verify-boxed-btn" onclick="verifyAllBoxed(${orderId})">Verify All Boxed</button>
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

async function verifyAllBoxed(orderId) {
  const checkboxes = document.querySelectorAll(".item-boxed-checkbox");
  const allChecked = Array.from(checkboxes).every((checkbox) => checkbox.checked);

  if (!allChecked) {
    alert("Please ensure all items are marked as boxed before verifying.");
    return;
  }

  try {
    const response = await fetch(`http://localhost:5000/api/admin/orders/${orderId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "Boxed" }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to update order status to Boxed");
    }

    alert("Order status updated to Boxed successfully!");
    location.reload(); // Reload the page to reflect the changes
  } catch (error) {
    console.error("Error updating order status to Boxed:", error.message);
    alert("Failed to update order status: " + error.message);
  }
}

function closeModal() {
  const modal = document.getElementById("order-items-modal");
  if (modal) {
    modal.remove();
  }
}
