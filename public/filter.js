// Wait for the DOM content to be loaded
document.addEventListener("DOMContentLoaded", () => {
  loadCategories(); // Populate the first dropdown with categories
  setupFilterListeners(); // Set up the event listeners for the dropdowns
});

// Fetch and load categories
async function loadCategories() {
  try {
    const response = await fetch("/api/categories"); // Fetch data from the server
    const categories = await response.json();
    populateCategorySelect(categories); // Populate dropdown
  } catch (error) {
    console.error("Error loading categories:", error);
    alert("Failed to load categories. Please try again later.");
  }
}

// Fetch and load sub-categories based on selected category
async function loadSubCategories(categoryId) {
  try {
    resetDropdown("subCategorySelect", "Select Sub-Category"); // Reset sub-category dropdown
    resetDropdown("descriptorSelect", "Select Descriptor"); // Reset descriptor dropdown
    const response = await fetch(`/api/subcategories?categoryId=${categoryId}`);
    const subCategories = await response.json();
    populateSubCategorySelect(subCategories); // Populate dropdown
  } catch (error) {
    console.error("Error loading sub-categories:", error);
    alert("Failed to load sub-categories. Please try again later.");
  }
}

// Fetch and load descriptors based on selected sub-category
async function loadDescriptors(subCategoryId) {
  try {
    resetDropdown("descriptorSelect", "Select Descriptor"); // Reset descriptor dropdown
    const response = await fetch(`/api/descriptors?subCategoryId=${subCategoryId}`);
    const descriptors = await response.json();
    populateDescriptorSelect(descriptors); // Populate dropdown
  } catch (error) {
    console.error("Error loading descriptors:", error);
    alert("Failed to load descriptors. Please try again later.");
  }
}

// Fetch and load products based on selected descriptor
async function loadProducts(descriptorId) {
  try {
    const response = await fetch(`/api/products?descriptorId=${descriptorId}`);
    if (!response.ok) {
      throw new Error("Failed to fetch products");
    }
    const products = await response.json();
    displayProducts(products); // Display products dynamically
  } catch (error) {
    console.error("Error loading products:", error);
    alert("Failed to load products. Please try again later.");
  }
}

// Set up event listeners for the dropdowns
function setupFilterListeners() {
  document.getElementById("categorySelect").addEventListener("change", (e) => {
    const categoryId = e.target.value; // Get selected category ID
    if (categoryId) {
      loadSubCategories(categoryId); // Load sub-categories for the selected category
    } else {
      resetDropdown("subCategorySelect", "Select Sub-Category");
      resetDropdown("descriptorSelect", "Select Descriptor");
    }
  });

  document.getElementById("subCategorySelect").addEventListener("change", (e) => {
    const subCategoryId = e.target.value; // Get selected sub-category ID
    if (subCategoryId) {
      loadDescriptors(subCategoryId); // Load descriptors for the selected sub-category
    } else {
      resetDropdown("descriptorSelect", "Select Descriptor");
    }
  });

  document.getElementById("descriptorSelect").addEventListener("change", (e) => {
    const descriptorId = e.target.value; // Get selected descriptor ID
    if (descriptorId) {
      loadProducts(descriptorId); // Load products for the selected descriptor
    }
  });
}

// Populate the categories dropdown
function populateCategorySelect(categories) {
  const categorySelect = document.getElementById("categorySelect");
  categorySelect.innerHTML = `<option value="">Select Category</option>`;
  categorySelect.innerHTML += categories
    .map((c) => `<option value="${c.id}">${c.name}</option>`)
    .join("");
}

// Populate the sub-categories dropdown
function populateSubCategorySelect(subCategories) {
  const subCategorySelect = document.getElementById("subCategorySelect");
  subCategorySelect.innerHTML = `<option value="">Select Sub-Category</option>`;
  subCategorySelect.innerHTML += subCategories
    .map((sc) => `<option value="${sc.id}">${sc.name}</option>`)
    .join("");
}

// Populate the descriptors dropdown
function populateDescriptorSelect(descriptors) {
  const descriptorSelect = document.getElementById("descriptorSelect");
  descriptorSelect.innerHTML = `<option value="">Select Descriptor</option>`;
  descriptorSelect.innerHTML += descriptors
    .map((d) => `<option value="${d.id}">${d.name}</option>`)
    .join("");
}

// Display products dynamically
function displayProducts(products) {
  const productContainer = document.getElementById("product-container");
  productContainer.innerHTML = products
    .map(
      (p) =>
        `<div class="product-item">
          <h3>${p.name}</h3>
          <p>${p.description}</p>
          <p>Price: $${p.price.toFixed(2)}</p>
          <img src="${p.image_url}" alt="${p.name}" />
        </div>`
    )
    .join("");
}

// Reset dropdowns
function resetDropdown(dropdownId, placeholderText) {
  const dropdown = document.getElementById(dropdownId);
  dropdown.innerHTML = `<option value="">${placeholderText}</option>`;
}
