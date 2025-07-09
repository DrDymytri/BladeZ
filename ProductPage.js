const BACKEND_URL = 'https://bladez-backend.onrender.com'; // Ensure this matches the backend URL

document.addEventListener("DOMContentLoaded", async () => {
  const spinner = document.getElementById("loading-spinner"); // Add spinner reference
  try {
    spinner.style.display = "block"; // Show spinner
    await populateCategoryFilter();
    await loadProducts(1); // Load the first page of products on page load
    // await loadShowcaseProducts(); // <-- REMOVE this line to prevent auto-loading showcase products
  } catch (error) {
    console.error("Error during initialization:", error.message);
  } finally {
    spinner.style.display = "none"; // Hide spinner after loading
  }

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

  document.getElementById("products-per-page").addEventListener("change", () => {
    loadProducts(1); // Reload products with the first page when the selection changes
  });

  updateCartCount();

  // Showcase modal logic
  const showcaseModalBtn = document.getElementById("showcase-modal-btn");
  const showcaseModal = document.getElementById("showcase-modal");
  const closeShowcaseModal = document.getElementById("close-showcase-modal");

  if (showcaseModalBtn && showcaseModal && closeShowcaseModal) {
    showcaseModalBtn.addEventListener("click", () => {
      loadShowcaseProducts(1); // Load showcase products page 1 when modal opens
      showcaseModal.style.display = "flex";
    });

    closeShowcaseModal.addEventListener("click", () => {
      showcaseModal.style.display = "none";
    });

    showcaseModal.addEventListener("click", (event) => {
      if (event.target === showcaseModal) {
        showcaseModal.style.display = "none";
      }
    });
  }
});

async function loadProducts(page = 1) {
  const spinner = document.getElementById("loading-spinner"); // Add spinner reference
  try {
    spinner.style.display = "block"; // Show spinner
    const categoryFilter = document.getElementById("category-filter");
    const subCategoryFilter = document.getElementById("subcategory-filter");
    const descriptorFilter = document.getElementById("descriptor-filter");
    const productsPerPage = document.getElementById("products-per-page").value;

    const filters = {
      categoryId: categoryFilter?.value || null,
      subCategoryId: subCategoryFilter?.value || null,
      descriptorId: descriptorFilter?.value || null,
      page,
      limit: parseInt(productsPerPage, 10),
    };

    const queryParams = new URLSearchParams();
    if (filters.categoryId) queryParams.append("categoryId", filters.categoryId);
    if (filters.subCategoryId) queryParams.append("subCategoryId", filters.subCategoryId);
    if (filters.descriptorId) queryParams.append("descriptorId", filters.descriptorId);
    queryParams.append("page", filters.page);
    queryParams.append("limit", filters.limit);

    const requestUrl = `${BACKEND_URL}/api/products?${queryParams.toString()}`;
    console.log("Requesting products from:", requestUrl);

    const response = await fetch(requestUrl);
    if (!response.ok) throw new Error(`Failed to fetch products: ${response.statusText}`);

    const data = await response.json();
    console.log("Products fetched successfully:", data);

    renderProducts(data.products);
    renderPaginationControls(filters.page, data.totalPages);
  } catch (error) {
    console.error("Error loading products:", error.message);
    const productContainer = document.getElementById("product-container");
    productContainer.innerHTML = `<p>Error loading products: ${error.message}</p>`;
  } finally {
    spinner.style.display = "none"; // Hide spinner after loading
  }
}

