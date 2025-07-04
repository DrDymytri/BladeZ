const BACKEND_URL = process.env.BACKEND_URL; // Use environment variable only

document.addEventListener("DOMContentLoaded", async () => {
  const cartContainer = document.getElementById("cart-container");
  const cartSummaryTableBody = document.querySelector("#cart-summary-table tbody");
  const cartTotalElement = document.getElementById("cart-total");

  // Retrieve cart items from localStorage
  const cartItems = JSON.parse(localStorage.getItem("cart")) || [];

  if (cartItems.length === 0) {
    cartContainer.innerHTML = "<p>Your cart is empty.</p>";
    cartSummaryTableBody.innerHTML = "";
    cartTotalElement.textContent = "0.00";
    return;
  }

  // Fetch product details from the server
  const productDetails = await fetchProductDetails(cartItems.map((item) => item.id));
  if (!productDetails) {
    cartContainer.innerHTML = "<p>Failed to load cart items. Please try again later.</p>";
    cartSummaryTableBody.innerHTML = ""; // Clear the summary table
    cartTotalElement.textContent = "0.00"; // Reset the total
    return;
  }

  // Merge product details with cart items
  const updatedCartItems = cartItems.map((item) => {
    const product = productDetails?.find((p) => p.id === item.id);
    if (!product) {
      console.warn(`Product with ID ${item.id} not found. Using fallback data.`);
    }
    return {
      ...item,
      name: product?.name || item.name,
      price: product?.price || item.price,
      image_url: product?.image_url || item.image_url || '/images/Default1.png', // Prioritize product image, fallback to item image
    };
  });

  // Render cart items
  renderCartItems(updatedCartItems);

  // Calculate and display the total
  const total = updatedCartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  cartTotalElement.textContent = total.toFixed(2);

  // Add event listener for the "Clear Cart" button
  const clearCartButton = document.getElementById("clear-cart-btn");
  if (clearCartButton) {
    clearCartButton.addEventListener("click", () => {
      clearCart();
      alert("Cart cleared!");
    });
  } else {
    console.warn("Clear Cart button not found in the DOM.");
  }

  // Fix: Ensure the checkout button navigates without overwriting the cart in localStorage
  const checkoutButton = document.getElementById("checkout-button");
  if (checkoutButton) {
    checkoutButton.addEventListener("click", () => {
      // Only set the intended destination without modifying the cart
      localStorage.setItem("intendedDestination", "checkout.html");
      window.location.href = "checkout.html"; // Navigate to checkout page
    });
  } else {
    console.warn("Checkout button not found in the DOM.");
  }

  // Add event listener for the "My Orders" button
  const myOrdersButton = document.querySelector('a[href="orders.html"]');
  if (myOrdersButton) {
    myOrdersButton.addEventListener("click", (event) => {
      event.preventDefault(); // Prevent default navigation
      localStorage.setItem("intendedDestination", "orders.html"); // Set intended destination
      window.location.href = "login.html"; // Navigate to login page
    });
  }
});

document.addEventListener("touchstart", () => {
  console.log("Touchstart event triggered."); // Replace with actual logic if needed
});

