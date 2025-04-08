document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Please log in to proceed to checkout.");
    localStorage.setItem("intendedDestination", "checkout.html"); // Save intended destination
    console.log("Intended destination set to checkout.html"); // Debugging log
    window.location.href = "login.html";
    return;
  }

  try {
    // Fetch user information
    const userInfo = await fetchUserInfo();
    if (!userInfo) return; // Exit if user info could not be fetched
    populateUserDetails(userInfo);

    // Retrieve cart from localStorage and handle empty cart
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    if (cart.length === 0) {
      alert("Your cart is empty. Please add items to your cart before proceeding to checkout.");
      window.location.href = "cart.html";
      return;
    }

    // Render cart items and update total
    renderCheckoutItems(cart);
    updateTotal(cart);

    // Initialize payment options
    initializeCreditCardPayment(cart);
    await loadPayPalScript(); // Ensure PayPal script is loaded before initializing buttons
    initializePayPalButtons(cart); // Initialize PayPal buttons after script loads
  } catch (error) {
    console.error("Error loading checkout page:", error.message);
    alert("Error loading checkout page: " + error.message);
  }

  // Add a beforeunload event listener to clean up PayPal storage
  window.addEventListener("beforeunload", () => {
    localStorage.removeItem("_paypal_storage_");
  });
});

document.addEventListener("touchstart", () => {
  console.log("Touchstart event triggered."); // Replace with actual logic if needed
}, { passive: true }); // Mark event listener as passive

async function fetchUserInfo() {
  const token = localStorage.getItem("token");
  if (!token) {
    console.error("No token found in localStorage.");
    throw new Error("User is not logged in.");
  }

  try {
    const response = await fetch("http://localhost:5000/api/user-info", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text(); // Log response for debugging
      console.error("Failed to fetch user information. Response status:", response.status);
      console.error("Response body:", errorText);

      if (response.status === 403) {
        const errorData = JSON.parse(errorText);
        if (errorData.error === "Invalid or expired token.") {
          console.warn("Token expired. Redirecting to login.");
          localStorage.removeItem("token"); // Remove expired token
          alert("Session expired. Please log in again.");
          localStorage.setItem("intendedDestination", "checkout.html"); // Save intended destination
          console.log("Intended destination set to checkout.html"); // Debugging log
          window.location.href = "login.html"; // Redirect to login page
          return null; // Exit function
        }
      }

      throw new Error("Failed to fetch user information.");
    }

    return await response.json();
  } catch (error) {
    console.error("Error in fetchUserInfo:", error.message);
    throw error;
  }
}

function populateUserDetails(userInfo) {
  if (!userInfo) {
    console.error("User information is undefined or null.");
    alert("Failed to load user details. Please try again.");
    return;
  }

  document.getElementById("first-name").value = userInfo.first_name || "";
  document.getElementById("last-name").value = userInfo.last_name || "";
  document.getElementById("email").value = userInfo.email || "";
  document.getElementById("address").value = userInfo.address || "";
}

function renderCheckoutItems(cartItems) {
  const cartItemsContainer = document.getElementById("cart-items");
  cartItemsContainer.innerHTML = cartItems
    .map((item) => `
      <div class="cart-item">
        <div class="cart-item-details">
          <h4>${item.name}</h4>
          <p>Quantity: ${item.quantity}</p>
          <p>Total: $${(item.price * item.quantity).toFixed(2)}</p>
        </div>
      </div>
    `)
    .join("");
}

function updateTotal(cartItems) {
  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  document.getElementById("cart-total").textContent = total.toFixed(2);
}

function initializeCreditCardPayment(cart) {
  const stripe = Stripe("pk_test_51R6vESFYn7sHYN0fcoSvCAZfuigJ1DkuyUVHFRdmghYeXCWetZf17MBOlkdyFKCWP5USQKWA75vJwoMsxy1kdtTf00bKQ7OBbJ");
  const elements = stripe.elements();
  const cardElement = elements.create("card", { style: { base: { fontSize: "16px", color: "#32325d" } } });
  cardElement.mount("#card-element");

  document.getElementById("pay-now-btn-card").addEventListener("click", async () => {
    try {
      const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

      // Create payment intent
      const paymentIntent = await createPaymentIntent(total, cart);

      // Confirm payment
      await confirmPayment(stripe, cardElement, paymentIntent.clientSecret);

      // Place order
      await placeOrder(cart, total);
      alert("Payment successful! Your order has been placed.");
      window.location.href = "orders.html";
    } catch (error) {
      console.error("Error during payment:", error.message);
      alert("Payment failed: " + error.message);
    }
  });
}

