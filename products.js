document.addEventListener("DOMContentLoaded", () => {
    const productForm = document.getElementById("productForm");

    if (!productForm) {
        console.warn("Product form not found in the DOM. Exiting script.");
        return; // Exit early if the form is not found
    }

    const categorySelect = document.getElementById('productCategory');
    const subcategorySelect = document.getElementById('productSubCategory');
    const tagSelect = document.getElementById('productTag');

    if (categorySelect) {
        categorySelect.addEventListener('change', async () => {
            const categoryId = categorySelect.value;

            // Reset and disable subcategory and tag dropdowns
            if (subcategorySelect) {
                resetDropdown(subcategorySelect, "Select a Subcategory");
                subcategorySelect.disabled = true;
            }
            if (tagSelect) {
                resetDropdown(tagSelect, "Select a Tag");
                tagSelect.disabled = true;
            }

            if (categoryId) {
                await loadSubcategories(categoryId);
                if (subcategorySelect) subcategorySelect.disabled = false;
            }
        });
    }

    if (subcategorySelect) {
        subcategorySelect.addEventListener('change', async () => {
            const subCategoryId = subcategorySelect.value;

            // Reset and disable the tag dropdown
            if (tagSelect) {
                resetDropdown(tagSelect, "Select a Tag");
                tagSelect.disabled = true;
            }

            if (subCategoryId) {
                await loadTags(subCategoryId);
                if (tagSelect) tagSelect.disabled = false;
            }
        });
    }

    productForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // Prevent default form submission behavior

        const newProduct = {
            name: document.getElementById("productName").value,
            description: document.getElementById("productDescription").value,
            price: parseFloat(document.getElementById("productPrice").value),
            stock_quantity: parseInt(document.getElementById("productStock").value),
            category_id: parseInt(document.getElementById("productCategory").value),
            sub_category_id: parseInt(document.getElementById("productSubCategory").value),
            tag_id: parseInt(document.getElementById("productTag").value),
            is_showcase: document.getElementById("productShowcase").checked,
        };

        try {
            const response = await fetch(`${BACKEND_URL}/api/products`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newProduct), // Send product data to the server
            });

            if (response.ok) {
                alert("Product added successfully!");
                e.target.reset(); // Reset the form after submission
            } else {
                const errorText = await response.text();
                console.error("Failed to add product:", errorText);
                alert("Failed to add product. Please check your input.");
            }
        } catch (error) {
            console.error("Error adding product:", error);
            alert("An error occurred while adding the product. Please try again later.");
        }
    });

    // Load initial data
    loadCategories();

    const showcaseContainer = document.getElementById("showcase-container");
    if (!showcaseContainer) {
        console.error("Showcase container not found in the DOM. Exiting script.");
        return;
    }

    loadShowcaseProducts();
});

async function loadCategories() {
    try {
        const categorySelect = document.getElementById('productCategory');
        if (!categorySelect) {
            console.error('Category select element not found in DOM');
            return;
        }

        const response = await fetch(`${BACKEND_URL}/api/categories`);
        if (!response.ok) throw new Error('Failed to fetch categories');

        const categories = await response.json();
        resetDropdown(categorySelect, "Select a Category");
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id; // Use the correct field for the value
            option.textContent = category.name; // Use the correct field for the display text
            categorySelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function loadSubcategories(categoryId) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/subcategories?categoryId=${categoryId}`);
        if (!response.ok) throw new Error('Failed to fetch subcategories');

        const subcategories = await response.json();
        const subcategorySelect = document.getElementById('productSubCategory');
        resetDropdown(subcategorySelect, "Select a Subcategory");
        subcategories.forEach(subcategory => {
            const option = document.createElement('option');
            option.value = subcategory.id; // Use the correct field for the value
            option.textContent = subcategory.name; // Use the correct field for the display text
            subcategorySelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading subcategories:', error);
    }
}

async function loadTags(subCategoryId) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/descriptors?subCategoryId=${subCategoryId}`);
        if (!response.ok) throw new Error('Failed to fetch tags');

        const tags = await response.json();
        const tagSelect = document.getElementById('productTag');
        resetDropdown(tagSelect, "Select a Tag");
        tags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag.id; // Use the correct field for the value
            option.textContent = tag.name; // Use the correct field for the display text
            tagSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading tags:', error);
    }
}

