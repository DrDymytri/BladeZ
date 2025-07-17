document.addEventListener("DOMContentLoaded", () => {
  // Initialize filtering first
  initializeFilters();
  
  // Load initial products
  loadProducts(1);
  
  // Update cart count
  updateCartCount();
});

async function loadProducts(page = 1) {
  const productsPerPageElement = document.getElementById("products-per-page");
  const categoryElement = document.getElementById("category-filter");
  const subCategoryElement = document.getElementById("subcategory-filter");
  const descriptorElement = document.getElementById("descriptor-filter");

  const productsPerPage = productsPerPageElement ? parseInt(productsPerPageElement.value, 10) : 20;
  const categoryId = categoryElement?.value || "";
  const subCategoryId = subCategoryElement?.value || "";
  const descriptorId = descriptorElement?.value || "";

  try {
    const queryParams = new URLSearchParams();
    queryParams.set("page", page);
    queryParams.set("limit", productsPerPage);
    
    if (categoryId) queryParams.set("categoryId", categoryId);
    if (subCategoryId) queryParams.set("subCategoryId", subCategoryId);
    if (descriptorId) queryParams.set("descriptorId", descriptorId);

    const response = await apiService.get(`/api/products?${queryParams.toString()}`);
    
    if (!response.products || response.products.length === 0) {
      displayErrorMessage("No products found.");
      renderPaginationControls(page, 0, 0);
      return;
    }

    displayProducts(response.products);
    renderPaginationControls(response.currentPage, response.totalPages, response.totalProducts);
  } catch (error) {
    console.error("Error loading products:", error.message);
    displayErrorMessage("Failed to load products. Please try again later.");
    renderPaginationControls(page, 0, 0);
  }
}

async function loadShowcaseProducts() {
  const showcaseContainer = document.getElementById("showcase-products-grid");
  if (!showcaseContainer) {
    console.error("Showcase container not found in the DOM. Exiting function.");
    return;
  }

  try {
    const products = await apiService.get('/api/showcase-products');
    if (!products || products.length === 0) {
      showcaseContainer.innerHTML = "<p>No showcase products available.</p>";
      return;
    }

    showcaseContainer.innerHTML = products
      .map(
        (product) => `
        <div class="product-card">
          <img src="${product.image_url || '/images/Default1.png'}" alt="${product.name}" onerror="this.onerror=null;this.src='/images/Default1.png';" />
          <h3>${product.name}</h3>
          <p>${product.description}</p>
          <p class="price"><span class="price-label">Price:</span> $${product.price.toFixed(2)}</p>
          <button class="add-to-cart" onclick="addToCart(${product.id}, '${product.name}', ${product.price})">Add to Cart</button>
        </div>
      `
      )
      .join("");
  } catch (error) {
    console.error("Error loading showcase products:", error.message);
    showcaseContainer.innerHTML = "<p>Error loading showcase products. Please try again later.</p>";
  }
}

function resetDropdown(selectElement, placeholder) {
    if (!selectElement) {
        console.warn("resetDropdown: selectElement is null or undefined.");
        return;
    }
    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
}

function displayProducts(products) {
  const productContainer = document.getElementById("product-container");
  if (productContainer) {
    productContainer.innerHTML = products
      .map(
        (p) => `
      <div class="product-item">
        <img src="${p.image_url || '/images/Default1.png'}" alt="${p.name}" class="product-image" onclick="openImageInPopup('${p.image_url || '/images/Default1.png'}')" onerror="this.onerror=null;this.src='${getDefaultImageUrl()}'" />
        <h3>${p.name}</h3>
        <p>${p.description}</p>
        <p class="price"><strong>Price:</strong> <em>$${p.price.toFixed(2)}</em></p>
        <p class="stock"><strong>Stock:</strong> <em>${p.stock_quantity}</em></p>
        <button class="add-to-cart" onclick="addToCart(${p.id}, '${p.name}', ${p.price})">Add to Cart</button>
      </div>`
      )
      .join("");
  }
}

