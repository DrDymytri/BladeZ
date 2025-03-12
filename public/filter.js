// Wait for the DOM content to be loaded
document.addEventListener("DOMContentLoaded", () => {
  loadCategories(); // Populate the first dropdown with categories
  setupFilterListeners(); // Set up the event listeners for the dropdowns
  updateProductTitle("Featured Items"); // Set initial title
});

// Cache for fetched data
const cache = {
  categories: null,
  subCategories: {},
  descriptors: {},
  products: {}
};

// Debounce function to limit the rate of function execution
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Fetch and load categories
async function loadCategories() {
  if (cache.categories) {
    populateCategorySelect(cache.categories);
    return;
  }
  try {
    const response = await fetch("/api/categories"); // Fetch data from the server
    const categories = await response.json();
    cache.categories = categories;
    populateCategorySelect(categories); // Populate dropdown
  } catch (error) {
    console.error("Error loading categories:", error);
    alert("Failed to load categories. Please try again later.");
  }
}

// Fetch and load sub-categories based on selected category
async function loadSubCategories(categoryId) {
  // Clear old descriptors if the category changes
  cache.descriptors = {};

  if (cache.subCategories[categoryId]) {
    populateSubCategorySelect(cache.subCategories[categoryId]);
    return;
  }
  try {
    resetDropdown("subCategorySelect", "Select Sub-Category");
    resetDropdown("descriptorSelect", "Select Descriptor");
    const response = await fetch(`/api/subcategories?categoryId=${categoryId}`);
    const subCategories = await response.json();
    cache.subCategories[categoryId] = subCategories;
    populateSubCategorySelect(subCategories);
  } catch (error) {
    console.error("Error loading sub-categories:", error);
    alert("No products in this filter sequence. Please try again later.");
  }
}

// Fetch and load descriptors based on selected sub-category
async function loadDescriptors(subCategoryId) {
  if (cache.descriptors[subCategoryId]) {
    populateDescriptorSelect(cache.descriptors[subCategoryId]);
    return;
  }
  try {
    resetDropdown("descriptorSelect", "Select Descriptor");
    const response = await fetch(`/api/descriptors?subCategoryId=${subCategoryId}`);
    const descriptors = await response.json();
    cache.descriptors[subCategoryId] = descriptors;
    populateDescriptorSelect(descriptors);
  } catch (error) {
    console.error("Error loading descriptors:", error);
    alert("Failed to load descriptors. Please try again later.");
  }
}

