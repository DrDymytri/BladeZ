document.addEventListener("DOMContentLoaded", async () => {
  await populateCategoryFilter();
  loadProducts(1); // Load the first page of products on page load

  document.getElementById("apply-filters-btn").addEventListener("click", applyFilters);
  document.getElementById("clear-filters-btn").addEventListener("click", clearFilters);

  document.getElementById("category-filter").addEventListener("change", async (event) => {
    const categoryId = event.target.value;
    const subcategoryFilter = document.getElementById("subcategory-filter");
    resetDropdown(subcategoryFilter, "All Subcategories");
    if (categoryId) {
      await populateSubcategoryFilter(categoryId);
      subcategoryFilter.disabled = false;
    } else {
      subcategoryFilter.disabled = true;
    }
  });

  document.getElementById("subcategory-filter").addEventListener("change", async (event) => {
    const subCategoryId = event.target.value;
    const descriptorFilter = document.getElementById("descriptor-filter");
    resetDropdown(descriptorFilter, "All Descriptors");
    if (subCategoryId) {
      await populateDescriptorFilter(subCategoryId);
      descriptorFilter.disabled = false;
    } else {
      descriptorFilter.disabled = true;
    }
  });

  updateCartCount();

  function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const totalQuantity = cart.reduce((count, item) => count + item.quantity, 0); // Sum up quantities
    document.getElementById("cart-count").textContent = totalQuantity;
  }

  document.querySelectorAll(".add-to-cart-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const productCard = event.target.closest(".product-card");
      const product = {
        id: productCard.dataset.id,
        name: productCard.dataset.name,
        price: parseFloat(productCard.dataset.price),
      };

      const cart = JSON.parse(localStorage.getItem("cart")) || [];
      cart.push(product);
      localStorage.setItem("cart", JSON.stringify(cart));
      alert(`${product.name} added to cart!`);
      updateCartCount();
    });
  });

  // Ensure "Add to Cart" buttons trigger the notification
  document.querySelectorAll(".add-to-cart").forEach((button) => {
    button.addEventListener("click", (event) => {
      const productCard = event.target.closest(".product-item");
      const id = parseInt(productCard.dataset.id);
      const name = productCard.querySelector("h3").textContent;
      const price = parseFloat(productCard.querySelector("p strong").textContent.replace("$", ""));
      addToCart(id, name, price);
    });
  });

  // Update cart count on page load
  updateCartCount();

  try {
    const response = await fetch("http://localhost:5000/api/showcase-products");
    if (!response.ok) throw new Error("Failed to fetch showcase products");

    const showcasedProducts = await response.json();
    if (showcasedProducts.length > 0) {
      displayShowcaseModal(showcasedProducts);
    }
  } catch (error) {
    console.error("Error loading showcased products:", error.message);
  }

  // Example of adding a passive event listener
  document.addEventListener("touchstart", (event) => {
    console.log("Touchstart event triggered");
  }, { passive: true });
});

async function populateCategoryFilter() {
  try {
    const response = await fetch("http://localhost:5000/api/categories");
    if (!response.ok) throw new Error("Failed to fetch categories");

    const categories = await response.json();
    const categoryFilter = document.getElementById("category-filter");
    resetDropdown(categoryFilter, "All Categories");

    categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      categoryFilter.appendChild(option);
    });
  } catch (error) {
    console.error("Error fetching categories:", error.message);
  }
}

async function populateSubcategoryFilter(categoryId) {
  try {
    const response = await fetch(`http://localhost:5000/api/subcategories?categoryId=${categoryId}`);
    if (!response.ok) throw new Error("Failed to fetch subcategories");

    const subcategories = await response.json();
    const subcategoryFilter = document.getElementById("subcategory-filter");

    subcategories.forEach((subcategory) => {
      const option = document.createElement("option");
      option.value = subcategory.id;
      option.textContent = subcategory.name;
      subcategoryFilter.appendChild(option);
    });
  } catch (error) {
    console.error("Error fetching subcategories:", error.message);
  }
}

async function populateDescriptorFilter(subCategoryId) {
  try {
    const response = await fetch(`http://localhost:5000/api/descriptors?subCategoryId=${subCategoryId}`);
    if (!response.ok) throw new Error("Failed to fetch descriptors");

    const descriptors = await response.json();
    const descriptorFilter = document.getElementById("descriptor-filter");

    descriptors.forEach((descriptor) => {
      const option = document.createElement("option");
      option.value = descriptor.id;
      option.textContent = descriptor.name;
      descriptorFilter.appendChild(option);
    });
  } catch (error) {
    console.error("Error fetching descriptors:", error.message);
  }
}