function openImageInPopup(imageUrl) {
  const popupWidth = 800;
  const popupHeight = 600;
  const left = (screen.width - popupWidth) / 2;
  const top = (screen.height - popupHeight) / 2;

  const popup = window.open(
    "",
    "_blank",
    "fullscreen=yes,toolbar=no,location=no,directories=no,status=no,menubar=no,copyhistory=no",
    `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );

  if (popup) {
    popup.document.write(`
      <html>
        <head>
          <title>Product Image</title>
          <style>
            body {
              margin: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              background-color: rgba(0, 0, 0, 0.9);
            }
            img {
              max-width: 90vw;
              max-height: 90vh;
              border: 3px solid white;
              border-radius: 5px;
            }
          </style>
        </head>
        <body>
          <img src="${imageUrl}" alt="Product Image">
        </body>
      </html>
    `);
  } else {
    alert("Popup blocked! Please allow popups for this site.");
  }
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
  const cartCountElement = document.getElementById("cart-count");
  if (cartCountElement) {
    cartCountElement.textContent = cart.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
  }
}

function getDefaultImageUrl() {
    return '/images/Default1.png';
}

function resetFilters() {
  const categoryFilter = document.getElementById("category-filter");
  const subcategoryFilter = document.getElementById("subcategory-filter");
  const descriptorFilter = document.getElementById("descriptor-filter");
  
  if (categoryFilter) categoryFilter.value = "";
  if (subcategoryFilter) {
    subcategoryFilter.value = "";
    subcategoryFilter.disabled = true;
  }
  if (descriptorFilter) {
    descriptorFilter.value = "";
    descriptorFilter.disabled = true;
  }
}

async function initializeFilters() {
  try {
    const categorySelect = document.getElementById("category-filter");
    if (!categorySelect) return;

    const response = await apiService.get("/api/categories");
    resetDropdown(categorySelect, "All Categories");
    
    response.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      categorySelect.appendChild(option);
    });

    categorySelect.addEventListener("change", async () => {
      const categoryId = categorySelect.value;
      const subcategorySelect = document.getElementById("subcategory-filter");
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(subcategorySelect, "All Subcategories");
      resetDropdown(descriptorSelect, "All Descriptors");
      subcategorySelect.disabled = true;
      descriptorSelect.disabled = true;

      if (categoryId) {
        await loadFilterSubcategories(categoryId);
        subcategorySelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error initializing filters:", error.message);
  }
}

async function loadFilterSubcategories(categoryId) {
  try {
    const subcategorySelect = document.getElementById("subcategory-filter");
    const response = await apiService.get(`/api/subcategories?categoryId=${categoryId}`);
    resetDropdown(subcategorySelect, "All Subcategories");
    
    response.forEach((subcategory) => {
      const option = document.createElement("option");
      option.value = subcategory.id;
      option.textContent = subcategory.name;
      subcategorySelect.appendChild(option);
    });

    subcategorySelect.addEventListener("change", async () => {
      const subCategoryId = subcategorySelect.value;
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(descriptorSelect, "All Descriptors");
      descriptorSelect.disabled = true;

      if (subCategoryId) {
        await loadFilterDescriptors(subCategoryId);
        descriptorSelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error loading subcategories:", error.message);
  }
}

async function loadFilterDescriptors(subCategoryId) {
  try {
    const descriptorSelect = document.getElementById("descriptor-filter");
    const response = await apiService.get(`/api/descriptors?subCategoryId=${subCategoryId}`);
    resetDropdown(descriptorSelect, "All Descriptors");
    
    response.forEach((descriptor) => {
      const option = document.createElement("option");
      option.value = descriptor.id;
      option.textContent = descriptor.name;
      descriptorSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading descriptors:", error.message);
  }
}

function renderPaginationControls(currentPage, totalPages, totalProducts) {
  const paginationContainer = document.getElementById("pagination-container");
  if (!paginationContainer) {
    console.error("Pagination container not found");
    return;
  }

  paginationContainer.innerHTML = ""; // Clear existing pagination

  if (totalPages <= 1) return; // No pagination needed for a single page

  // Add pagination info
  const paginationInfo = document.createElement("div");
  paginationInfo.className = "pagination-info";
  paginationInfo.innerHTML = `<p>Showing page ${currentPage} of ${totalPages} (${totalProducts} total products)</p>`;
  paginationContainer.appendChild(paginationInfo);

  // Create pagination buttons container
  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "pagination-buttons";
  
  // Previous button
  if (currentPage > 1) {
    const prevButton = document.createElement("button");
    prevButton.textContent = "Previous";
    prevButton.className = "pagination-button";
    prevButton.addEventListener("click", () => loadProducts(currentPage - 1));
    buttonsContainer.appendChild(prevButton);
  }

  // Page number buttons
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    const firstButton = document.createElement("button");
    firstButton.textContent = "1";
    firstButton.className = "pagination-button";
    firstButton.addEventListener("click", () => loadProducts(1));
    buttonsContainer.appendChild(firstButton);
    
    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const button = document.createElement("button");
    button.textContent = i;
    button.className = "pagination-button";
    if (i === currentPage) button.classList.add("active");
    button.addEventListener("click", () => loadProducts(i));
    buttonsContainer.appendChild(button);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
    
    const lastButton = document.createElement("button");
    lastButton.textContent = totalPages;
    lastButton.className = "pagination-button";
    lastButton.addEventListener("click", () => loadProducts(totalPages));
    buttonsContainer.appendChild(lastButton);
  }

  // Next button
  if (currentPage < totalPages) {
    const nextButton = document.createElement("button");
    nextButton.textContent = "Next";
    nextButton.className = "pagination-button";
    nextButton.addEventListener("click", () => loadProducts(currentPage + 1));
    buttonsContainer.appendChild(nextButton);
  }

  paginationContainer.appendChild(buttonsContainer);
}


function resetFilters() {
  const categoryFilter = document.getElementById("category-filter");
  const subcategoryFilter = document.getElementById("subcategory-filter");
  const descriptorFilter = document.getElementById("descriptor-filter");
  
  if (categoryFilter) categoryFilter.value = "";
  if (subcategoryFilter) {
    subcategoryFilter.value = "";
    subcategoryFilter.disabled = true;
  }
  if (descriptorFilter) {
    descriptorFilter.value = "";
    descriptorFilter.disabled = true;
  }
}

// Initialize filtering system when DOM loads
document.addEventListener("DOMContentLoaded", () => {
  // Initialize filtering system
  initializeFilters();
  
  // Load initial products
  loadProducts(1);
  
  // Update cart count
  updateCartCount();
});

async function initializeFilters() {
  try {
    const categorySelect = document.getElementById("category-filter");
    if (!categorySelect) return;

    const response = await apiService.get("/api/categories");
    resetDropdown(categorySelect, "All Categories");
    
    response.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      categorySelect.appendChild(option);
    });

    categorySelect.addEventListener("change", async () => {
      const categoryId = categorySelect.value;
      const subcategorySelect = document.getElementById("subcategory-filter");
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(subcategorySelect, "All Subcategories");
      resetDropdown(descriptorSelect, "All Descriptors");
      subcategorySelect.disabled = true;
      descriptorSelect.disabled = true;

      if (categoryId) {
        await loadFilterSubcategories(categoryId);
        subcategorySelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error initializing filters:", error.message);
  }
}

async function loadFilterSubcategories(categoryId) {
  try {
    const subcategorySelect = document.getElementById("subcategory-filter");
    const response = await apiService.get(`/api/subcategories?categoryId=${categoryId}`);
    resetDropdown(subcategorySelect, "All Subcategories");
    
    response.forEach((subcategory) => {
      const option = document.createElement("option");
      option.value = subcategory.id;
      option.textContent = subcategory.name;
      subcategorySelect.appendChild(option);
    });

    subcategorySelect.addEventListener("change", async () => {
      const subCategoryId = subcategorySelect.value;
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(descriptorSelect, "All Descriptors");
      descriptorSelect.disabled = true;

      if (subCategoryId) {
        await loadFilterDescriptors(subCategoryId);
        descriptorSelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error loading subcategories:", error.message);
  }
}

async function loadFilterDescriptors(subCategoryId) {
  try {
    const descriptorSelect = document.getElementById("descriptor-filter");
    const response = await apiService.get(`/api/descriptors?subCategoryId=${subCategoryId}`);
    resetDropdown(descriptorSelect, "All Descriptors");
    
    response.forEach((descriptor) => {
      const option = document.createElement("option");
      option.value = descriptor.id;
      option.textContent = descriptor.name;
      descriptorSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading descriptors:", error.message);
  }
}

function renderPaginationControls(currentPage, totalPages, totalProducts) {
  const paginationContainer = document.getElementById("pagination-container");
  if (!paginationContainer) {
    console.error("Pagination container not found");
    return;
  }

  paginationContainer.innerHTML = ""; // Clear existing pagination

  if (totalPages <= 1) return; // No pagination needed for a single page

  // Add pagination info
  const paginationInfo = document.createElement("div");
  paginationInfo.className = "pagination-info";
  paginationInfo.innerHTML = `<p>Showing page ${currentPage} of ${totalPages} (${totalProducts} total products)</p>`;
  paginationContainer.appendChild(paginationInfo);

  // Create pagination buttons container
  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "pagination-buttons";
  
  // Previous button
  if (currentPage > 1) {
    const prevButton = document.createElement("button");
    prevButton.textContent = "Previous";
    prevButton.className = "pagination-button";
    prevButton.addEventListener("click", () => loadProducts(currentPage - 1));
    buttonsContainer.appendChild(prevButton);
  }

  // Page number buttons
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    const firstButton = document.createElement("button");
    firstButton.textContent = "1";
    firstButton.className = "pagination-button";
    firstButton.addEventListener("click", () => loadProducts(1));
    buttonsContainer.appendChild(firstButton);
    
    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const button = document.createElement("button");
    button.textContent = i;
    button.className = "pagination-button";
    if (i === currentPage) button.classList.add("active");
    button.addEventListener("click", () => loadProducts(i));
    buttonsContainer.appendChild(button);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
    
    const lastButton = document.createElement("button");
    lastButton.textContent = totalPages;
    lastButton.className = "pagination-button";
    lastButton.addEventListener("click", () => loadProducts(totalPages));
    buttonsContainer.appendChild(lastButton);
  }

  // Next button
  if (currentPage < totalPages) {
    const nextButton = document.createElement("button");
    nextButton.textContent = "Next";
    nextButton.className = "pagination-button";
    nextButton.addEventListener("click", () => loadProducts(currentPage + 1));
    buttonsContainer.appendChild(nextButton);
  }

  paginationContainer.appendChild(buttonsContainer);
}


function resetFilters() {
  const categoryFilter = document.getElementById("category-filter");
  const subcategoryFilter = document.getElementById("subcategory-filter");
  const descriptorFilter = document.getElementById("descriptor-filter");
  
  if (categoryFilter) categoryFilter.value = "";
  if (subcategoryFilter) {
    subcategoryFilter.value = "";
    subcategoryFilter.disabled = true;
  }
  if (descriptorFilter) {
    descriptorFilter.value = "";
    descriptorFilter.disabled = true;
  }
}

// Initialize filtering system when DOM loads
document.addEventListener("DOMContentLoaded", () => {
  // Initialize filtering system
  initializeFilters();
  
  // Load initial products
  loadProducts(1);
  
  // Update cart count
  updateCartCount();
});

async function initializeFilters() {
  try {
    const categorySelect = document.getElementById("category-filter");
    if (!categorySelect) return;

    const response = await apiService.get("/api/categories");
    resetDropdown(categorySelect, "All Categories");
    
    response.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      categorySelect.appendChild(option);
    });

    categorySelect.addEventListener("change", async () => {
      const categoryId = categorySelect.value;
      const subcategorySelect = document.getElementById("subcategory-filter");
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(subcategorySelect, "All Subcategories");
      resetDropdown(descriptorSelect, "All Descriptors");
      subcategorySelect.disabled = true;
      descriptorSelect.disabled = true;

      if (categoryId) {
        await loadFilterSubcategories(categoryId);
        subcategorySelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error initializing filters:", error.message);
  }
}

async function loadFilterSubcategories(categoryId) {
  try {
    const subcategorySelect = document.getElementById("subcategory-filter");
    const response = await apiService.get(`/api/subcategories?categoryId=${categoryId}`);
    resetDropdown(subcategorySelect, "All Subcategories");
    
    response.forEach((subcategory) => {
      const option = document.createElement("option");
      option.value = subcategory.id;
      option.textContent = subcategory.name;
      subcategorySelect.appendChild(option);
    });

    subcategorySelect.addEventListener("change", async () => {
      const subCategoryId = subcategorySelect.value;
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(descriptorSelect, "All Descriptors");
      descriptorSelect.disabled = true;

      if (subCategoryId) {
        await loadFilterDescriptors(subCategoryId);
        descriptorSelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error loading subcategories:", error.message);
  }
}

async function loadFilterDescriptors(subCategoryId) {
  try {
    const descriptorSelect = document.getElementById("descriptor-filter");
    const response = await apiService.get(`/api/descriptors?subCategoryId=${subCategoryId}`);
    resetDropdown(descriptorSelect, "All Descriptors");
    
    response.forEach((descriptor) => {
      const option = document.createElement("option");
      option.value = descriptor.id;
      option.textContent = descriptor.name;
      descriptorSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading descriptors:", error.message);
  }
}

function renderPaginationControls(currentPage, totalPages, totalProducts) {
  const paginationContainer = document.getElementById("pagination-container");
  if (!paginationContainer) {
    console.error("Pagination container not found");
    return;
  }

  paginationContainer.innerHTML = ""; // Clear existing pagination

  if (totalPages <= 1) return; // No pagination needed for a single page

  // Add pagination info
  const paginationInfo = document.createElement("div");
  paginationInfo.className = "pagination-info";
  paginationInfo.innerHTML = `<p>Showing page ${currentPage} of ${totalPages} (${totalProducts} total products)</p>`;
  paginationContainer.appendChild(paginationInfo);

  // Create pagination buttons container
  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "pagination-buttons";
  
  // Previous button
  if (currentPage > 1) {
    const prevButton = document.createElement("button");
    prevButton.textContent = "Previous";
    prevButton.className = "pagination-button";
    prevButton.addEventListener("click", () => loadProducts(currentPage - 1));
    buttonsContainer.appendChild(prevButton);
  }

  // Page number buttons
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    const firstButton = document.createElement("button");
    firstButton.textContent = "1";
    firstButton.className = "pagination-button";
    firstButton.addEventListener("click", () => loadProducts(1));
    buttonsContainer.appendChild(firstButton);
    
    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const button = document.createElement("button");
    button.textContent = i;
    button.className = "pagination-button";
    if (i === currentPage) button.classList.add("active");
    button.addEventListener("click", () => loadProducts(i));
    buttonsContainer.appendChild(button);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
    
    const lastButton = document.createElement("button");
    lastButton.textContent = totalPages;
    lastButton.className = "pagination-button";
    lastButton.addEventListener("click", () => loadProducts(totalPages));
    buttonsContainer.appendChild(lastButton);
  }

  // Next button
  if (currentPage < totalPages) {
    const nextButton = document.createElement("button");
    nextButton.textContent = "Next";
    nextButton.className = "pagination-button";
    nextButton.addEventListener("click", () => loadProducts(currentPage + 1));
    buttonsContainer.appendChild(nextButton);
  }

  paginationContainer.appendChild(buttonsContainer);
}


function resetFilters() {
  const categoryFilter = document.getElementById("category-filter");
  const subcategoryFilter = document.getElementById("subcategory-filter");
  const descriptorFilter = document.getElementById("descriptor-filter");
  
  if (categoryFilter) categoryFilter.value = "";
  if (subcategoryFilter) {
    subcategoryFilter.value = "";
    subcategoryFilter.disabled = true;
  }
  if (descriptorFilter) {
    descriptorFilter.value = "";
    descriptorFilter.disabled = true;
  }
}

// Initialize filtering system when DOM loads
document.addEventListener("DOMContentLoaded", () => {
  // Initialize filtering system
  initializeFilters();
  
  // Load initial products
  loadProducts(1);
  
  // Update cart count
  updateCartCount();
});

async function initializeFilters() {
  try {
    const categorySelect = document.getElementById("category-filter");
    if (!categorySelect) return;

    const response = await apiService.get("/api/categories");
    resetDropdown(categorySelect, "All Categories");
    
    response.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      categorySelect.appendChild(option);
    });

    categorySelect.addEventListener("change", async () => {
      const categoryId = categorySelect.value;
      const subcategorySelect = document.getElementById("subcategory-filter");
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(subcategorySelect, "All Subcategories");
      resetDropdown(descriptorSelect, "All Descriptors");
      subcategorySelect.disabled = true;
      descriptorSelect.disabled = true;

      if (categoryId) {
        await loadFilterSubcategories(categoryId);
        subcategorySelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error initializing filters:", error.message);
  }
}

async function loadFilterSubcategories(categoryId) {
  try {
    const subcategorySelect = document.getElementById("subcategory-filter");
    const response = await apiService.get(`/api/subcategories?categoryId=${categoryId}`);
    resetDropdown(subcategorySelect, "All Subcategories");
    
    response.forEach((subcategory) => {
      const option = document.createElement("option");
      option.value = subcategory.id;
      option.textContent = subcategory.name;
      subcategorySelect.appendChild(option);
    });

    subcategorySelect.addEventListener("change", async () => {
      const subCategoryId = subcategorySelect.value;
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(descriptorSelect, "All Descriptors");
      descriptorSelect.disabled = true;

      if (subCategoryId) {
        await loadFilterDescriptors(subCategoryId);
        descriptorSelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error loading subcategories:", error.message);
  }
}

async function loadFilterDescriptors(subCategoryId) {
  try {
    const descriptorSelect = document.getElementById("descriptor-filter");
    const response = await apiService.get(`/api/descriptors?subCategoryId=${subCategoryId}`);
    resetDropdown(descriptorSelect, "All Descriptors");
    
    response.forEach((descriptor) => {
      const option = document.createElement("option");
      option.value = descriptor.id;
      option.textContent = descriptor.name;
      descriptorSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading descriptors:", error.message);
  }
}

function renderPaginationControls(currentPage, totalPages, totalProducts) {
  const paginationContainer = document.getElementById("pagination-container");
  if (!paginationContainer) {
    console.error("Pagination container not found");
    return;
  }

  paginationContainer.innerHTML = ""; // Clear existing pagination

  if (totalPages <= 1) return; // No pagination needed for a single page

  // Add pagination info
  const paginationInfo = document.createElement("div");
  paginationInfo.className = "pagination-info";
  paginationInfo.innerHTML = `<p>Showing page ${currentPage} of ${totalPages} (${totalProducts} total products)</p>`;
  paginationContainer.appendChild(paginationInfo);

  // Create pagination buttons container
  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "pagination-buttons";
  
  // Previous button
  if (currentPage > 1) {
    const prevButton = document.createElement("button");
    prevButton.textContent = "Previous";
    prevButton.className = "pagination-button";
    prevButton.addEventListener("click", () => loadProducts(currentPage - 1));
    buttonsContainer.appendChild(prevButton);
  }

  // Page number buttons
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    const firstButton = document.createElement("button");
    firstButton.textContent = "1";
    firstButton.className = "pagination-button";
    firstButton.addEventListener("click", () => loadProducts(1));
    buttonsContainer.appendChild(firstButton);
    
    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const button = document.createElement("button");
    button.textContent = i;
    button.className = "pagination-button";
    if (i === currentPage) button.classList.add("active");
    button.addEventListener("click", () => loadProducts(i));
    buttonsContainer.appendChild(button);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
    
    const lastButton = document.createElement("button");
    lastButton.textContent = totalPages;
    lastButton.className = "pagination-button";
    lastButton.addEventListener("click", () => loadProducts(totalPages));
    buttonsContainer.appendChild(lastButton);
  }

  // Next button
  if (currentPage < totalPages) {
    const nextButton = document.createElement("button");
    nextButton.textContent = "Next";
    nextButton.className = "pagination-button";
    nextButton.addEventListener("click", () => loadProducts(currentPage + 1));
    buttonsContainer.appendChild(nextButton);
  }

  paginationContainer.appendChild(buttonsContainer);
}


function resetFilters() {
  const categoryFilter = document.getElementById("category-filter");
  const subcategoryFilter = document.getElementById("subcategory-filter");
  const descriptorFilter = document.getElementById("descriptor-filter");
  
  if (categoryFilter) categoryFilter.value = "";
  if (subcategoryFilter) {
    subcategoryFilter.value = "";
    subcategoryFilter.disabled = true;
  }
  if (descriptorFilter) {
    descriptorFilter.value = "";
    descriptorFilter.disabled = true;
  }
}

// Initialize filtering system when DOM loads
document.addEventListener("DOMContentLoaded", () => {
  // Initialize filtering system
  initializeFilters();
  
  // Load initial products
  loadProducts(1);
  
  // Update cart count
  updateCartCount();
});

async function initializeFilters() {
  try {
    const categorySelect = document.getElementById("category-filter");
    if (!categorySelect) return;

    const response = await apiService.get("/api/categories");
    resetDropdown(categorySelect, "All Categories");
    
    response.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      categorySelect.appendChild(option);
    });

    categorySelect.addEventListener("change", async () => {
      const categoryId = categorySelect.value;
      const subcategorySelect = document.getElementById("subcategory-filter");
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(subcategorySelect, "All Subcategories");
      resetDropdown(descriptorSelect, "All Descriptors");
      subcategorySelect.disabled = true;
      descriptorSelect.disabled = true;

      if (categoryId) {
        await loadFilterSubcategories(categoryId);
        subcategorySelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error initializing filters:", error.message);
  }
}

async function loadFilterSubcategories(categoryId) {
  try {
    const subcategorySelect = document.getElementById("subcategory-filter");
    const response = await apiService.get(`/api/subcategories?categoryId=${categoryId}`);
    resetDropdown(subcategorySelect, "All Subcategories");
    
    response.forEach((subcategory) => {
      const option = document.createElement("option");
      option.value = subcategory.id;
      option.textContent = subcategory.name;
      subcategorySelect.appendChild(option);
    });

    subcategorySelect.addEventListener("change", async () => {
      const subCategoryId = subcategorySelect.value;
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(descriptorSelect, "All Descriptors");
      descriptorSelect.disabled = true;

      if (subCategoryId) {
        await loadFilterDescriptors(subCategoryId);
        descriptorSelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error loading subcategories:", error.message);
  }
}

async function loadFilterDescriptors(subCategoryId) {
  try {
    const descriptorSelect = document.getElementById("descriptor-filter");
    const response = await apiService.get(`/api/descriptors?subCategoryId=${subCategoryId}`);
    resetDropdown(descriptorSelect, "All Descriptors");
    
    response.forEach((descriptor) => {
      const option = document.createElement("option");
      option.value = descriptor.id;
      option.textContent = descriptor.name;
      descriptorSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading descriptors:", error.message);
  }
}

function renderPaginationControls(currentPage, totalPages, totalProducts) {
  const paginationContainer = document.getElementById("pagination-container");
  if (!paginationContainer) {
    console.error("Pagination container not found");
    return;
  }

  paginationContainer.innerHTML = ""; // Clear existing pagination

  if (totalPages <= 1) return; // No pagination needed for a single page

  // Add pagination info
  const paginationInfo = document.createElement("div");
  paginationInfo.className = "pagination-info";
  paginationInfo.innerHTML = `<p>Showing page ${currentPage} of ${totalPages} (${totalProducts} total products)</p>`;
  paginationContainer.appendChild(paginationInfo);

  // Create pagination buttons container
  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "pagination-buttons";
  
  // Previous button
  if (currentPage > 1) {
    const prevButton = document.createElement("button");
    prevButton.textContent = "Previous";
    prevButton.className = "pagination-button";
    prevButton.addEventListener("click", () => loadProducts(currentPage - 1));
    buttonsContainer.appendChild(prevButton);
  }

  // Page number buttons
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    const firstButton = document.createElement("button");
    firstButton.textContent = "1";
    firstButton.className = "pagination-button";
    firstButton.addEventListener("click", () => loadProducts(1));
    buttonsContainer.appendChild(firstButton);
    
    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const button = document.createElement("button");
    button.textContent = i;
    button.className = "pagination-button";
    if (i === currentPage) button.classList.add("active");
    button.addEventListener("click", () => loadProducts(i));
    buttonsContainer.appendChild(button);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
    
    const lastButton = document.createElement("button");
    lastButton.textContent = totalPages;
    lastButton.className = "pagination-button";
    lastButton.addEventListener("click", () => loadProducts(totalPages));
    buttonsContainer.appendChild(lastButton);
  }

  // Next button
  if (currentPage < totalPages) {
    const nextButton = document.createElement("button");
    nextButton.textContent = "Next";
    nextButton.className = "pagination-button";
    nextButton.addEventListener("click", () => loadProducts(currentPage + 1));
    buttonsContainer.appendChild(nextButton);
  }

  paginationContainer.appendChild(buttonsContainer);
}


function resetFilters() {
  const categoryFilter = document.getElementById("category-filter");
  const subcategoryFilter = document.getElementById("subcategory-filter");
  const descriptorFilter = document.getElementById("descriptor-filter");
  
  if (categoryFilter) categoryFilter.value = "";
  if (subcategoryFilter) {
    subcategoryFilter.value = "";
    subcategoryFilter.disabled = true;
  }
  if (descriptorFilter) {
    descriptorFilter.value = "";
    descriptorFilter.disabled = true;
  }
}

// Initialize filtering system when DOM loads
document.addEventListener("DOMContentLoaded", () => {
  // Initialize filtering system
  initializeFilters();
  
  // Load initial products
  loadProducts(1);
  
  // Update cart count
  updateCartCount();
});

async function initializeFilters() {
  try {
    const categorySelect = document.getElementById("category-filter");
    if (!categorySelect) return;

    const response = await apiService.get("/api/categories");
    resetDropdown(categorySelect, "All Categories");
    
    response.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      categorySelect.appendChild(option);
    });

    categorySelect.addEventListener("change", async () => {
      const categoryId = categorySelect.value;
      const subcategorySelect = document.getElementById("subcategory-filter");
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(subcategorySelect, "All Subcategories");
      resetDropdown(descriptorSelect, "All Descriptors");
      subcategorySelect.disabled = true;
      descriptorSelect.disabled = true;

      if (categoryId) {
        await loadFilterSubcategories(categoryId);
        subcategorySelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error initializing filters:", error.message);
  }
}

async function loadFilterSubcategories(categoryId) {
  try {
    const subcategorySelect = document.getElementById("subcategory-filter");
    const response = await apiService.get(`/api/subcategories?categoryId=${categoryId}`);
    resetDropdown(subcategorySelect, "All Subcategories");
    
    response.forEach((subcategory) => {
      const option = document.createElement("option");
      option.value = subcategory.id;
      option.textContent = subcategory.name;
      subcategorySelect.appendChild(option);
    });

    subcategorySelect.addEventListener("change", async () => {
      const subCategoryId = subcategorySelect.value;
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(descriptorSelect, "All Descriptors");
      descriptorSelect.disabled = true;

      if (subCategoryId) {
        await loadFilterDescriptors(subCategoryId);
        descriptorSelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error loading subcategories:", error.message);
  }
}

async function loadFilterDescriptors(subCategoryId) {
  try {
    const descriptorSelect = document.getElementById("descriptor-filter");
    const response = await apiService.get(`/api/descriptors?subCategoryId=${subCategoryId}`);
    resetDropdown(descriptorSelect, "All Descriptors");
    
    response.forEach((descriptor) => {
      const option = document.createElement("option");
      option.value = descriptor.id;
      option.textContent = descriptor.name;
      descriptorSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading descriptors:", error.message);
  }
}

function renderPaginationControls(currentPage, totalPages, totalProducts) {
  const paginationContainer = document.getElementById("pagination-container");
  if (!paginationContainer) {
    console.error("Pagination container not found");
    return;
  }

  paginationContainer.innerHTML = ""; // Clear existing pagination

  if (totalPages <= 1) return; // No pagination needed for a single page

  // Add pagination info
  const paginationInfo = document.createElement("div");
  paginationInfo.className = "pagination-info";
  paginationInfo.innerHTML = `<p>Showing page ${currentPage} of ${totalPages} (${totalProducts} total products)</p>`;
  paginationContainer.appendChild(paginationInfo);

  // Create pagination buttons container
  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "pagination-buttons";
  
  // Previous button
  if (currentPage > 1) {
    const prevButton = document.createElement("button");
    prevButton.textContent = "Previous";
    prevButton.className = "pagination-button";
    prevButton.addEventListener("click", () => loadProducts(currentPage - 1));
    buttonsContainer.appendChild(prevButton);
  }

  // Page number buttons
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    const firstButton = document.createElement("button");
    firstButton.textContent = "1";
    firstButton.className = "pagination-button";
    firstButton.addEventListener("click", () => loadProducts(1));
    buttonsContainer.appendChild(firstButton);
    
    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const button = document.createElement("button");
    button.textContent = i;
    button.className = "pagination-button";
    if (i === currentPage) button.classList.add("active");
    button.addEventListener("click", () => loadProducts(i));
    buttonsContainer.appendChild(button);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
    
    const lastButton = document.createElement("button");
    lastButton.textContent = totalPages;
    lastButton.className = "pagination-button";
    lastButton.addEventListener("click", () => loadProducts(totalPages));
    buttonsContainer.appendChild(lastButton);
  }

  // Next button
  if (currentPage < totalPages) {
    const nextButton = document.createElement("button");
    nextButton.textContent = "Next";
    nextButton.className = "pagination-button";
    nextButton.addEventListener("click", () => loadProducts(currentPage + 1));
    buttonsContainer.appendChild(nextButton);
  }

  paginationContainer.appendChild(buttonsContainer);
}


function resetFilters() {
  const categoryFilter = document.getElementById("category-filter");
  const subcategoryFilter = document.getElementById("subcategory-filter");
  const descriptorFilter = document.getElementById("descriptor-filter");
  
  if (categoryFilter) categoryFilter.value = "";
  if (subcategoryFilter) {
    subcategoryFilter.value = "";
    subcategoryFilter.disabled = true;
  }
  if (descriptorFilter) {
    descriptorFilter.value = "";
    descriptorFilter.disabled = true;
  }
}

// Initialize filtering system when DOM loads
document.addEventListener("DOMContentLoaded", () => {
  // Initialize filtering system
  initializeFilters();
  
  // Load initial products
  loadProducts(1);
  
  // Update cart count
  updateCartCount();
});

async function initializeFilters() {
  try {
    const categorySelect = document.getElementById("category-filter");
    if (!categorySelect) return;

    const response = await apiService.get("/api/categories");
    resetDropdown(categorySelect, "All Categories");
    
    response.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      categorySelect.appendChild(option);
    });

    categorySelect.addEventListener("change", async () => {
      const categoryId = categorySelect.value;
      const subcategorySelect = document.getElementById("subcategory-filter");
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(subcategorySelect, "All Subcategories");
      resetDropdown(descriptorSelect, "All Descriptors");
      subcategorySelect.disabled = true;
      descriptorSelect.disabled = true;

      if (categoryId) {
        await loadFilterSubcategories(categoryId);
        subcategorySelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error initializing filters:", error.message);
  }
}

async function loadFilterSubcategories(categoryId) {
  try {
    const subcategorySelect = document.getElementById("subcategory-filter");
    const response = await apiService.get(`/api/subcategories?categoryId=${categoryId}`);
    resetDropdown(subcategorySelect, "All Subcategories");
    
    response.forEach((subcategory) => {
      const option = document.createElement("option");
      option.value = subcategory.id;
      option.textContent = subcategory.name;
      subcategorySelect.appendChild(option);
    });

    subcategorySelect.addEventListener("change", async () => {
      const subCategoryId = subcategorySelect.value;
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(descriptorSelect, "All Descriptors");
      descriptorSelect.disabled = true;

      if (subCategoryId) {
        await loadFilterDescriptors(subCategoryId);
        descriptorSelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error loading subcategories:", error.message);
  }
}

async function loadFilterDescriptors(subCategoryId) {
  try {
    const descriptorSelect = document.getElementById("descriptor-filter");
    const response = await apiService.get(`/api/descriptors?subCategoryId=${subCategoryId}`);
    resetDropdown(descriptorSelect, "All Descriptors");
    
    response.forEach((descriptor) => {
      const option = document.createElement("option");
      option.value = descriptor.id;
      option.textContent = descriptor.name;
      descriptorSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading descriptors:", error.message);
  }
}

function renderPaginationControls(currentPage, totalPages, totalProducts) {
  const paginationContainer = document.getElementById("pagination-container");
  if (!paginationContainer) {
    console.error("Pagination container not found");
    return;
  }

  paginationContainer.innerHTML = ""; // Clear existing pagination

  if (totalPages <= 1) return; // No pagination needed for a single page

  // Add pagination info
  const paginationInfo = document.createElement("div");
  paginationInfo.className = "pagination-info";
  paginationInfo.innerHTML = `<p>Showing page ${currentPage} of ${totalPages} (${totalProducts} total products)</p>`;
  paginationContainer.appendChild(paginationInfo);

  // Create pagination buttons container
  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "pagination-buttons";
  
  // Previous button
  if (currentPage > 1) {
    const prevButton = document.createElement("button");
    prevButton.textContent = "Previous";
    prevButton.className = "pagination-button";
    prevButton.addEventListener("click", () => loadProducts(currentPage - 1));
    buttonsContainer.appendChild(prevButton);
  }

  // Page number buttons
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    const firstButton = document.createElement("button");
    firstButton.textContent = "1";
    firstButton.className = "pagination-button";
    firstButton.addEventListener("click", () => loadProducts(1));
    buttonsContainer.appendChild(firstButton);
    
    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const button = document.createElement("button");
    button.textContent = i;
    button.className = "pagination-button";
    if (i === currentPage) button.classList.add("active");
    button.addEventListener("click", () => loadProducts(i));
    buttonsContainer.appendChild(button);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
    
    const lastButton = document.createElement("button");
    lastButton.textContent = totalPages;
    lastButton.className = "pagination-button";
    lastButton.addEventListener("click", () => loadProducts(totalPages));
    buttonsContainer.appendChild(lastButton);
  }

  // Next button
  if (currentPage < totalPages) {
    const nextButton = document.createElement("button");
    nextButton.textContent = "Next";
    nextButton.className = "pagination-button";
    nextButton.addEventListener("click", () => loadProducts(currentPage + 1));
    buttonsContainer.appendChild(nextButton);
  }

  paginationContainer.appendChild(buttonsContainer);
}


function resetFilters() {
  const categoryFilter = document.getElementById("category-filter");
  const subcategoryFilter = document.getElementById("subcategory-filter");
  const descriptorFilter = document.getElementById("descriptor-filter");
  
  if (categoryFilter) categoryFilter.value = "";
  if (subcategoryFilter) {
    subcategoryFilter.value = "";
    subcategoryFilter.disabled = true;
  }
  if (descriptorFilter) {
    descriptorFilter.value = "";
    descriptorFilter.disabled = true;
  }
}

// Initialize filtering system when DOM loads
document.addEventListener("DOMContentLoaded", () => {
  // Initialize filtering system
  initializeFilters();
  
  // Load initial products
  loadProducts(1);
  
  // Update cart count
  updateCartCount();
});

async function initializeFilters() {
  try {
    const categorySelect = document.getElementById("category-filter");
    if (!categorySelect) return;

    const response = await apiService.get("/api/categories");
    resetDropdown(categorySelect, "All Categories");
    
    response.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      categorySelect.appendChild(option);
    });

    categorySelect.addEventListener("change", async () => {
      const categoryId = categorySelect.value;
      const subcategorySelect = document.getElementById("subcategory-filter");
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(subcategorySelect, "All Subcategories");
      resetDropdown(descriptorSelect, "All Descriptors");
      subcategorySelect.disabled = true;
      descriptorSelect.disabled = true;

      if (categoryId) {
        await loadFilterSubcategories(categoryId);
        subcategorySelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error initializing filters:", error.message);
  }
}

async function loadFilterSubcategories(categoryId) {
  try {
    const subcategorySelect = document.getElementById("subcategory-filter");
    const response = await apiService.get(`/api/subcategories?categoryId=${categoryId}`);
    resetDropdown(subcategorySelect, "All Subcategories");
    
    response.forEach((subcategory) => {
      const option = document.createElement("option");
      option.value = subcategory.id;
      option.textContent = subcategory.name;
      subcategorySelect.appendChild(option);
    });

    subcategorySelect.addEventListener("change", async () => {
      const subCategoryId = subcategorySelect.value;
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(descriptorSelect, "All Descriptors");
      descriptorSelect.disabled = true;

      if (subCategoryId) {
        await loadFilterDescriptors(subCategoryId);
        descriptorSelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error loading subcategories:", error.message);
  }
}

async function loadFilterDescriptors(subCategoryId) {
  try {
    const descriptorSelect = document.getElementById("descriptor-filter");
    const response = await apiService.get(`/api/descriptors?subCategoryId=${subCategoryId}`);
    resetDropdown(descriptorSelect, "All Descriptors");
    
    response.forEach((descriptor) => {
      const option = document.createElement("option");
      option.value = descriptor.id;
      option.textContent = descriptor.name;
      descriptorSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading descriptors:", error.message);
  }
}

function renderPaginationControls(currentPage, totalPages, totalProducts) {
  const paginationContainer = document.getElementById("pagination-container");
  if (!paginationContainer) {
    console.error("Pagination container not found");
    return;
  }

  paginationContainer.innerHTML = ""; // Clear existing pagination

  if (totalPages <= 1) return; // No pagination needed for a single page

  // Add pagination info
  const paginationInfo = document.createElement("div");
  paginationInfo.className = "pagination-info";
  paginationInfo.innerHTML = `<p>Showing page ${currentPage} of ${totalPages} (${totalProducts} total products)</p>`;
  paginationContainer.appendChild(paginationInfo);

  // Create pagination buttons container
  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "pagination-buttons";
  
  // Previous button
  if (currentPage > 1) {
    const prevButton = document.createElement("button");
    prevButton.textContent = "Previous";
    prevButton.className = "pagination-button";
    prevButton.addEventListener("click", () => loadProducts(currentPage - 1));
    buttonsContainer.appendChild(prevButton);
  }

  // Page number buttons
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    const firstButton = document.createElement("button");
    firstButton.textContent = "1";
    firstButton.className = "pagination-button";
    firstButton.addEventListener("click", () => loadProducts(1));
    buttonsContainer.appendChild(firstButton);
    
    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const button = document.createElement("button");
    button.textContent = i;
    button.className = "pagination-button";
    if (i === currentPage) button.classList.add("active");
    button.addEventListener("click", () => loadProducts(i));
    buttonsContainer.appendChild(button);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
    
    const lastButton = document.createElement("button");
    lastButton.textContent = totalPages;
    lastButton.className = "pagination-button";
    lastButton.addEventListener("click", () => loadProducts(totalPages));
    buttonsContainer.appendChild(lastButton);
  }

  // Next button
  if (currentPage < totalPages) {
    const nextButton = document.createElement("button");
    nextButton.textContent = "Next";
    nextButton.className = "pagination-button";
    nextButton.addEventListener("click", () => loadProducts(currentPage + 1));
    buttonsContainer.appendChild(nextButton);
  }

  paginationContainer.appendChild(buttonsContainer);
}


function resetFilters() {
  const categoryFilter = document.getElementById("category-filter");
  const subcategoryFilter = document.getElementById("subcategory-filter");
  const descriptorFilter = document.getElementById("descriptor-filter");
  
  if (categoryFilter) categoryFilter.value = "";
  if (subcategoryFilter) {
    subcategoryFilter.value = "";
    subcategoryFilter.disabled = true;
  }
  if (descriptorFilter) {
    descriptorFilter.value = "";
    descriptorFilter.disabled = true;
  }
}

// Initialize filtering system when DOM loads
document.addEventListener("DOMContentLoaded", () => {
  // Initialize filtering system
  initializeFilters();
  
  // Load initial products
  loadProducts(1);
  
  // Update cart count
  updateCartCount();
});

async function initializeFilters() {
  try {
    const categorySelect = document.getElementById("category-filter");
    if (!categorySelect) return;

    const response = await apiService.get("/api/categories");
    resetDropdown(categorySelect, "All Categories");
    
    response.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      categorySelect.appendChild(option);
    });

    categorySelect.addEventListener("change", async () => {
      const categoryId = categorySelect.value;
      const subcategorySelect = document.getElementById("subcategory-filter");
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(subcategorySelect, "All Subcategories");
      resetDropdown(descriptorSelect, "All Descriptors");
      subcategorySelect.disabled = true;
      descriptorSelect.disabled = true;

      if (categoryId) {
        await loadFilterSubcategories(categoryId);
        subcategorySelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error initializing filters:", error.message);
  }
}

async function loadFilterSubcategories(categoryId) {
  try {
    const subcategorySelect = document.getElementById("subcategory-filter");
    const response = await apiService.get(`/api/subcategories?categoryId=${categoryId}`);
    resetDropdown(subcategorySelect, "All Subcategories");
    
    response.forEach((subcategory) => {
      const option = document.createElement("option");
      option.value = subcategory.id;
      option.textContent = subcategory.name;
      subcategorySelect.appendChild(option);
    });

    subcategorySelect.addEventListener("change", async () => {
      const subCategoryId = subcategorySelect.value;
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(descriptorSelect, "All Descriptors");
      descriptorSelect.disabled = true;

      if (subCategoryId) {
        await loadFilterDescriptors(subCategoryId);
        descriptorSelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error loading subcategories:", error.message);
  }
}

async function loadFilterDescriptors(subCategoryId) {
  try {
    const descriptorSelect = document.getElementById("descriptor-filter");
    const response = await apiService.get(`/api/descriptors?subCategoryId=${subCategoryId}`);
    resetDropdown(descriptorSelect, "All Descriptors");
    
    response.forEach((descriptor) => {
      const option = document.createElement("option");
      option.value = descriptor.id;
      option.textContent = descriptor.name;
      descriptorSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading descriptors:", error.message);
  }
}

function renderPaginationControls(currentPage, totalPages, totalProducts) {
  const paginationContainer = document.getElementById("pagination-container");
  if (!paginationContainer) {
    console.error("Pagination container not found");
    return;
  }

  paginationContainer.innerHTML = ""; // Clear existing pagination

  if (totalPages <= 1) return; // No pagination needed for a single page

  // Add pagination info
  const paginationInfo = document.createElement("div");
  paginationInfo.className = "pagination-info";
  paginationInfo.innerHTML = `<p>Showing page ${currentPage} of ${totalPages} (${totalProducts} total products)</p>`;
  paginationContainer.appendChild(paginationInfo);

  // Create pagination buttons container
  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "pagination-buttons";
  
  // Previous button
  if (currentPage > 1) {
    const prevButton = document.createElement("button");
    prevButton.textContent = "Previous";
    prevButton.className = "pagination-button";
    prevButton.addEventListener("click", () => loadProducts(currentPage - 1));
    buttonsContainer.appendChild(prevButton);
  }

  // Page number buttons
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    const firstButton = document.createElement("button");
    firstButton.textContent = "1";
    firstButton.className = "pagination-button";
    firstButton.addEventListener("click", () => loadProducts(1));
    buttonsContainer.appendChild(firstButton);
    
    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const button = document.createElement("button");
    button.textContent = i;
    button.className = "pagination-button";
    if (i === currentPage) button.classList.add("active");
    button.addEventListener("click", () => loadProducts(i));
    buttonsContainer.appendChild(button);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
    
    const lastButton = document.createElement("button");
    lastButton.textContent = totalPages;
    lastButton.className = "pagination-button";
    lastButton.addEventListener("click", () => loadProducts(totalPages));
    buttonsContainer.appendChild(lastButton);
  }

  // Next button
  if (currentPage < totalPages) {
    const nextButton = document.createElement("button");
    nextButton.textContent = "Next";
    nextButton.className = "pagination-button";
    nextButton.addEventListener("click", () => loadProducts(currentPage + 1));
    buttonsContainer.appendChild(nextButton);
  }

  paginationContainer.appendChild(buttonsContainer);
}


function resetFilters() {
  const categoryFilter = document.getElementById("category-filter");
  const subcategoryFilter = document.getElementById("subcategory-filter");
  const descriptorFilter = document.getElementById("descriptor-filter");
  
  if (categoryFilter) categoryFilter.value = "";
  if (subcategoryFilter) {
    subcategoryFilter.value = "";
    subcategoryFilter.disabled = true;
  }
  if (descriptorFilter) {
    descriptorFilter.value = "";
    descriptorFilter.disabled = true;
  }
}

// Initialize filtering system when DOM loads
document.addEventListener("DOMContentLoaded", () => {
  // Initialize filtering system
  initializeFilters();
  
  // Load initial products
  loadProducts(1);
  
  // Update cart count
  updateCartCount();
});

async function initializeFilters() {
  try {
    const categorySelect = document.getElementById("category-filter");
    if (!categorySelect) return;

    const response = await apiService.get("/api/categories");
    resetDropdown(categorySelect, "All Categories");
    
    response.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      categorySelect.appendChild(option);
    });

    categorySelect.addEventListener("change", async () => {
      const categoryId = categorySelect.value;
      const subcategorySelect = document.getElementById("subcategory-filter");
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(subcategorySelect, "All Subcategories");
      resetDropdown(descriptorSelect, "All Descriptors");
      subcategorySelect.disabled = true;
      descriptorSelect.disabled = true;

      if (categoryId) {
        await loadFilterSubcategories(categoryId);
        subcategorySelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error initializing filters:", error.message);
  }
}

async function loadFilterSubcategories(categoryId) {
  try {
    const subcategorySelect = document.getElementById("subcategory-filter");
    const response = await apiService.get(`/api/subcategories?categoryId=${categoryId}`);
    resetDropdown(subcategorySelect, "All Subcategories");
    
    response.forEach((subcategory) => {
      const option = document.createElement("option");
      option.value = subcategory.id;
      option.textContent = subcategory.name;
      subcategorySelect.appendChild(option);
    });

    subcategorySelect.addEventListener("change", async () => {
      const subCategoryId = subcategorySelect.value;
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(descriptorSelect, "All Descriptors");
      descriptorSelect.disabled = true;

      if (subCategoryId) {
        await loadFilterDescriptors(subCategoryId);
        descriptorSelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error loading subcategories:", error.message);
  }
}

async function loadFilterDescriptors(subCategoryId) {
  try {
    const descriptorSelect = document.getElementById("descriptor-filter");
    const response = await apiService.get(`/api/descriptors?subCategoryId=${subCategoryId}`);
    resetDropdown(descriptorSelect, "All Descriptors");
    
    response.forEach((descriptor) => {
      const option = document.createElement("option");
      option.value = descriptor.id;
      option.textContent = descriptor.name;
      descriptorSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading descriptors:", error.message);
  }
}

function renderPaginationControls(currentPage, totalPages, totalProducts) {
  const paginationContainer = document.getElementById("pagination-container");
  if (!paginationContainer) {
    console.error("Pagination container not found");
    return;
  }

  paginationContainer.innerHTML = ""; // Clear existing pagination

  if (totalPages <= 1) return; // No pagination needed for a single page

  // Add pagination info
  const paginationInfo = document.createElement("div");
  paginationInfo.className = "pagination-info";
  paginationInfo.innerHTML = `<p>Showing page ${currentPage} of ${totalPages} (${totalProducts} total products)</p>`;
  paginationContainer.appendChild(paginationInfo);

  // Create pagination buttons container
  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "pagination-buttons";
  
  // Previous button
  if (currentPage > 1) {
    const prevButton = document.createElement("button");
    prevButton.textContent = "Previous";
    prevButton.className = "pagination-button";
    prevButton.addEventListener("click", () => loadProducts(currentPage - 1));
    buttonsContainer.appendChild(prevButton);
  }

  // Page number buttons
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    const firstButton = document.createElement("button");
    firstButton.textContent = "1";
    firstButton.className = "pagination-button";
    firstButton.addEventListener("click", () => loadProducts(1));
    buttonsContainer.appendChild(firstButton);
    
    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const button = document.createElement("button");
    button.textContent = i;
    button.className = "pagination-button";
    if (i === currentPage) button.classList.add("active");
    button.addEventListener("click", () => loadProducts(i));
    buttonsContainer.appendChild(button);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      buttonsContainer.appendChild(ellipsis);
    }
    
    const lastButton = document.createElement("button");
    lastButton.textContent = totalPages;
    lastButton.className = "pagination-button";
    lastButton.addEventListener("click", () => loadProducts(totalPages));
    buttonsContainer.appendChild(lastButton);
  }

  // Next button
  if (currentPage < totalPages) {
    const nextButton = document.createElement("button");
    nextButton.textContent = "Next";
    nextButton.className = "pagination-button";
    nextButton.addEventListener("click", () => loadProducts(currentPage + 1));
    buttonsContainer.appendChild(nextButton);
  }

  paginationContainer.appendChild(buttonsContainer);
}


function resetFilters() {
  const categoryFilter = document.getElementById("category-filter");
  const subcategoryFilter = document.getElementById("subcategory-filter");
  const descriptorFilter = document.getElementById("descriptor-filter");
  
  if (categoryFilter) categoryFilter.value = "";
  if (subcategoryFilter) {
    subcategoryFilter.value = "";
    subcategoryFilter.disabled = true;
  }
  if (descriptorFilter) {
    descriptorFilter.value = "";
    descriptorFilter.disabled = true;
  }
}

// Initialize filtering system when DOM loads
document.addEventListener("DOMContentLoaded", () => {
  // Initialize filtering system
  initializeFilters();
  
  // Load initial products
  loadProducts(1);
  
  // Update cart count
  updateCartCount();
});

async function initializeFilters() {
  try {
    const categorySelect = document.getElementById("category-filter");
    if (!categorySelect) return;

    const response = await apiService.get("/api/categories");
    resetDropdown(categorySelect, "All Categories");
    
    response.forEach((category) => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      categorySelect.appendChild(option);
    });

    categorySelect.addEventListener("change", async () => {
      const categoryId = categorySelect.value;
      const subcategorySelect = document.getElementById("subcategory-filter");
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(subcategorySelect, "All Subcategories");
      resetDropdown(descriptorSelect, "All Descriptors");
      subcategorySelect.disabled = true;
      descriptorSelect.disabled = true;

      if (categoryId) {
        await loadFilterSubcategories(categoryId);
        subcategorySelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error initializing filters:", error.message);
  }
}

async function loadFilterSubcategories(categoryId) {
  try {
    const subcategorySelect = document.getElementById("subcategory-filter");
    const response = await apiService.get(`/api/subcategories?categoryId=${categoryId}`);
    resetDropdown(subcategorySelect, "All Subcategories");
    
    response.forEach((subcategory) => {
      const option = document.createElement("option");
      option.value = subcategory.id;
      option.textContent = subcategory.name;
      subcategorySelect.appendChild(option);
    });

    subcategorySelect.addEventListener("change", async () => {
      const subCategoryId = subcategorySelect.value;
      const descriptorSelect = document.getElementById("descriptor-filter");

      resetDropdown(descriptorSelect, "All Descriptors");
      descriptorSelect.disabled = true;

      if (subCategoryId) {
        await loadFilterDescriptors(subCategoryId);
        descriptorSelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error loading subcategories:", error.message);
  }
}