document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (token) {
    startTokenTimer();
    initAdminFunctions();
    setupFormListeners();
  } else {
    showAdminLoginModal();
  }
});

function startTokenTimer() {
  const token = localStorage.getItem("token");
  if (!token) return;

  const { exp } = JSON.parse(atob(token.split(".")[1])); // Decode JWT
  const refreshTime = exp * 1000 - Date.now() - 60000;

  setTimeout(refreshAccessToken, Math.max(refreshTime, 0));
}

async function refreshAccessToken() {
  try {
    const response = await fetch("/admin/refresh-token", {
      method: "POST",
      credentials: "include",
    });
    const data = await response.json();
    if (data.accessToken) {
      localStorage.setItem("token", data.accessToken);
      startTokenTimer();
    } else {
      throw new Error("Token refresh failed");
    }
  } catch (error) {
    localStorage.removeItem("token");
    showAdminLoginModal();
  }
}

function showAdminLoginModal() {
  // Grab the login section at the top of the page
  let loginSection = document.getElementById("admin-login");

  if (!loginSection) {
    // Create it dynamically if it doesn't already exist
    loginSection = document.createElement("div");
    loginSection.id = "admin-login";
    document.querySelector("header").appendChild(loginSection); // Add login section to the header
  }

  // Add the login form inside the container
  loginSection.innerHTML = `
    <div>
      <h2>Admin Login</h2>
      <form id="loginForm">
        <input id="email" type="email" required placeholder="Email">
        <input id="password" type="password" required placeholder="Password">
        <button type="submit">Login</button>
      </form>
    </div>`;

  // Attach the onsubmit handler to the login form
  document.getElementById("loginForm").onsubmit = async (e) => {
    e.preventDefault(); // Prevent default form submission

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
      const res = await fetch("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("token", data.token); // Save the token
        loginSection.style.display = "none"; // Hide the login section after successful login
        initAdminFunctions(); // Initialize admin panel functionality
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Login failed. Check your credentials.");
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("An error occurred during login. Please try again later.");
    }
  };

  // Make sure the login section is visible
  loginSection.style.display = "block";
}

function initAdminFunctions() {
  loadAdminProducts();
  loadCategories();
}

async function loadAdminProducts() {
  try {
    const response = await fetch("/admin/products", {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const products = await response.json();

    const tbody = document.querySelector("#admin-products-table tbody");
    tbody.innerHTML = products
      .map(
        (p) => `
        <tr>
          <td>${p.name}</td>
          <td>${p.description}</td>
          <td>$${p.price.toFixed(2)}</td>
          <td>${p.stock_quantity}</td>
          <td>${p.category_name}</td>
          <td>
            <button onclick="editProduct(${p.id})">Edit</button>
            <button onclick="deleteProduct(${
              p.id
            })" class="deleteBtn">Delete</button>
          </td>
        </tr>`
      )
      .join("");
  } catch (error) {
    console.error("Error loading products:", error);
  }
}

async function loadCategories() {
  try {
    const response = await fetch("/categories");
    const categories = await response.json();

    const categorySelect = document.getElementById("productCategory");
    categorySelect.innerHTML = categories
      .map((c) => `<option value="${c.id}">${c.name}</option>`)
      .join("");
  } catch (error) {
    console.error("Error loading categories:", error);
  }
}

async function editProduct(id) {
  try {
    const response = await fetch(`/admin/products/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    const product = await response.json();

    document.getElementById("productId").value = product.id;
    document.getElementById("productName").value = product.name;
    document.getElementById("productDescription").value = product.description;
    document.getElementById("productPrice").value = product.price;
    document.getElementById("productImage").value = product.image_url || "";
    document.getElementById("productStock").value = product.stock_quantity;
    document.getElementById("productCategory").value = product.category_id;

    toggleButtons(true);
  } catch (error) {
    console.error("Error editing product:", error);
  }
}

async function deleteProduct(id) {
  if (!confirm("Are you sure you want to delete this product?")) return;

  try {
    await fetch(`/admin/products/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });

    alert("✅ Product deleted successfully!");
    loadAdminProducts();
  } catch (error) {
    console.error("Error deleting product:", error);
    alert("Failed to delete product.");
  }
}

function toggleButtons(edit) {
  document.getElementById("addProductBtn").style.display = edit
    ? "none"
    : "inline";
  document.getElementById("updateProductBtn").style.display = edit
    ? "inline"
    : "none";
}

function setupFormListeners() {
  document
    .getElementById("addProductBtn")
    .addEventListener("click", () => handleProductFormSubmit(false));
  document
    .getElementById("updateProductBtn")
    .addEventListener("click", () => handleProductFormSubmit(true));
}

async function handleProductFormSubmit(isUpdate) {
  const token = localStorage.getItem("token");
  const id = document.getElementById("productId").value || null;

  const productData = {
    name: document.getElementById("productName").value.trim(),
    description: document.getElementById("productDescription").value.trim(),
    price: parseFloat(document.getElementById("productPrice").value) || 0,
    image_url: document.getElementById("productImage").value.trim(),
    stock_quantity:
      parseInt(document.getElementById("productStock").value) || 0,
    category_id:
      parseInt(document.getElementById("productCategory").value) || null,
    descriptor_id:
      parseInt(document.getElementById("productDescriptor").value) || null,
  };

  if (!productData.name || !productData.price || !productData.category_id || !productData.descriptor_id) {
    alert("Name, price, category, and descriptor are required.");
    return;
  }

  try {
    const url = isUpdate ? `/admin/products/${id}` : "/admin/products";
    const method = isUpdate ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(productData),
    });

    if (!response.ok) {
      throw new Error("Failed to save product.");
    }

    alert(
      isUpdate
        ? "✅ Product updated successfully!"
        : "✅ Product added successfully!"
    );

    document.getElementById("product-form").reset();
    toggleButtons(false); // Switch back to "Add Product" mode
    loadAdminProducts(); // Reload product list
  } catch (error) {
    console.error("Error saving product:", error);
    alert("Failed to save product. Please check the inputs and try again.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadAdminEvents();
});

