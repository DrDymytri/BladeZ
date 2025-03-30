document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Please log in to proceed to checkout.");
    localStorage.setItem("redirectAfterLogin", "checkout.html");
    window.location.href = "login.html";
    return;
  }

  const stripe = Stripe("pk_test_51R6vESFYn7sHYN0fcoSvCAZfuigJ1DkuyUVHFRdmghYeXCWetZf17MBOlkdyFKCWP5USQKWA75vJwoMsxy1kdtTf00bKQ7OBbJ"); // Replace with your actual Stripe publishable key
  const elements = stripe.elements();
  const cardElement = elements.create("card");
  cardElement.mount("#card-element");

  try {
    // Fetch user information
    const userResponse = await fetchWithTokenRefresh("http://localhost:5000/api/user-info");
    if (!userResponse.ok) throw new Error("Failed to fetch user information");

    const userInfo = await userResponse.json();
    document.getElementById("first-name").value = userInfo.first_name || "";
    document.getElementById("last-name").value = userInfo.last_name || "";
    document.getElementById("email").value = userInfo.email || "";
    document.getElementById("address").value = userInfo.address || "";

    // Load cart details
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    if (cart.length === 0) {
      alert("Your cart is empty. Please add items to your cart before proceeding to checkout.");
      window.location.href = "index.html";
      return;
    }

    renderCheckoutItems(cart);
    updateTotal(cart);

    // Handle form submission
    document.getElementById("checkout-form").addEventListener("submit", async (event) => {
      event.preventDefault();

      try {
        const cart = JSON.parse(localStorage.getItem("cart")) || [];
        if (cart.length === 0) {
          alert("Your cart is empty. Please add items to your cart before proceeding to checkout.");
          return;
        }

        const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

        // Create a payment intent with Stripe
        const stripeResponse = await fetch("http://localhost:5000/api/create-payment-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ amount: total }),
        });

        if (!stripeResponse.ok) {
          const error = await stripeResponse.json();
          throw new Error(error.error || "Failed to create payment intent");
        }

        const { paymentIntentId, clientSecret } = await stripeResponse.json();

        if (!clientSecret) {
          throw new Error("Missing client_secret from server response");
        }

        // Confirm the payment method with Stripe
        const { error: stripeError } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: `${document.getElementById("first-name").value} ${document.getElementById("last-name").value}`,
              email: document.getElementById("email").value,
              address: {
                line1: document.getElementById("address").value,
              },
            },
          },
        });

        if (stripeError) {
          console.error("Stripe Payment Error:", stripeError.message);
          throw new Error(stripeError.message || "Failed to confirm payment method");
        }

        // Send checkout request to the server
        const checkoutResponse = await fetch("http://localhost:5000/api/mastercard-checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            items: cart,
            total,
            paymentIntentId, // Include the payment intent ID
          }),
        });

        if (!checkoutResponse.ok) {
          const error = await checkoutResponse.json();
          console.error("Server Response Error:", error); // Log server response for debugging
          throw new Error(error.error || "Failed to complete checkout");
        }

        alert("Checkout successful!");
        localStorage.removeItem("cart"); // Clear the cart
        window.location.href = "orders.html"; // Redirect to orders page
      } catch (error) {
        console.error("Error during checkout:", error.message);
        alert("Error during checkout: " + error.message);
      }
    });

    // Example of adding a passive event listener
    document.addEventListener("touchstart", (event) => {
      console.log("Touchstart event triggered");
    }, { passive: true });

  } catch (error) {
    console.error("Error loading checkout page:", error);
    alert("Error loading checkout page: " + error.message);
  }
});