async function fetchProductDetails(productIds) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/cart-products?ids=${productIds.join(",")}`);
    if (!response.ok) {
      if (response.status === 404) {
        console.warn("Some products were not found. Proceeding with available products.");
        return []; // Return an empty array to allow the cart to proceed
      }
      throw new Error("Failed to fetch product details");
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching product details:", error.message);
    return null;
  }
}

function renderCartItems(cartItems) {
  const cartContainer = document.getElementById("cart-container");
  const cartSummaryTableBody = document.querySelector("#cart-summary-table tbody");

  // Render product cards
  cartContainer.innerHTML = cartItems
    .map(
      (item, index) => `
      <div class="cart-item-card" data-id="${index}">
        <img src="${item.image_url}" alt="${item.name}" class="cart-item-image" />
        <div class="cart-item-details">
          <h3>${item.name}</h3>
          <p><strong class="price-label">Price:</strong> <span class="price">$${item.price.toFixed(2)}</span></p>
          <p>Quantity: ${item.quantity}</p>
        </div>
        <div class="cart-item-actions">
          <button class="decrease-quantity-btn" data-id="${index}">-</button>
          <button class="increase-quantity-btn" data-id="${index}">+</button>
          <button class="remove-item-btn" data-id="${index}">Remove</button>
        </div>
      </div>
    `
    )
    .join("");

  // Render cart summary table rows
  cartSummaryTableBody.innerHTML = cartItems
    .map(
      (item) => `
      <tr>
        <td>${item.name}</td>
        <td>$${item.price.toFixed(2)}</td>
        <td>${item.quantity}</td>
        <td>$${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `
    )
    .join("");

  attachEventListeners(cartItems); // Ensure buttons are functional
}

function attachEventListeners(cartItems) {
  // Remove existing event listeners by cloning the buttons
  const removeButtons = document.querySelectorAll(".remove-item-btn");
  const decreaseButtons = document.querySelectorAll(".decrease-quantity-btn");
  const increaseButtons = document.querySelectorAll(".increase-quantity-btn");

  removeButtons.forEach((button) => {
    const clonedButton = button.cloneNode(true);
    button.parentNode.replaceChild(clonedButton, button);
  });

  decreaseButtons.forEach((button) => {
    const clonedButton = button.cloneNode(true);
    button.parentNode.replaceChild(clonedButton, button);
  });

  increaseButtons.forEach((button) => {
    const clonedButton = button.cloneNode(true);
    button.parentNode.replaceChild(clonedButton, button);
  });

  // Add new event listeners
  document.querySelectorAll(".remove-item-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const cartId = event.target.dataset.id;
      removeItemFromCart(cartId, cartItems);
    });
  });

  document.querySelectorAll(".decrease-quantity-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const cartId = event.target.dataset.id;
      decreaseItemQuantity(cartId, cartItems);
    });
  });

  document.querySelectorAll(".increase-quantity-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const cartId = event.target.dataset.id;
      increaseItemQuantity(cartId, cartItems);
    });
  });
}

async function syncCartWithBackend(cartItems) {
  const sessionId = document.cookie
    .split("; ")
    .find((row) => row.startsWith("session_id="))
    ?.split("=")[1];

  if (!sessionId) {
    console.warn("No session ID available. Skipping cart sync.");
    return;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/cart/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ items: cartItems }), // Only send cart items
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error syncing cart:", errorText);
    }
  } catch (error) {
    console.error("Error syncing cart with backend:", error.message);
  }
}

function removeItemFromCart(cartId, cartItems) {
  // Remove the item from the cart
  cartItems.splice(cartId, 1);
  localStorage.setItem("cart", JSON.stringify(cartItems));

  // Sync with backend
  syncCartWithBackend(cartItems);

  // Update the cart items in the UI
  renderCartItems(cartItems);
  updateTotal(cartItems);
  attachEventListeners(cartItems);

  // Update the cart count
  updateCartCount();

  // Show a message if the cart is empty
  if (cartItems.length === 0) {
    document.getElementById("cart-container").innerHTML = "<p>Your cart is empty.</p>";
  }
}

function decreaseItemQuantity(cartId, cartItems) {
  const item = cartItems[cartId];
  if (item.quantity > 1) {
    item.quantity -= 1;
    localStorage.setItem("cart", JSON.stringify(cartItems)); // Save updated cart to localStorage

    // Sync with backend
    syncCartWithBackend(cartItems);

    renderCartItems(cartItems);
    updateTotal(cartItems);
    attachEventListeners(cartItems);

    // Update the cart count
    updateCartCount();
  } else {
    removeItemFromCart(cartId, cartItems); // Remove the item if quantity reaches 0
  }
}

function increaseItemQuantity(cartId, cartItems) {
  const item = cartItems[cartId];
  item.quantity += 1;
  localStorage.setItem("cart", JSON.stringify(cartItems)); // Save updated cart to localStorage

  // Sync with backend
  syncCartWithBackend(cartItems);

  renderCartItems(cartItems);
  updateTotal(cartItems);
  attachEventListeners(cartItems);

  // Update the cart count
  updateCartCount();
}

function updateTotal(cartItems) {
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  document.getElementById("cart-total").textContent = total.toFixed(2);
}

function clearCart() {
  // Clear the cart in localStorage
  localStorage.removeItem("cart");

  // Clear PayPal-related data
  localStorage.removeItem("paypalOrderId");
  localStorage.removeItem("paypalPaymentDetails");
  localStorage.removeItem("token"); // Optionally clear the token if you want to log out the user

  // Sync with backend
  syncCartWithBackend([]);

  // Update the UI
  document.getElementById("cart-container").innerHTML = "<p>Your cart is empty.</p>";
  document.getElementById("cart-total").textContent = "0.00";

  // Clear the cart summary table
  const cartSummaryTableBody = document.querySelector("#cart-summary-table tbody");
  if (cartSummaryTableBody) {
    cartSummaryTableBody.innerHTML = "";
  }

  // Update the cart count
  const cartCountElement = document.getElementById("cart-count");
  if (cartCountElement) {
    cartCountElement.textContent = "0";
  }
}

function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalQuantity = cart.reduce((count, item) => count + item.quantity, 0);
  const cartCountElement = document.getElementById("cart-count");

  if (cartCountElement) {
    cartCountElement.textContent = totalQuantity;
  } else {
    console.warn("Cart count element not found in the DOM."); // Handle missing element gracefully
  }
}

// Ensure the cart variable is defined and initialized
let cart = JSON.parse(localStorage.getItem("cart")) || [];

// Ensure the button exists before adding the event listener
const someButton = document.querySelector("#checkout-button");
if (someButton) {
  someButton.addEventListener("click", () => {
    // Ensure cart is accessible here
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    console.log(cart); // Log the cart to verify its contents
    // ...add your logic here...
  });
} else {
  console.warn("Button with ID 'checkout-button' not found in the DOM.");
}

// Ensure the checkout button exists before adding the event listener
const checkoutButton = document.getElementById("checkout-button");
if (checkoutButton) {
  checkoutButton.addEventListener("click", function () {
    // Only set the intended destination without modifying the cart
    localStorage.setItem("intendedDestination", "checkout.html");
    window.location.href = "checkout.html"; // Navigate to checkout page
  });
} else {
  console.warn("Checkout button not found in the DOM.");
}

document.addEventListener("DOMContentLoaded", async () => {
  const checkoutButton = document.getElementById("checkout-button");

  if (checkoutButton) {
    checkoutButton.addEventListener("click", async () => {
      const cartItems = JSON.parse(localStorage.getItem("cart")) || []; // Get cart items from localStorage

      if (cartItems.length === 0) {
        alert("Your cart is empty. Please add items before proceeding to checkout.");
        return;
      }

      // Ensure Stripe library is loaded
      if (typeof Stripe === "undefined") {
        console.error("Stripe library is not loaded.");
        alert("Failed to load Stripe library. Please refresh the page and try again.");
        return;
      }

      const stripe = Stripe("pk_test_51R6vESFYn7sHYN0fcoSvCAZfuigJ1DkuyUVHFRdmghYeXCWetZf17MBOlkdyFKCWP5USQKWA75vJwoMsxy1kdtTf00bKQ7OBbJ");

      try {
        // Send cart items to the backend to create a Stripe Checkout session
        const response = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartItems }),
        });

        if (!response.ok) {
          const errorText = await response.text(); // Log response body for debugging
          console.error("Error response from server:", errorText);
          throw new Error("Failed to create Stripe Checkout session");
        }

        const { url } = await response.json();

        // Redirect to Stripe Checkout
        window.location.href = url;
      } catch (error) {
        console.error("Error redirecting to Stripe Checkout:", error.message);
        alert("Failed to proceed to checkout. Please try again.");
      }
    });
  } else {
    console.warn("Checkout button not found in the DOM.");
  }
});

