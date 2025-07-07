// Cart management for BladeZ: works with GitHub Pages (frontend), Render (backend), Azure SQL (database)

document.addEventListener('DOMContentLoaded', () => {
    displayCart();
    updateCartCount();

    const clearCartBtn = document.getElementById('clear-cart');
    if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);

    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) checkoutBtn.addEventListener('click', proceedToCheckout);
});

// --- Cart Core Logic ---

function getCart() {
    return JSON.parse(localStorage.getItem('cart')) || [];
}

function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    syncCartWithBackend(cart);
}

function addToCart(productId, productName, productPrice, productImage) {
    let cart = getCart();
    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            id: productId,
            name: productName,
            price: productPrice,
            image_url: productImage || 'images/Default1.png',
            quantity: 1
        });
    }
    saveCart(cart);
    showNotification(`${productName} added to cart`);
    displayCart();
}

function updateItemQuantity(productId, change) {
    let cart = getCart();
    const item = cart.find(i => i.id === parseInt(productId));
    if (!item) return;
    item.quantity += change;
    if (item.quantity <= 0) {
        cart = cart.filter(i => i.id !== item.id);
    }
    saveCart(cart);
    displayCart();
}

function removeFromCart(productId) {
    let cart = getCart();
    cart = cart.filter(item => item.id !== parseInt(productId));
    saveCart(cart);
    showNotification('Item removed from cart');
    displayCart();
}

function clearCart() {
    if (confirm('Are you sure you want to clear your cart?')) {
        localStorage.removeItem('cart');
        updateCartCount();
        syncCartWithBackend([]);
        displayCart();
        showNotification('Cart cleared');
    }
}

function proceedToCheckout() {
    const cart = getCart();
    if (cart.length === 0) {
        alert('Your cart is empty');
        return;
    }
    window.location.href = 'checkout.html';
}

// --- UI Rendering ---

function displayCart() {
    const cartContainer = document.getElementById('cart-items');
    if (!cartContainer) return;
    const cart = getCart();

    if (cart.length === 0) {
        cartContainer.innerHTML = '<p>Your cart is empty</p>';
        updateCartTotal(0);
        hideElement('checkout-btn');
        hideElement('clear-cart');
        return;
    }

    showElement('checkout-btn');
    showElement('clear-cart');

    cartContainer.innerHTML = cart.map(item => `
        <div class="cart-item-card" data-id="${item.id}">
            <img src="${item.image_url || 'images/Default1.png'}" alt="${item.name}" class="cart-item-image" onerror="this.onerror=null; this.src='images/Default1.png';">
            <div class="cart-item-details">
                <h3>${item.name}</h3>
                <p>Price: $${item.price.toFixed(2)}</p>
                <div class="quantity-control">
                    <button class="decrease-quantity" data-id="${item.id}">-</button>
                    <span class="item-quantity">${item.quantity}</span>
                    <button class="increase-quantity" data-id="${item.id}">+</button>
                </div>
                <p>Total: $${(item.price * item.quantity).toFixed(2)}</p>
            </div>
            <button class="remove-item-btn" data-id="${item.id}">Remove</button>
        </div>
    `).join('');

    updateCartTotal(cart.reduce((sum, item) => sum + item.price * item.quantity, 0));

    // Attach event listeners
    cartContainer.querySelectorAll('.decrease-quantity').forEach(btn => {
        btn.addEventListener('click', e => updateItemQuantity(e.target.dataset.id, -1));
    });
    cartContainer.querySelectorAll('.increase-quantity').forEach(btn => {
        btn.addEventListener('click', e => updateItemQuantity(e.target.dataset.id, 1));
    });
    cartContainer.querySelectorAll('.remove-item-btn').forEach(btn => {
        btn.addEventListener('click', e => removeFromCart(e.target.dataset.id));
    });
}

function updateCartTotal(total) {
    const totalElement = document.getElementById('cart-total');
    if (totalElement) totalElement.textContent = `$${total.toFixed(2)}`;
}

function updateCartCount() {
    const cart = getCart();
    const totalQuantity = cart.reduce((count, item) => count + item.quantity, 0);
    const cartCountElem = document.getElementById('cart-count');
    if (cartCountElem) cartCountElem.textContent = totalQuantity;
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'cart-notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function hideElement(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

function showElement(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
}

// --- Backend Sync ---

async function syncCartWithBackend(cartItems) {
    try {
        if (window.apiService) {
            await apiService.post('/api/cart/sync', { items: cartItems });
        }
    } catch (error) {
        console.error("Error syncing cart with backend:", error.message);
    }
}

// --- Expose for global use (e.g., from product page) ---
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);

function hideElement(id) {
    const element = document.getElementById(id);
    if (element) element.style.display = 'none';
}

function showElement(id) {
    const element = document.getElementById(id);
    if (element) element.style.display = 'block';
}

// Fix the syncCartWithBackend function
async function syncCartWithBackend(cartItems) {
  try {
    // Use apiService from config.js instead of direct fetch with BACKEND_URL
    await apiService.post('/api/cart/sync', { items: cartItems });
  } catch (error) {
    console.error("Error syncing cart with backend:", error.message);
    // Continue with local cart functionality even if sync fails
  }
}

// Make functions available globally
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;

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