async function loadShowcaseProducts() {
  const showcaseContainer = document.getElementById("showcase-container");
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
    selectElement.innerHTML = `<option value="">${placeholder}</option>`; // Reset dropdown with placeholder
}

function displayProducts(products) {
  const productContainer = document.getElementById("product-container");
  if (productContainer) {
    productContainer.innerHTML = products
      .map(
        (p) => `
      <div class="product-item">
        <img src="${p.image_url}" alt="${p.name}" class="product-image" onclick="openImageInPopup('${p.image_url}')" onerror="this.onerror=null;this.src='${getDefaultImageUrl()}'" />
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

// Function to open the image in a new popup window
function openImageInPopup(imageUrl) {
  const popupWidth = 800; // Set the desired width of the popup window
  const popupHeight = 600; // Set the desired height of the popup window
  const left = (screen.width - popupWidth) / 2; // Center horizontally
  const top = (screen.height - popupHeight) / 2; // Center vertically

  // Open a new window with the image
  const popup = window.open(
    "",
    "_blank",
    "fullscreen=yes,toolbar=no,location=no,directories=no,status=no,menubar=no,copyhistory=no",
    `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );

  if (popup) {
    // Set the content of the popup window
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
  document.getElementById("cart-count").textContent = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
}

// Handle missing default image gracefully
function getDefaultImageUrl() {
    return '/images/Default1.png'; // Ensure this path matches the actual location of the image
}

// Initial load
loadProducts();

// Update cart count on page load
updateCartCount();

async function loadProducts(page = 1) {
  const productsPerPage = parseInt(document.getElementById("products-per-page").value, 10) || 20;
  const categoryId = document.getElementById("category-filter").value;
  const subCategoryId = document.getElementById("subcategory-filter").value;
  const descriptorId = document.getElementById("descriptor-filter").value;

  try {
    const queryParams = new URLSearchParams({
      page,
      limit: productsPerPage,
      categoryId: categoryId || undefined,
      subCategoryId: subCategoryId || undefined,
      descriptorId: descriptorId || undefined,
    });

    const response = await apiService.get(`/api/products?${queryParams.toString()}`);
    if (!response.products || response.products.length === 0) {
      displayErrorMessage("No products found.");
      renderPaginationControls(page, 0);
      return;
    }

    displayProducts(response.products);
    renderPaginationControls(page, response.totalPages);
  } catch (error) {
    console.error("Error loading products:", error.message);
    displayErrorMessage("Failed to load products. Please try again later.");
  }
}

function resetFilters() {
  document.getElementById("category-filter").value = "";
  document.getElementById("subcategory-filter").value = "";
  document.getElementById("descriptor-filter").value = "";
  document.getElementById("subcategory-filter").disabled = true;
  document.getElementById("descriptor-filter").disabled = true;
}

async function loadCategories() {
  try {
    const categorySelect = document.getElementById("category-filter");
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
        await loadSubcategories(categoryId);
        subcategorySelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error loading categories:", error.message);
  }
}

async function loadSubcategories(categoryId) {
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
        await loadDescriptors(subCategoryId);
        descriptorSelect.disabled = false;
      }
    });
  } catch (error) {
    console.error("Error loading subcategories:", error.message);
  }
}

async function loadDescriptors(subCategoryId) {
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

function renderPaginationControls(currentPage, totalPages) {
  const paginationContainer = document.getElementById("pagination-container");
  if (!paginationContainer) return;

  paginationContainer.innerHTML = ""; // Clear existing pagination

  if (totalPages <= 1) return; // No pagination needed for a single page

  for (let i = 1; i <= totalPages; i++) {
    const button = document.createElement("button");
    button.textContent = i;
    button.className = "pagination-button";
    if (i === currentPage) button.classList.add("active");
    button.addEventListener("click", () => loadProducts(i));
    paginationContainer.appendChild(button);
  }
}