function renderCheckoutItems(cartItems) {
  const cartItemsContainer = document.getElementById("cart-items");
  if (!cartItemsContainer) {
    console.error("Cart items container not found in the DOM.");
    return;
  }

  cartItemsContainer.innerHTML = cartItems
    .map(
      (item) => `
      <div class="checkout-item">
        <img src="${item.image_url || './images/default-image.jpg'}" alt="${item.name}" class="checkout-item-image" />
        <div class="checkout-item-details">
          <h3>${item.name}</h3>
          <p>Price: $${item.price.toFixed(2)}</p>
          <p>Quantity: ${item.quantity}</p>
          <p>Total: $${(item.price * item.quantity).toFixed(2)}</p>
        </div>
      </div>
    `
    )
    .join("");
}

function updateTotal(cartItems) {
  const cartTotalElement = document.getElementById("cart-total");
  if (!cartTotalElement) {
    console.error("Cart total element not found in the DOM.");
    return;
  }

  const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  cartTotalElement.textContent = total.toFixed(2);
}

function getCardDetails() {
  const cardNumber = document.getElementById("card-number").value;
  const expiry = document.getElementById("expiry-date").value;
  const cvv = document.getElementById("cvv").value;
  return { cardNumber, expiry, cvv };
}

async function processCardPayment(cardDetails) {
  const response = await fetch("/process-card-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cardDetails),
  });
  return response.json();
}

function handlePaymentResponse(response) {
  if (response.success) {
    alert("Payment successful!");
    localStorage.removeItem("cart");
    window.location.href = "orders.html";
  } else {
    alert("Payment failed: " + response.message);
  }
}

async function fetchWithTokenRefresh(url, options = {}) {
  let token = localStorage.getItem("token");
  if (!token) throw new Error("No token available");

  options.headers = { ...options.headers, Authorization: `Bearer ${token}` };

  let response = await fetch(url, options);
  if (response.status === 401) {
    const refreshResponse = await fetch("http://localhost:5000/api/refresh-token", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (refreshResponse.ok) {
      const { token: newToken } = await refreshResponse.json();
      localStorage.setItem("token", newToken);
      options.headers.Authorization = `Bearer ${newToken}`;
      response = await fetch(url, options);
    } else {
      localStorage.removeItem("token");
      alert("Session expired. Please log in again.");
      window.location.href = "login.html";
      throw new Error("Failed to refresh token");
    }
  }

  return response;
}

async function updateInventory(items) {
  try {
    const response = await fetch("http://localhost:5000/api/update-inventory", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ items }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update inventory");
    }

    const { lowStockItems } = await response.json();
    if (lowStockItems && lowStockItems.length > 0) {
      alert(
        `The following items are low in stock and need restocking: ${lowStockItems
          .map((item) => item.name)
          .join(", ")}`
      );
    }
  } catch (error) {
    console.error("Error updating inventory:", error.message);
    alert("An error occurred while updating inventory. Please contact support.");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const checkoutButton = document.getElementById("checkout-button");

  if (!checkoutButton) {
    console.warn("Checkout button not found in the DOM.");
    return; // Exit early if the button is not found
  }

  checkoutButton.addEventListener("click", async () => {
    try {
      const cart = JSON.parse(localStorage.getItem("cart")) || [];
      if (cart.length === 0) {
        alert("Your cart is empty.");
        return;
      }

      // Calculate total amount
      const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

      // Create a payment intent with Stripe
      const stripeResponse = await fetch("http://localhost:5000/api/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ amount: total }),
      });

      if (!stripeResponse.ok) {
        throw new Error("Failed to create payment intent");
      }

      const { paymentIntentId } = await stripeResponse.json();

      // Send checkout request to the server
      const checkoutResponse = await fetch("http://localhost:5000/api/mastercard-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          items: cart,
          total,
          paymentIntentId, // Include the payment intent ID
        }),
      });

      if (!checkoutResponse.ok) {
        const error = await checkoutResponse.json();
        throw new Error(error.error || "Failed to complete checkout");
      }

      alert("Checkout successful!");
      localStorage.removeItem("cart"); // Clear the cart
      window.location.href = "orders.html"; // Redirect to orders page
    } catch (error) {
      console.error("Error during checkout:", error.message);
      alert("Error during checkout: " + error.message);
    }
  });
});
