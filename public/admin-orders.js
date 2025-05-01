document.addEventListener("DOMContentLoaded", async () => {
  await loadOrders(); // Load orders when the page is ready
});

async function loadOrders() {
  const tbody = document.querySelector("#orders-table tbody");
  const statusFilter = document.getElementById("status-filter"); // Reference to the dropdown
  if (!tbody || !statusFilter) {
    console.error("Table body or status filter not found. Ensure the #orders-table and #status-filter exist in the HTML.");
    return;
  }

  try {
    const response = await fetch("http://localhost:5000/api/admin/orders");
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch orders");
    }

    const orders = await response.json();

    // Filter out orders with the "Closed" status
    const filteredOrders = orders.filter(order => order.status !== "Closed");

    // Define the correct order of statuses
    const statusOrder = ["Pending", "Processing", "Boxed", "Shipped"];

    // Extract unique statuses from the filtered orders
    const uniqueStatuses = [...new Set(filteredOrders.map(order => order.status))];

    // Populate the "Filter by Status" dropdown dynamically, excluding statuses with no orders
    statusFilter.innerHTML = `<option value="All">All</option>`; // Always include "All"
    statusOrder.forEach(status => {
      if (uniqueStatuses.includes(status)) {
        statusFilter.innerHTML += `<option value="${status}">${status}</option>`;
      }
    });

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
            ${statusOrder.map(status => `
              <option value="${status}" ${order.status === status ? "selected" : ""}>${status}</option>
            `).join("")}
            <option value="Closed" ${order.status === "Closed" ? "selected" : ""}>Closed</option>
          </select>
        </td>
        <td>
          ${
            order.tracking_number
              ? `<input 
                  type="text" 
                  value="${order.tracking_number}" 
                  onchange="updateTrackingNumber(${order.id}, this.value)" 
                  placeholder="Enter tracking number" 
                />`
              : `<span style="color: gray;">N/A</span>`
          }
        </td>
        <td>${new Date(order.created_at).toLocaleDateString()}</td>
        <td>${order.shipped_date ? new Date(order.shipped_date).toLocaleString() : "N/A"}</td> <!-- Render shipped_date with date and time -->
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

async function filterByStatus() {
  const filterValue = document.getElementById("status-filter").value;

  try {
    const response = await fetch(`http://localhost:5000/api/admin/orders?status=${filterValue}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to fetch filtered orders");
    }

    let filteredOrders = await response.json();

    // Exclude "Closed" orders when the "All" filter is selected
    if (filterValue === "All") {
      filteredOrders = filteredOrders.filter(order => order.status !== "Closed");
    }

    const tbody = document.querySelector("#orders-table tbody");
    if (!tbody) {
      console.error("Table body not found. Ensure the #orders-table and its <tbody> exist in the HTML.");
      return;
    }

    // Destroy the existing DataTable instance before updating the table
    if ($.fn.DataTable.isDataTable("#orders-table")) {
      $('#orders-table').DataTable().destroy();
    }

    // Clear the table body before populating
    tbody.innerHTML = "";

    if (filteredOrders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center;">No orders found</td></tr>`;
    } else {
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
              <option value="Shipped" ${order.status === "Shipped" ? "selected" : ""}>Shipped</option>
              <option value="Closed" ${order.status === "Closed" ? "selected" : ""}>Closed</option>
            </select>
          </td>
          <td>
            ${
              order.tracking_number
                ? `<input 
                    type="text" 
                    value="${order.tracking_number}" 
                    onchange="updateTrackingNumber(${order.id}, this.value)" 
                    placeholder="Enter tracking number" 
                  />`
                : `<span style="color: gray;">N/A</span>`
            }
          </td>
          <td>${new Date(order.created_at).toLocaleDateString()}</td>
          <td>${order.shipped_date ? new Date(order.shipped_date).toLocaleString() : "N/A"}</td> <!-- Render shipped_date with date and time -->
          <td>
            <button onclick="showOrderItems(${order.id})" class="view-items-btn">View Items</button>
          </td>
        `;
        tbody.appendChild(row);
      });
    }

    // Reinitialize DataTables after updating the table
    $('#orders-table').DataTable({
      paging: true,
      searching: true,
      ordering: true,
      pageLength: 10, // Default number of rows per page
      stateSave: true, // Enable state saving to persist sort order
    });
  } catch (error) {
    console.error("Error filtering orders:", error.message);
    alert("Failed to filter orders: " + error.message);
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
  const statusDropdown = document.querySelector(`select[onchange="updateOrderStatus(${orderId}, this.value)"]`);
  const originalStatus = statusDropdown.value; // Store the original status

  if (newStatus === "Processing") {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update order status to Processing");
      }

      alert("Order status successfully updated to Processing!");
    } catch (error) {
      console.error("Error updating order status to Processing:", error.message);
      alert("Failed to update order status: " + error.message);
      statusDropdown.value = originalStatus; // Revert the dropdown to its original value
    }
    location.reload(); // Refresh the page to reflect the updated status
    return; // Exit the function to avoid affecting other statuses
  }

  if (newStatus === "Boxed") {
    // Fetch the order items to check if all are marked as "Boxed"
    try {
      const response = await fetch(`http://localhost:5000/api/admin/orders/${orderId}/items`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch order items");
      }

      const items = await response.json();
      const allBoxed = items.every((item) => {
        const checkbox = document.querySelector(`.item-boxed-checkbox[data-product-id="${item.productId}"]`);
        return checkbox && checkbox.checked;
      });

      if (!allBoxed) {
        alert("All items must be marked as 'Boxed' in the 'View Items' modal before changing the status to 'Boxed'.");
        location.reload(); // Refresh the page after the alert
        return;
      }
    } catch (error) {
      console.error("Error validating boxed items:", error.message);
      alert("Failed to validate boxed items. Please try again.");
      location.reload(); // Refresh the page after the alert
      return;
    }
  }

  if (newStatus === "Shipped") {
    const trackingNumber = prompt("Enter the tracking number:");
    if (!trackingNumber) {
      alert("Tracking number is required for shipped orders.");
      statusDropdown.value = originalStatus; // Revert the dropdown to its original value
      return;
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

      alert("Order status updated successfully! Use the email link in the 'View Items' modal to notify the customer.");
      location.reload(); // Refresh the page to reflect the updated status
    } catch (error) {
      console.error("Error updating order status:", error.message);
      alert("Failed to update order status: " + error.message);
      statusDropdown.value = originalStatus; // Revert the dropdown to its original value
    }
  }

  if (newStatus === "Closed") {
    // Show the first modal to confirm intent to close the order
    const confirmModalHtml = `
      <div id="confirm-intent-modal" class="modal" style="display: block; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);">
        <div class="modal-content">
          <h2>Confirm Close Order</h2>
          <p>Are you sure you want to close this order? This action cannot be undone.</p>
          <button id="confirm-intent-btn" style="margin-right: 10px;">Yes, Close Order</button>
          <button id="cancel-intent-btn">Cancel</button>
        </div>
      </div>
    `;

    // Add the first modal to the DOM
    document.body.insertAdjacentHTML("beforeend", confirmModalHtml);

    // Attach event listeners for the first modal buttons
    document.getElementById("confirm-intent-btn").addEventListener("click", () => {
      document.getElementById("confirm-intent-modal").remove(); // Remove the first modal

      // Show the second modal to collect confirmation number and date/time
      const inputModalHtml = `
        <div id="confirmation-modal" class="modal" style="display: block; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);">
          <div class="modal-content">
            <h2>Close Order</h2>
            <label for="confirmation-number">Confirmation Number:</label>
            <input type="text" id="confirmation-number" placeholder="Enter confirmation number" required style="display: block; margin-bottom: 10px; width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
            <label for="confirmation-date-time">Confirmation Date and Time:</label>
            <input type="datetime-local" id="confirmation-date-time" required style="display: block; margin-bottom: 10px; width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" />
            <button id="confirm-close-btn" style="margin-right: 10px;">Confirm</button>
            <button id="cancel-close-btn">Cancel</button>
          </div>
        </div>
      `;

      // Add the second modal to the DOM
      document.body.insertAdjacentHTML("beforeend", inputModalHtml);

      // Attach event listeners for the second modal buttons
      document.getElementById("confirm-close-btn").addEventListener("click", async () => {
        const confirmationNumber = document.getElementById("confirmation-number").value;
        const confirmationDateTime = document.getElementById("confirmation-date-time").value;

        if (!confirmationNumber || !confirmationDateTime) {
          alert("Both confirmation number and date/time are required.");
          return;
        }

        try {
          const response = await fetch(`http://localhost:5000/api/admin/orders/${orderId}/status`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              status: newStatus,
              receivedConfirmationNumber: confirmationNumber,
              confirmationDateTime,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to close the order");
          }

          alert("Order closed successfully!");
          document.getElementById("confirmation-modal").remove(); // Remove the second modal
          filterByStatus(); // Refresh the table to remove the closed order
        } catch (error) {
          console.error("Error closing the order:", error.message);
          alert("Failed to close the order: " + error.message);
          statusDropdown.value = originalStatus; // Revert the dropdown to its original value
        }
      });

      document.getElementById("cancel-close-btn").addEventListener("click", () => {
        document.getElementById("confirmation-modal").remove(); // Remove the second modal
        statusDropdown.value = originalStatus; // Revert the dropdown to its original value
      });
    });

    document.getElementById("cancel-intent-btn").addEventListener("click", () => {
      document.getElementById("confirm-intent-modal").remove(); // Remove the first modal
      statusDropdown.value = originalStatus; // Revert the dropdown to its original value
    });

    return; // Exit the function to wait for modal input
  }
}

