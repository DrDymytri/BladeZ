document.addEventListener("DOMContentLoaded", () => {
  loadFeaturedProducts();
});

async function loadFeaturedProducts() {
  try {
    const response = await fetch("/api/featured-products");
    if (!response.ok) {
      throw new Error("Failed to fetch featured products");
    }
    const products = await response.json();
    displayProducts(products);
  } catch (error) {
    console.error("Error loading featured products:", error);
    displayErrorMessage("Failed to load featured products. Please try again later.");
  }
}

async function loadProducts() {
  try {
    const response = await fetch("/api/products");
    if (!response.ok) {
      throw new Error("Failed to fetch products");
    }
    const products = await response.json();
    displayProducts(products);
  } catch (error) {
    console.error("Error loading products:", error);
    displayErrorMessage("Failed to load products. Please try again later.");
  }
}

function displayProducts(products) {
  const productContainer = document.getElementById("product-container");
  productContainer.innerHTML = products
    .map(
      (p) =>
        `<div class="product-item">
          <img src="${p.image_url}" alt="${p.name}" />
          <h3>${p.name}</h3>
          <p>${p.description}</p>
          <p class="price"><strong>Price:</strong> <em>$${p.price.toFixed(2)}</em></p>
          <button class="add-to-cart" onclick="addToCart(${p.id}, '${p.name}', ${p.price})">Add to Cart</button>
        </div>`
    )
    .join("");
}

function displayErrorMessage(message) {
  const productContainer = document.getElementById("product-container");
  productContainer.innerHTML = `<div class="error-message">${message}</div>`;
}

function addToCart(id, name, price) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  let product = cart.find((item) => item.id === id);

  if (product) {
    product.quantity += 1;
  } else {
    cart.push({ id, name, price, quantity: 1 });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  document.getElementById("cart-count").textContent = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
}

// Update cart count on page load
updateCartCount();
