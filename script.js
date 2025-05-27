document.addEventListener("DOMContentLoaded", () => {
  fetch("/products")
    .then((response) => response.json())
    .then((products) => {
      const container = document.getElementById("product-container");
      let html = "";
      products.forEach((product) => {
        html += `
          <div class="card">
            <img src="${product.image_url}" alt="${product.name}">
            <div class="card-content">
              <h2 class="card-title">${product.name}</h2>
              <p class="card-description">${product.description}</p>
              <p class="card-price">$${parseFloat(product.price).toFixed(2)}</p>
              <a href="product.html?id=${
                product.id
              }" class="card-button">View Details</a>
            </div>
          </div>
        `;
      });
      container.innerHTML = html;
    })
    .catch((err) => {
      console.error("Error fetching products:", err);
      document.getElementById("product-container").innerText =
        "Failed to load products.";
    });
});