// Fetch and load products based on selected descriptor
async function loadProducts(descriptorId) {
  if (!descriptorId) {
    console.error("Descriptor ID is not set");
    return;
  }
  if (cache.products[descriptorId]) {
    displayProducts(cache.products[descriptorId]);
    return;
  }
  try {
    const response = await fetch(`/api/products?descriptorId=${descriptorId}`);
    if (!response.ok) {
      throw new Error("Failed to fetch products");
    }
    const products = await response.json();
    cache.products[descriptorId] = products;
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

  document.getElementById("categorySelect").addEventListener("click", debounce((e) => {
    if (e.target.tagName === "LI") {
      const categoryId = e.target.dataset.value;
      const categoryName = e.target.textContent;
      
      // Reset subcategory and descriptor dropdowns
      resetDropdown("subCategorySelect", "Select Sub-Category", true);
      resetDropdown("descriptorSelect", "Select Descriptor", true);
  
      if (categoryId) {
        loadSubCategories(categoryId); // Fetch and populate subcategories
      }
  
      document.getElementById("subcategory-container").style.display = "flex";
      document.getElementById("categorySelect").style.display = "none";
      document.getElementById("category-label").textContent = `${categoryName}-->`;
      updateProductTitle("Viewing: Filtered Selections:");
      document.getElementById("subcategory-label").textContent = "Select Sub-Category";
      document.getElementById("descriptor-label").textContent = "Select Descriptor";
    }
  }, 300));

  document.getElementById("subcategory-label").addEventListener("click", () => {
    toggleListDisplay("subCategorySelect");
  });

  document.getElementById("subCategorySelect").addEventListener("click", debounce((e) => {
    if (e.target.tagName === "LI") {
      const subCategoryId = e.target.dataset.value;
      const subCategoryName = e.target.textContent;
      
      // Reset descriptor dropdown
      resetDropdown("descriptorSelect", "Select Descriptor", true);
  
      if (subCategoryId) {
        loadDescriptors(subCategoryId); // Fetch and populate descriptors
      }
  
      document.getElementById("descriptor-container").style.display = "flex";
      document.getElementById("subCategorySelect").style.display = "none";
      document.getElementById("subcategory-label").textContent = `${subCategoryName}-->`;
      updateProductTitle("Viewing: Filtered Selections:");
      document.getElementById("descriptor-label").textContent = "Select Descriptor";
    }
  }, 300));

  document.getElementById("descriptor-label").addEventListener("click", () => {
    toggleListDisplay("descriptorSelect");
  });

  document.getElementById("descriptorSelect").addEventListener("click", debounce((e) => {
    if (e.target.tagName === "LI") {
      const descriptorId = e.target.dataset.value;
      const descriptorName = e.target.textContent;
      if (descriptorId) {
        loadProducts(descriptorId);
        document.getElementById("descriptorSelect").style.display = "none";
        document.getElementById("descriptor-label").textContent = `${descriptorName}`;
        updateProductTitle("Viewing: Filtered Selections:");
      }
    }
  }, 300));
}

// Update the product title
function updateProductTitle(text) {
  const productTitle = document.querySelector(".productTitle");
  if (productTitle) {
    productTitle.textContent = text;
  }
}

// Toggle the display of the list
function toggleListDisplay(listId) {
  const list = document.getElementById(listId);
  if (list) {
    const isVisible = list.style.display === "block";
    closeAllDropdowns();
    if (!isVisible) {
      list.style.display = "block";
    }
  }
}

// Close all dropdowns
function closeAllDropdowns() {
  const categorySelect = document.getElementById("categorySelect");
  const subCategorySelect = document.getElementById("subCategorySelect");
  const descriptorSelect = document.getElementById("descriptorSelect");

  if (categorySelect) categorySelect.style.display = "none";
  if (subCategorySelect) subCategorySelect.style.display = "none";
  if (descriptorSelect) descriptorSelect.style.display = "none";
}

// Populate the categories list
function populateCategorySelect(categories) {
  const categorySelect = document.getElementById("categorySelect");
  if (categorySelect) {
    categorySelect.innerHTML = `<li data-value="">Select Category</li>` + categories
      .map((c) => `<li data-value="${c.id}">${c.name}</li>`)
      .join("");
  }
}

// Populate the sub-categories list
function populateSubCategorySelect(subCategories) {
  const subCategorySelect = document.getElementById("subCategorySelect");
  if (subCategorySelect) {
    if (subCategories.length === 0) {
      subCategorySelect.innerHTML = `<li data-value="">No Sub-Categories Available</li>`;
    } else {
      subCategorySelect.innerHTML = `<li data-value="">Select Sub-Category</li>` + subCategories
        .map((sc) => `<li data-value="${sc.id}">${sc.name}</li>`)
        .join("");
    }
  }
}

// Populate the descriptors list
function populateDescriptorSelect(descriptors) {
  const descriptorSelect = document.getElementById("descriptorSelect");
  if (descriptorSelect) {
    if (descriptors.length === 0) {
      descriptorSelect.innerHTML = `<li data-value="">No Descriptors Available</li>`;
    } else {
      descriptorSelect.innerHTML = `<li data-value="">Select Descriptor</li>` + descriptors
        .map((d) => `<li data-value="${d.id}">${d.name}</li>`)
        .join("");
    }
  }
}

function displayProducts(products) {
  const productContainer = document.getElementById("product-container");
  if (productContainer) {
    productContainer.innerHTML = products
      .map(
        (p) =>
          `<div class="product-item">
            ${p.featured == 1 ? '<div class="featured-label"><em>Featured Item</em></div>' : ''}
            <img src="${p.image_url}" alt="${p.name}" />
            <h3>${p.name}</h3>
            <p>${p.description}</p>
            <p class="price"><strong>Price:</strong> <em>$${p.price.toFixed(2)}</em></p>
            <button class="add-to-cart" onclick="addToCart(${p.id}, '${p.name}', ${p.price})">Add to Cart</button>
          </div>`
      )
      .join("");
  }
}

// Reset dropdowns
function resetDropdown(dropdownId, placeholderText, clearCache = false) {
  const dropdown = document.getElementById(dropdownId);
  if (dropdown) {
    dropdown.innerHTML = `<li data-value="">${placeholderText}</li>`;
    if (clearCache) {
      if (dropdownId === "subCategorySelect") {
        cache.subCategories = {}; // Clear cached subcategories
      } else if (dropdownId === "descriptorSelect") {
        cache.descriptors = {}; // Clear cached descriptors
      }
    }
  }
}