// Load Events
async function loadAdminEvents() {
  const token = localStorage.getItem("token");
  try {
    const response = await fetch("/admin/events", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const events = await response.json();
    const tbody = document.getElementById("eventTableBody");
    tbody.innerHTML = events
      .map(
        (event) => `
      <tr id="event-${event.id}" 
          data-id="${event.id}" 
          data-title="${event.title}" 
          data-description="${event.description}"
          data-start="${new Date(event.event_start_date).toISOString()}" 
          data-end="${new Date(event.event_end_date).toISOString()}" 
          data-website="${event.event_website}" 
          data-location="${event.location}">
        <td>${event.title}</td>
        <td>${new Date(event.event_start_date).toLocaleString()}</td>
        <td><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}" target="_blank">${event.location}</a></td>
        <td>
          <button onclick="editEvent(${event.id})">Edit</button>
          <button onclick="deleteEvent(${event.id})" class="deleteBtn">Delete</button>
        </td>
      </tr>
    `
      )
      .join("");
  } catch (error) {
    console.error("Error loading events:", error);
  }
}

// Add or Update Event
document.getElementById("event-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = localStorage.getItem("token");
  const id = document.getElementById("eventId").value;
  const eventData = {
    title: document.getElementById("eventTitle").value,
    description: document.getElementById("eventDescription").value,
    event_start_date: new Date(document.getElementById("eventStartDate").value).toISOString(),
    event_end_date: new Date(document.getElementById("eventEndDate").value).toISOString(),
    event_website: document.getElementById("eventWebsite").value,
    location: document.getElementById("eventLocation").value,
  };

  const method = id ? "PUT" : "POST";
  const url = id ? `/admin/events/${id}` : "/admin/events";

  try {
    await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(eventData),
    });
    document.getElementById("event-form").reset();
    loadAdminEvents();
  } catch (error) {
    console.error("Error saving event:", error);
  }
});

// Edit Event
function editEvent(id) {
  const event = document.getElementById(`event-${id}`);
  document.getElementById("eventId").value = id;
  document.getElementById("eventTitle").value = event.dataset.title;
  document.getElementById("eventDescription").value = event.dataset.description;

  // Format the start and end dates to 'YYYY-MM-DDTHH:MM' in local time
  const startDate = new Date(event.dataset.start);
  const endDate = new Date(event.dataset.end);

  document.getElementById("eventStartDate").value = formatLocalDateTime(startDate);
  document.getElementById("eventEndDate").value = formatLocalDateTime(endDate);
  document.getElementById("eventWebsite").value = event.dataset.website;
  document.getElementById("eventLocation").value = event.dataset.location;

  toggleEventButtons(true); // Switch to "Update Event" mode
}

// Helper function to format date to 'YYYY-MM-DDTHH:MM' in local time
function formatLocalDateTime(date) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

// Delete Event
async function deleteEvent(id) {
  if (!confirm("Delete this event?")) return;
  const token = localStorage.getItem("token");
  try {
    const response = await fetch(`/admin/events/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      document.getElementById(`event-${id}`).remove();
      alert("Event deleted successfully!");
    } else {
      throw new Error("Failed to delete event.");
    }
  } catch (error) {
    console.error("Error deleting event:", error);
    alert("Failed to delete event.");
  }
}

function toggleEventButtons(edit) {
  document.getElementById("addEventButton").style.display = edit ? "none" : "inline";
  document.getElementById("updateEventButton").style.display = edit ? "inline" : "none";
}