async function sendEmail(orderId, email, trackingNumber) {
  try {
    const response = await fetch(`http://localhost:5000/api/admin/orders/${orderId}/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, trackingNumber }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to send email");
    }

    alert("Email sent successfully!");
  } catch (error) {
    console.error("Error sending email:", error.message);
    alert("Failed to send email: " + error.message);
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

    // Fetch the order details to get the status and tracking number
    const orderResponse = await fetch(`http://localhost:5000/api/admin/orders`);
    if (!orderResponse.ok) {
      const errorData = await orderResponse.json();
      throw new Error(errorData.error || "Failed to fetch order details");
    }

    const orders = await orderResponse.json();
    const order = orders.find((o) => o.id === orderId);
    const orderStatus = order?.status || "Unknown";
    const trackingNumber = order?.tracking_number || "N/A";

    // Fetch the user information for the order
    const userResponse = await fetch(`http://localhost:5000/api/admin/orders/${orderId}/user`);
    if (!userResponse.ok) {
      const errorData = await userResponse.json();
      throw new Error(errorData.error || "Failed to fetch user information");
    }

    const user = await userResponse.json();

    // Generate the list of purchased items
    const purchasedItems = items
      .map((item) => `- ✅ ${item.productName} (Quantity: ${item.quantity})`)
      .join("\n");

    // Generate the email body only if the status is "Shipped"
    let emailBody = "";
    if (orderStatus === "Shipped") {
      emailBody = `
        Dear ${user.first_name},\n\n
        Your order has been shipped!\n\n
        Here is your tracking number: ${trackingNumber}.\n\n
        Purchased Items:\n
        ${purchasedItems}\n\n
        Instructions to find your order on the BladeZ website:\n
        1. Go to the BladeZ website by clicking here: http://localhost:5000/landing.html\n
        2. Enter the Realm.\n
        3. Close the showcased items unless you see something else you want to purchase.\n
        4. Go to Cart.\n
        5. Go to My Orders.\n
        6. Log into your account.\n\n
        Thank you for your purchase!\n\n
        Best regards,\n
        BladeZ Team
      `.trim();

      // Encode the email body for the mailto link
      emailBody = encodeURIComponent(emailBody);
    }

    // Generate HTML for the modal with user details, order number, and items
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
                ["Boxed", "Shipped", "Closed"].includes(orderStatus) ? "checked" : ""
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
          <h2>Order Details</h2>
          <p><strong>Order Number:</strong> ${orderId}</p>
          <div class="user-details">
            <p><strong>First Name:</strong> ${user.first_name}</p>
            <p><strong>Last Name:</strong> ${user.last_name}</p>
            <p><strong>Email:</strong> <a href="mailto:${user.email}?subject=${orderStatus === "Shipped" ? "BladeZ - Your Product(s) have been Shipped" : ""}&body=${emailBody}" style="text-decoration: underline; color: blue;">${user.email}</a></p>
            <p><strong>Phone:</strong> ${user.phone}</p>
            <p><strong>Address:</strong> ${user.address}</p>
          </div>
          <h3>Purchased Items:</h3>
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
    console.error("Error fetching order items or user information:", error.message);
    alert("Failed to fetch order details: " + error.message);
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
