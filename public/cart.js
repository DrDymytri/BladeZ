document.addEventListener("DOMContentLoaded", async () => {
  const cartContainer = document.getElementById("cart-container");
  const cartTotalElement = document.getElementById("cart-total");

  // Fetch cart items from localStorage
  const cartItems = JSON.parse(localStorage.getItem("cart")) || [];

  if (cartItems.length === 0) {
    cartContainer.innerHTML = "<p>Your cart is empty.</p>";
    return;
  }

  // Fetch updated product details from the server
  const productIds = cartItems.map((item) => item.id).join(",");
  try {
    const response = await fetch(`http://localhost:5000/api/cart-products?ids=${productIds}`);
    if (!response.ok) throw new Error("Failed to fetch product details");

    const products = await response.json();

    // Merge updated product details with cart items and combine duplicates
    const updatedCart = cartItems.reduce((acc, item) => {
      const product = products.find((p) => p.id === item.id);
      if (product) {
        const existingItem = acc.find((i) => i.id === item.id);
        if (existingItem) {
          existingItem.quantity += item.quantity; // Combine quantities
        } else {
          acc.push({ ...product, quantity: item.quantity });
        }
      }
      return acc;
    }, []);

    renderCartItems(updatedCart);
    updateTotal(updatedCart);

    // Save the updated cart to localStorage
    localStorage.setItem("cart", JSON.stringify(updatedCart));
    attachEventListeners(updatedCart);
  } catch (error) {
    console.error("Error fetching cart products:", error.message);
    alert("Failed to load cart. Please try again.");
  }

  // Add event listener for the "Clear Cart" button
  document.getElementById("clear-cart-btn").addEventListener("click", () => {
    clearCart();
  });
});

function renderCartItems(cartItems) {
  const cartContainer = document.getElementById("cart-container");
  const cartSummaryTableBody = document.querySelector("#cart-summary-table tbody");

  // Render product cards
  cartContainer.innerHTML = cartItems
    .map(
      (item, index) => `
      <div class="cart-item-card" data-id="${index}">
        <img src="${item.image_url || './images/default-image.jpg'}" alt="${item.name}" class="cart-item-image" />
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
}

function attachEventListeners(cartItems) {
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

function removeItemFromCart(cartId, cartItems) {
  // Remove the item from the cart
  cartItems.splice(cartId, 1);
  localStorage.setItem("cart", JSON.stringify(cartItems));

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
    localStorage.setItem("cart", JSON.stringify(cartItems));
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
  localStorage.setItem("cart", JSON.stringify(cartItems));
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

  // Update the UI
  document.getElementById("cart-container").innerHTML = "<p>Your cart is empty.</p>";
  document.getElementById("cart-total").textContent = "0.00";

  // Update the cart count
  updateCartCount();
}

function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalQuantity = cart.reduce((count, item) => count + item.quantity, 0); // Sum up quantities
  const cartCountElement = document.getElementById("cart-count");
  if (cartCountElement) {
    cartCountElement.textContent = totalQuantity;
  } else {
    console.warn("Cart count element not found in the DOM.");
  }
}