function resetDropdown(selectElement, placeholder) {
  selectElement.innerHTML = `<option value="">${placeholder}</option>`;
}

async function loadProducts(filters = {}) {
  try {
    const { categoryId, subCategoryId, descriptorId, page = 1, limit = 30 } = filters;

    // Construct the query string dynamically
    const queryParams = new URLSearchParams();
    if (categoryId) queryParams.append("categoryId", categoryId);
    if (subCategoryId) queryParams.append("subCategoryId", subCategoryId);
    if (descriptorId) queryParams.append("descriptorId", descriptorId);
    queryParams.append("page", page);
    queryParams.append("limit", limit);

    const response = await fetch(`http://localhost:5000/api/products?${queryParams.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch products");

    const data = await response.json();
    renderProducts(data.products);
  } catch (error) {
    console.error("Error loading products:", error.message);
    alert("Error loading products: " + error.message);
  }
}

function renderPaginationControls(currentPage, totalPages) {
  const paginationContainer = document.getElementById("pagination-container");
  if (!paginationContainer) {
    console.error("Pagination container not found in the DOM.");
    return;
  }

  if (totalPages <= 1) {
    paginationContainer.innerHTML = ""; // No pagination needed for a single page
    return;
  }

  let paginationHTML = "";

  // Previous button
  if (currentPage > 1) {
    paginationHTML += `<button class="pagination-button" data-page="${currentPage - 1}">Previous</button>`;
  }

  // Page numbers
  for (let i = 1; i <= totalPages; i++) {
    paginationHTML += `
      <button class="pagination-button ${i === currentPage ? "active" : ""}" data-page="${i}">
        ${i}
      </button>
    `;
  }

  // Next button
  if (currentPage < totalPages) {
    paginationHTML += `<button class="pagination-button" data-page="${currentPage + 1}">Next</button>`;
  }

  paginationContainer.innerHTML = paginationHTML;

  // Add event listeners to pagination buttons
  paginationContainer.querySelectorAll(".pagination-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      const page = parseInt(event.target.dataset.page, 10);
      loadProducts(page);
    });
  });
}

function addToCart(productId, productName, productPrice) {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const existingProduct = cart.find((item) => item.id === productId);

  if (existingProduct) {
    existingProduct.quantity += 1;
  } else {
    cart.push({ id: productId, name: productName, price: productPrice, quantity: 1 });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  alert(`${productName} has been added to your cart.`);
  updateCartCount();
}

function applyFilters() {
  const categoryFilter = document.getElementById("category-filter"); // Corrected ID
  const subCategoryFilter = document.getElementById("subcategory-filter"); // Corrected ID
  const descriptorFilter = document.getElementById("descriptor-filter"); // Corrected ID

  // Ensure the elements exist before accessing their values
  const categoryId = categoryFilter ? categoryFilter.value : null;
  const subCategoryId = subCategoryFilter ? subCategoryFilter.value : null;
  const descriptorId = descriptorFilter ? descriptorFilter.value : null;

  loadProducts({ categoryId, subCategoryId, descriptorId }); // Pass filters to loadProducts
}

function clearFilters() {
  // Reset all dropdowns
  resetDropdown(document.getElementById("category-filter"), "All Categories"); // Corrected ID
  resetDropdown(document.getElementById("subcategory-filter"), "All Subcategories"); // Corrected ID
  resetDropdown(document.getElementById("descriptor-filter"), "All Descriptors"); // Corrected ID

  document.getElementById("subcategory-filter").disabled = true; // Corrected ID
  document.getElementById("descriptor-filter").disabled = true; // Corrected ID

  // Repopulate the category filter
  populateCategoryFilter();

  // Reload products without filters
  loadProducts();
}

function displayShowcaseModal(products) {
  const modal = document.createElement("div");
  modal.classList.add("modal");

  modal.innerHTML = `
    <div class="modal-content">
      <span class="close">&times;</span>
      <h1 class="businessName">Showcased Products</h1>
      <p class="subTitle">
        Explore our featured products below!<br>
        Right Click on the Image and Go To Magnify Image for Zoom and Pan Abilities.<br>
        Single Click on the Image to Enlarge.<br>
        Click the "X" Button in Top-Right-Hand Corner to Enter The Showroom.
      </p>
      <div class="showcase-products-grid">
        ${products
          .map(
            (product) => `
          <div class="product-item">
            <img src="${product.image_url || './images/default-image.jpg'}" alt="${product.name}" onclick="openImageInPopup('${product.image_url || './images/default-image.jpg'}')" />
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <p><strong class="price-label">Price:</strong> <span class="price">$${product.price.toFixed(2)}</span></p>
            <button class="add-to-cart-btn" data-id="${product.id}" data-name="${product.name}" data-price="${product.price}" data-image="${product.image_url || './images/default-image.jpg'}">Add to Cart</button>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeButton = modal.querySelector(".close");
  closeButton.addEventListener("click", () => {
    modal.remove();
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      modal.remove();
    }
  });

  // Add event listeners to "Add to Cart" buttons
  modal.querySelectorAll(".add-to-cart-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const productId = parseInt(event.target.dataset.id, 10);
      const productName = event.target.dataset.name;
      const productPrice = parseFloat(event.target.dataset.price);
      const productImage = event.target.dataset.image;

      const cart = JSON.parse(localStorage.getItem("cart")) || [];
      const existingProduct = cart.find((item) => item.id === productId);
      if (existingProduct) {
        existingProduct.quantity += 1;
      } else {
        cart.push({
          id: productId,
          name: productName,
          price: productPrice,
          image_url: productImage,
          quantity: 1,
        });
      }

      localStorage.setItem("cart", JSON.stringify(cart));
      updateCartCount();
      alert(`${productName} added to cart!`);
    });
  });
}

function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalQuantity = cart.reduce((count, item) => count + item.quantity, 0); // Sum up quantities
  document.getElementById("cart-count").textContent = totalQuantity;
}

// Ensure the cart count is updated on page load
document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
});

function openImageInPopup(imageUrl) {
  const popup = document.createElement("div");
  popup.classList.add("image-popup");
  popup.innerHTML = `
    <div class="popup-content">
      <span class="close-popup">&times;</span>
      <img src="${imageUrl}" alt="Image" />
    </div>
  `;

  // Close popup on click
  popup.querySelector(".close-popup").addEventListener("click", () => {
    popup.remove();
  });

  document.body.appendChild(popup);
}

// Example usage in dynamically rendered product items
function renderProductItems(products) {
  const productContainer = document.getElementById("product-container");
  productContainer.innerHTML = products
    .map(
      (product) => `
      <div class="product-item">
        <img src="${product.image_url || './images/default-image.jpg'}" alt="${product.name}" onclick="openImageInPopup('${product.image_url || './images/default-image.jpg'}')" />
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <p><strong class="price-label">Price:</strong> <span class="price">$${product.price.toFixed(2)}</span></p>
        <button class="add-to-cart-btn" data-id="${product.id}">Add to Cart</button>
      </div>
    `
    )
    .join("");
}

function renderProducts(products) {
  const productContainer = document.getElementById("product-container");
  if (!productContainer) {
    console.error("Product container not found in the DOM.");
    return;
  }

  if (products.length === 0) {
    productContainer.innerHTML = `<p>No products found.</p>`;
    return;
  }

  productContainer.innerHTML = products
    .map(
      (product) => `
      <div class="product-card" data-id="${product.id}" data-name="${product.name}" data-price="${product.price}">
        <img src="${product.image_url || './images/default-image.jpg'}" alt="${product.name}" class="product-image" onclick="openImageInPopup('${product.image_url || './images/default-image.jpg'}')" />
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <p><strong class="price-label">Price:</strong> <span class="price">$${product.price.toFixed(2)}</span></p>
        <button class="add-to-cart-btn">Add to Cart</button>
      </div>
    `
    )
    .join("");

  // Add event listeners to "Add to Cart" buttons
  productContainer.querySelectorAll(".add-to-cart-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const productCard = event.target.closest(".product-card");
      const productId = parseInt(productCard.dataset.id, 10);
      const productName = productCard.dataset.name;
      const productPrice = parseFloat(productCard.dataset.price);

      addToCart(productId, productName, productPrice);
    });
  });
}