async function createPaymentIntent(amount, cart) {
  const response = await fetch("http://localhost:5000/api/create-payment-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
    body: JSON.stringify({ amount, cart }), // Pass cart details to the backend
  });
  if (!response.ok) throw new Error("Failed to create payment intent");
  return response.json();
}

async function confirmPayment(stripe, cardElement, clientSecret) {
  const { error } = await stripe.confirmCardPayment(clientSecret, {
    payment_method: { card: cardElement, billing_details: { name: `${document.getElementById("first-name").value} ${document.getElementById("last-name").value}` } },
  });
  if (error) throw new Error(error.message);
}

async function placeOrder(cartItems, total) {
  const response = await fetch("http://localhost:5000/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
    body: JSON.stringify({ items: cartItems, total }),
  });
  if (!response.ok) throw new Error("Failed to place order");

  // Clear the cart after placing the order
  localStorage.removeItem("cart");
  document.getElementById("cart-items").innerHTML = "<p>Your cart is empty.</p>";
  document.getElementById("cart-total").textContent = "0.00";

  // Update the cart count
  const cartCountElement = document.getElementById("cart-count");
  if (cartCountElement) {
    cartCountElement.textContent = "0";
  }
}

async function loadPayPalScript() {
  try {
    const response = await fetch("/api/paypal-client-id");
    if (!response.ok) throw new Error("Failed to fetch PayPal client ID");
    const { clientId } = await response.json();

    if (document.querySelector(`script[src*="paypal.com/sdk/js"]`)) {
      console.warn("PayPal SDK script is already loaded.");
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
    script.onload = () => {
      console.log("PayPal SDK loaded successfully.");
    };
    script.onerror = () => console.error("Failed to load PayPal SDK.");
    document.head.appendChild(script);
  } catch (error) {
    console.error("Error loading PayPal script:", error.message);
  }
}

// Ensure PayPal buttons are initialized only when the script is loaded
document.addEventListener("DOMContentLoaded", () => {
  loadPayPalScript();
});

function initializePayPalButtons(cart) {
  console.log("Initializing PayPal buttons...");
  const paypalButtonContainer = document.getElementById("paypal-button-container");

  if (!paypalButtonContainer) {
    console.error("PayPal button container not found in the DOM. Skipping initialization.");
    return;
  }

  if (typeof paypal === "undefined" || !paypal.Buttons) {
    console.error("PayPal SDK not loaded. Ensure the PayPal script is included in the HTML and the client ID is valid.");
    return;
  }

  paypalButtonContainer.innerHTML = ""; // Clear any existing buttons

  paypal.Buttons({
    style: { layout: "vertical", color: "blue", shape: "rect", label: "paypal" },
    createOrder: async () => {
      const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const response = await fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ items: cart, total }),
      });
      if (!response.ok) throw new Error("Failed to create PayPal order");
      const { orderId } = await response.json();
      return orderId;
    },
    onApprove: async (data) => {
      const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const response = await fetch("/api/paypal/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ orderId: data.orderID, items: cart, total }),
      });
      if (!response.ok) throw new Error("Failed to capture PayPal order");
      alert("Payment successful! Your order has been placed.");
      localStorage.removeItem("cart");
      window.location.href = "orders.html";
    },
    onError: (err) => {
      console.error("PayPal error:", err);
      alert("An error occurred during the PayPal payment process. Please try again.");
    },
  }).render("#paypal-button-container");
}

// Observe PayPal container to ensure it exists before initialization
function observePayPalContainer() {
  const paypalButtonContainer = document.getElementById("paypal-button-container");

  if (!paypalButtonContainer) {
    console.error("PayPal button container not found in the DOM. Skipping observation.");
    return;
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.removedNodes.length > 0) {
        console.warn("PayPal button container was removed from the DOM. Reinitializing...");
        initializePayPalButtons(JSON.parse(localStorage.getItem("cart")) || []);
      }
    });
  });

  observer.observe(paypalButtonContainer.parentNode, { childList: true });
}

// Ensure PayPal buttons are initialized only when the container exists
document.addEventListener("DOMContentLoaded", () => {
  const paypalButtonContainer = document.getElementById("paypal-button-container");
  if (paypalButtonContainer) {
    initializePayPalButtons(JSON.parse(localStorage.getItem("cart")) || []);
  } else {
    console.error("PayPal button container not found during DOMContentLoaded.");
  }
});