async function loadShowcaseProducts(page = 1) {
  const showcaseGrid = document.getElementById("showcase-products-grid");
  if (!showcaseGrid) return;

  try {
    // Fetch all showcase products (or use backend pagination if available)
    const response = await fetch(`${BACKEND_URL}/api/showcase-products`);
    if (!response.ok) throw new Error(`Failed to fetch showcase products: ${response.statusText}`);

    const products = await response.json();
    if (products.length === 0) {
      showcaseGrid.innerHTML = `<p>No showcase products available.</p>`;
      return;
    }

    const productsPerPage = 4;
    const totalPages = Math.ceil(products.length / productsPerPage);

    // Paginate
    const start = (page - 1) * productsPerPage;
    const end = start + productsPerPage;
    const paginated = products.slice(start, end);

    showcaseGrid.innerHTML = paginated
      .map(
        (product) => `
        <div class="product-card" data-id="${product.id}" data-name="${product.name}" data-price="${product.price}" data-image="${product.image_url || '/images/Default1.png'}">
          <img src="${product.image_url || '/images/Default1.png'}" alt="${product.name}" class="product-image" onclick="openImageInPopup('${product.image_url || '/images/Default1.png'}')" onerror="this.onerror=null;this.src='/images/Default1.png';" />
          <h3>${product.name}</h3>
          <p>${product.description}</p>
          <p><strong class="price-label">Price:</strong> <span class="price">$${product.price.toFixed(2)}</span></p>
          <button class="add-to-cart-btn">Add to Cart</button>
        </div>
      `
      )
      .join("");

    // Add event listeners to Add to Cart buttons
    showcaseGrid.querySelectorAll(".add-to-cart-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        const productCard = event.target.closest(".product-card");
        const productId = parseInt(productCard.dataset.id, 10);
        const productName = productCard.dataset.name;
        const productPrice = parseFloat(productCard.dataset.price);
        const productImage = productCard.dataset.image;
        addToCart(productId, productName, productPrice, productImage);
        alert(`${productName} has been added to your cart.`);
      });
    });

    // Render pagination controls inside the modal
    renderShowcasePagination(page, totalPages);
  } catch (error) {
    showcaseGrid.innerHTML = `<p>Error loading showcase products: ${error.message}</p>`;
  }
}

function renderShowcasePagination(currentPage, totalPages) {
  let paginationHTML = "";
  if (totalPages > 1) {
    if (currentPage > 1) {
      paginationHTML += `<button class="pagination-button" data-page="${currentPage - 1}">Previous</button>`;
    }
    for (let i = 1; i <= totalPages; i++) {
      paginationHTML += `<button class="pagination-button${i === currentPage ? " active" : ""}" data-page="${i}">${i}</button>`;
    }
    if (currentPage < totalPages) {
      paginationHTML += `<button class="pagination-button" data-page="${currentPage + 1}">Next</button>`;
    }
  }
  let container = document.getElementById("showcase-pagination");
  if (!container) {
    container = document.createElement("div");
    container.id = "showcase-pagination";
    container.className = "pagination-container";
    document.querySelector("#showcase-modal .modal-content").appendChild(container);
  }
  container.innerHTML = paginationHTML;

  container.querySelectorAll(".pagination-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      const page = parseInt(event.target.dataset.page, 10);
      loadShowcaseProducts(page);
    });
  });
}

async function populateCategoryFilter() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/categories`);
    if (!response.ok) throw new Error(`Failed to fetch categories: ${response.statusText}`);

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
    const categoryFilter = document.getElementById("category-filter");
    categoryFilter.innerHTML = `<option value="">Error loading categories</option>`;
  }
}

async function populateSubcategoryFilter(categoryId) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/subcategories?categoryId=${categoryId}`);
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
    const response = await fetch(`${BACKEND_URL}/api/descriptors?subCategoryId=${subCategoryId}`);
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
      loadProducts(page); // Pass the selected page
    });
  });
}

