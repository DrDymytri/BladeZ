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

// Set up event listeners for the buttons
function setupFilterListeners() {
  document.getElementById("category-label").addEventListener("click", () => {
    toggleListDisplay("categorySelect");
  });

  document.getElementById("categorySelect").addEventListener("click", (e) => {
    if (e.target.tagName === "LI") {
      const categoryId = e.target.dataset.value;
      const categoryName = e.target.textContent;
      loadSubCategories(categoryId);
      document.getElementById("subcategory-container").style.display = "flex";
      document.getElementById("subcategory-arrow").style.display = "inline";
      document.getElementById("categorySelect").style.display = "none";
      document.getElementById("category-selection").textContent = `(${categoryName})`;
    }
  });

  document.getElementById("subcategory-label").addEventListener("click", () => {
    toggleListDisplay("subCategorySelect");
  });

  document.getElementById("subCategorySelect").addEventListener("click", (e) => {
    if (e.target.tagName === "LI") {
      const subCategoryId = e.target.dataset.value;
      const subCategoryName = e.target.textContent;
      loadDescriptors(subCategoryId);
      document.getElementById("descriptor-container").style.display = "flex";
      document.getElementById("descriptor-arrow").style.display = "inline";
      document.getElementById("subCategorySelect").style.display = "none"; // Ensure the list retracts
      document.getElementById("subcategory-selection").textContent = `(${subCategoryName})`;
    }
  });

  document.getElementById("descriptor-label").addEventListener("click", () => {
    toggleListDisplay("descriptorSelect");
  });

  document.getElementById("descriptorSelect").addEventListener("click", (e) => {
    if (e.target.tagName === "LI") {
      const descriptorId = e.target.dataset.value;
      const descriptorName = e.target.textContent;
      loadProducts(descriptorId);
      document.getElementById("descriptorSelect").style.display = "none";
      document.getElementById("descriptor-selection").textContent = `(${descriptorName})`;
    }
  });
}

// Toggle the display of the list
function toggleListDisplay(listId) {
  const list = document.getElementById(listId);
  list.style.display = list.style.display === "block" ? "none" : "block";
}

// Populate the categories list
function populateCategorySelect(categories) {
  const categorySelect = document.getElementById("categorySelect");
  categorySelect.innerHTML = `<li data-value="">Select Category</li>` + categories
    .map((c) => `<li data-value="${c.id}">${c.name}</li>`)
    .join("");
}

// Populate the sub-categories list
function populateSubCategorySelect(subCategories) {
  const subCategorySelect = document.getElementById("subCategorySelect");
  subCategorySelect.innerHTML = `<li data-value="">Select Sub-Category</li>` + subCategories
    .map((sc) => `<li data-value="${sc.id}">${sc.name}</li>`)
    .join("");
}

// Populate the descriptors list
function populateDescriptorSelect(descriptors) {
  const descriptorSelect = document.getElementById("descriptorSelect");
  descriptorSelect.innerHTML = `<li data-value="">Select Descriptor</li>` + descriptors
    .map((d) => `<li data-value="${d.id}">${d.name}</li>`)
    .join("");
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

// Reset dropdowns
function resetDropdown(dropdownId, placeholderText) {
  const dropdown = document.getElementById(dropdownId);
  dropdown.innerHTML = `<li data-value="">${placeholderText}</li>`;
}
