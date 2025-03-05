document.addEventListener("DOMContentLoaded", function () {
  fetch("/api/products")
    .then((response) => response.json())
    .then((products) => {
      const container = document.getElementById("product-container");
      container.innerHTML = ""; // Clear any previous content

      products.forEach((product) => {
        const card = document.createElement("div");
        card.classList.add("product-card");

        card.innerHTML = `
                  <img src="${product.image_url}" alt="${product.name}">
                  <h3>${product.name}</h3>
                  <p>${product.description}</p>
                  <p><strong>Price: $${product.price}</strong></p>
                  <button onclick="addToCart(${product.id}, '${product.name}', ${product.price})">Add to Cart</button>
              `;

        container.appendChild(card);
      });
    })
    .catch((error) => {
      console.error("Error loading products:", error);
      document.getElementById("product-container").innerHTML =
        "<p>Failed to load products.</p>";
    });
});

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