function addToCart(productId, productName, productPrice, productImage) {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const existingProduct = cart.find((item) => item.id === productId);

  if (existingProduct) {
    existingProduct.quantity += 1;
  } else {
    cart.push({
      id: productId,
      name: productName,
      price: productPrice,
      image_url: productImage || '/images/Default1.png', // Updated path
      quantity: 1,
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  alert(`${productName} has been added to your cart.`); // Notify the user
  updateCartCount();
}

// Example usage in dynamically rendered product items
function renderProductItems(products) {
  const productContainer = document.getElementById("product-container");
  productContainer.innerHTML = products
    .map(
      (product) => `
      <div class="product-item">
        <img src="${product.image_url || '/images/Default1.png'}" alt="${product.name}" onclick="openImageInPopup('${product.image_url || '/images/Default1.png'}')" />
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <p><strong class="price-label">Price:</strong> <span class="price">$${product.price.toFixed(2)}</span></p>
        <button class="add-to-cart-btn" data-id="${product.id}" data-name="${product.name}" data-price="${product.price}" data-image="${product.image_url || '/images/Default1.png'}">Add to Cart</button>
      </div>
    `
    )
    .join("");
}

function applyFilters() {
  const categoryFilter = document.getElementById("category-filter");
  const subCategoryFilter = document.getElementById("subcategory-filter");
  const descriptorFilter = document.getElementById("descriptor-filter");

  // Ensure the elements exist before accessing their values
  const categoryId = categoryFilter?.value || null;
  const subCategoryId = subCategoryFilter?.value || null;
  const descriptorId = descriptorFilter?.value || null;

  console.log("Applying filters:", { categoryId, subCategoryId, descriptorId }); // Debugging log

  // Pass the filters to the loadProducts function with page reset to 1
  loadProducts(1);
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
  const productsPerPage = 4;
  let currentPage = 1;

  const modal = document.createElement("div");
  modal.classList.add("modal");

  const renderShowcasePage = (page) => {
    const startIndex = (page - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    const paginatedProducts = products.slice(startIndex, endIndex);

    const productHTML = paginatedProducts
      .map(
        (product) => `
        <div class="product-item">
          <img src="${product.image_url || '/images/Default1.png'}" alt="${product.name}" onclick="openImageInPopup('${product.image_url || '/images/Default1.png'}')" />
          <h3>${product.name}</h3>
          <p>${product.description}</p>
          <p><strong class="price-label">Price:</strong> <span class="price">$${product.price.toFixed(2)}</span></p>
          <button class="add-to-cart-btn" data-id="${product.id}" data-name="${product.name}" data-price="${product.price}" data-image="${product.image_url || '/images/Default1.png'}">Add to Cart</button>
        </div>
      `
      )
      .join("");

    modal.querySelector(".showcase-products-grid").innerHTML = productHTML;

    // Add event listeners to "Add to Cart" buttons
    modal.querySelectorAll(".add-to-cart-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        const productId = parseInt(event.target.dataset.id, 10);
        const productName = event.target.dataset.name;
        const productPrice = parseFloat(event.target.dataset.price);
        const productImage = event.target.dataset.image;

        addToCart(productId, productName, productPrice, productImage);
        alert(`${productName} has been added to your cart.`); // Notify the user
      });
    });

    renderPaginationControls(page, Math.ceil(products.length / productsPerPage));
  };

  const renderPaginationControls = (currentPage, totalPages) => {
    const paginationContainer = modal.querySelector(".pagination-container");
    if (totalPages <= 1) {
      paginationContainer.innerHTML = ""; // No pagination needed
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
        currentPage = page;
        renderShowcasePage(page);
      });
    });
  };

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
      <div class="showcase-products-grid"></div>
      <div class="pagination-container"></div>
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

  renderShowcasePage(currentPage);
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
        <img src="${product.image_url || '/images/Default1.png'}" alt="${product.name}" onclick="openImageInPopup('${product.image_url || '/images/Default1.png'}')" />
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <p><strong class="price-label">Price:</strong> <span class="price">$${product.price.toFixed(2)}</span></p>
        <button class="add-to-cart-btn" data-id="${product.id}" data-name="${product.name}" data-price="${product.price}" data-image="${product.image_url || '/images/Default1.png'}">Add to Cart</button>
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
      <div class="product-card" data-id="${product.id}" data-name="${product.name}" data-price="${product.price}" data-image="${product.image_url || '/images/Default1.png'}">
        <img src="${product.image_url || '/images/Default1.png'}" alt="${product.name}" class="product-image" onerror="this.src='/images/Default1.png'" />
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <p><strong class="price-label">Price:</strong> <span class="price">$${product.price.toFixed(2)}</span></p>
        <button class="add-to-cart-btn">Add to Cart</button>
      </div>
    `
    )
    .join("");

  productContainer.querySelectorAll(".add-to-cart-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const productCard = event.target.closest(".product-card");
      const productId = parseInt(productCard.dataset.id, 10);
      const productName = productCard.dataset.name;
      const productPrice = parseFloat(productCard.dataset.price);
      const productImage = productCard.dataset.image;

      addToCart(productId, productName, productPrice, productImage);
      alert(`${productName} has been added to your cart.`);
    });
  });
}

document.querySelectorAll(".add-to-cart-btn").forEach((button) => {
  button.addEventListener("click", (event) => {
    const productCard = event.target.closest(".product-card");
    if (!productCard) return;

    const productId = parseInt(productCard.dataset.id, 10);
    const productName = productCard.dataset.name;
    const productPrice = parseFloat(productCard.dataset.price);
    const productImage = productCard.dataset.image;

    addToCart(productId, productName, productPrice, productImage);
  });
});

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const productContainer = document.getElementById('product-container');
    if (!productContainer) {
      console.error('Product container not found.');
      return;
    }
    // await loadShowcaseProducts(); // <-- REMOVE this line to prevent auto-loading showcase products
  } catch (error) {
    console.error('Error during initialization:', error.message);
  }
});