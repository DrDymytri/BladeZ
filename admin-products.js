const BACKEND_URL = "https://bladez-backend.onrender.com"; // Public-facing Render URL

let currentPage = 1; // Initialize current page for pagination
let productsPerPage = 20; // Default products per page
let allProducts = [];
let currentSort = { field: "name", order: "asc" }; // Default sort by name in ascending order
let showOnlyShowcased = false; // State to track if only showcased products should be displayed
let showcasedSortMode = "Yes"; // State to track showcased sort mode (Yes/No)
let currentSortColumn = null;
let currentSortOrder = "asc";

document.addEventListener("DOMContentLoaded", () => {
    // Ensure all event listeners are correctly set up
    const productForm = document.getElementById("productForm");
    const updateProductBtn = document.getElementById("updateProductBtn");
    const categorySelect = document.getElementById("productCategory");
    const subcategorySelect = document.getElementById("productSubCategory");
    const tagSelect = document.getElementById("productTag");
    const searchInput = document.getElementById("productSearch");
    const toggleShowcaseBtn = document.getElementById("toggleShowcaseBtn");
    const lowStockBtn = document.getElementById("lowStockBtn");
    const lowStockSection = document.querySelector(".low-stock-section");
    const productsPerPageSelect = document.getElementById("productsPerPageSelect");

    if (productForm) {
        productForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const productId = document.getElementById("productId")?.value || null;
            const newProduct = {
                name: document.getElementById("productName").value.trim(),
                description: document.getElementById("productDescription").value.trim(),
                price: parseFloat(document.getElementById("productPrice").value),
                stock_quantity: parseInt(document.getElementById("productStock").value),
                category_id: parseInt(document.getElementById("productCategory").value),
                sub_category_id: parseInt(document.getElementById("productSubCategory").value) || null,
                tag_id: parseInt(document.getElementById("productTag").value) || null,
                image_url: document.getElementById("productImageUrl").value.trim(),
                is_showcase: document.getElementById("productShowcase").checked,
                manufacturer_product_number: document.getElementById("manufacturerProductNumber").value.trim(),
                restock_threshold: parseInt(document.getElementById("restockThreshold").value),
            };

            try {
                const url = productId
                    ? `${BACKEND_URL}/api/products/${productId}`
                    : `${BACKEND_URL}/api/products`;
                const method = productId ? "PUT" : "POST";

                const response = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(newProduct),
                });

                if (response.ok) {
                    alert(productId ? "Product updated successfully!" : "Product added successfully!");
                    resetForm();
                    loadProducts();
                } else {
                    const errorData = await response.json();
                    alert(`Failed to save product: ${errorData.error || "Unknown error occurred."}`);
                }
            } catch (error) {
                alert("An error occurred while saving the product. Please try again later.");
            }
        });
    }

    if (updateProductBtn) {
        updateProductBtn.addEventListener("click", async () => {
            const productId = document.getElementById("productId").value;
            if (!productId) {
                alert("No product selected for update.");
                return;
            }

            const updatedProduct = {
                name: document.getElementById("productName").value.trim(),
                description: document.getElementById("productDescription").value.trim(),
                price: parseFloat(document.getElementById("productPrice").value),
                stock_quantity: parseInt(document.getElementById("productStock").value),
                category_id: parseInt(document.getElementById("productCategory").value),
                sub_category_id: parseInt(document.getElementById("productSubCategory").value) || null,
                tag_id: parseInt(document.getElementById("productTag").value) || null,
                image_url: document.getElementById("productImageUrl").value.trim(),
                is_showcase: document.getElementById("productShowcase").checked,
                manufacturer_product_number: document.getElementById("manufacturerProductNumber").value.trim(),
                restock_threshold: parseInt(document.getElementById("restockThreshold").value),
            };

            try {
                const response = await fetch(`${BACKEND_URL}/api/products/${productId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updatedProduct),
                });

                if (response.ok) {
                    alert("Product updated successfully!");
                    resetForm();
                    loadProducts();
                } else {
                    const errorText = await response.text();
                    alert("Failed to update product. Please check your input.");
                }
            } catch (error) {
                alert("An error occurred while updating the product. Please try again later.");
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const query = searchInput.value.toLowerCase();
            const filteredProducts = allProducts.filter((product) =>
                product.name.toLowerCase().includes(query) ||
                product.description.toLowerCase().includes(query)
            );
            renderProducts(filteredProducts); // Render filtered products
        });
    }

    if (toggleShowcaseBtn) {
        toggleShowcaseBtn.addEventListener("click", () => {
            showOnlyShowcased = !showOnlyShowcased; // Toggle the state
            toggleShowcaseBtn.textContent = showOnlyShowcased ? "Show All Products" : "Show Only Showcased";
            renderProducts(allProducts); // Re-render products based on the new state
        });
    }

    if (lowStockBtn) {
        lowStockBtn.addEventListener("click", () => {
            loadLowStockProducts();
            lowStockSection.scrollIntoView({ behavior: "smooth" }); // Scroll to the low-stock section
        });
    }

    if (productsPerPageSelect) {
        productsPerPageSelect.addEventListener("change", () => {
            productsPerPage = parseInt(productsPerPageSelect.value, 10);
            currentPage = 1; // Reset to the first page
            renderProducts(allProducts); // Re-render products with the new setting
        });
    }

    loadProducts();
    loadLowStockProducts();
});

async function loadCategories() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/categories`);
        const categories = await response.json();
        populateDropdown(document.getElementById("productCategory"), categories, "id", "name"); // Use 'id' and 'name'
    } catch (error) {
        console.error("Error loading categories:", error);
    }
}

async function loadSubcategories(categoryId) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/subcategories?categoryId=${categoryId}`);
        const subcategories = await response.json();
        populateDropdown(document.getElementById("productSubCategory"), subcategories, "id", "name");
    } catch (error) {
        console.error("Error loading subcategories:", error);
    }
}

async function loadTags(subCategoryId) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/descriptors?subCategoryId=${subCategoryId}`);
        const tags = await response.json();
        populateDropdown(document.getElementById("productTag"), tags, "id", "name");
    } catch (error) {
        console.error("Error loading tags:", error);
    }
}

async function loadProducts() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/products`);
        if (!response.ok) {
            throw new Error("Failed to fetch products");
        }

        const data = await response.json();
        const products = Array.isArray(data.products) ? data.products : data; // Ensure products is an array
        allProducts = products; // Populate the global allProducts array
        renderProducts(products);
    } catch (error) {
        console.error("Error loading products:", error);
    }
}

function renderProducts(products) {
    // Apply filtering for showcased products if the toggle is active
    const filteredProducts = showOnlyShowcased
        ? products.filter(product => product.is_showcase)
        : products;

    // Apply sorting
    filteredProducts.sort((a, b) => {
        if (currentSort.field === "name") {
            return currentSort.order === "asc"
                ? a.name.localeCompare(b.name)
                : b.name.localeCompare(a.name);
        } else if (currentSort.field === "showcase") {
            return currentSort.order === "asc"
                ? a.is_showcase - b.is_showcase
                : b.is_showcase - a.is_showcase;
        }
        return 0;
    });

    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = Math.min(startIndex + productsPerPage, filteredProducts.length); // Ensure endIndex does not exceed total products
    const productsToDisplay = filteredProducts.slice(startIndex, endIndex);

    const container = document.getElementById("admin-products-container");
    container.innerHTML = productsToDisplay.map(product => `
        <div class="product-card">
            <img src="${product.image_url || 'https://bladezstorage.blob.core.windows.net/bladez-op-images/Default1.png'}" alt="${product.name}" class="product-image" />
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <p><strong>Price:</strong> $${product.price.toFixed(2)}</p>
            <p><strong>Stock:</strong> <span style="color: ${product.stock_quantity < 0 ? 'red' : 'black'};">${product.stock_quantity}</span></p>
            <p><strong>Showcased:</strong> ${product.is_showcase ? "Yes" : "No"}</p>
            <div class="product-actions">
                <button class="update-btn" onclick="handleUpdateClick(event, ${product.id})">Update</button>
                <button class="delete-btn" onclick="deleteProduct(${product.id})">Delete</button>
            </div>
        </div>
    `).join("");

    renderPagination(filteredProducts.length); // Update pagination based on filtered products
}

function renderPagination(totalProducts) {
    const paginationControls = document.getElementById("paginationControls");
    paginationControls.innerHTML = ""; // Clear existing buttons

    const totalPages = Math.ceil(totalProducts / productsPerPage); // Calculate total pages
    if (totalPages <= 1) return; // Do not render pagination if there's only one page

    for (let i = 1; i <= totalPages; i++) {
        const button = document.createElement("button");
        button.textContent = i;
        button.classList.add(i === currentPage ? "active" : "");
        button.disabled = i === currentPage; // Disable the button for the current page
        button.addEventListener("click", () => {
            currentPage = i;
            renderProducts(allProducts); // Re-render products for the selected page
        });
        paginationControls.appendChild(button);
    }
}

function handleUpdateClick(event, productId) {
    event.preventDefault(); // Prevent default action (e.g., scrolling to the top)
    editProduct(productId); // Call the editProduct function
}

async function editProduct(productId) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/products/${productId}`);
        if (!response.ok) {
            if (response.status === 404) {
                alert("Product not found. It may have been deleted.");
                return;
            }
            throw new Error("Failed to fetch product details");
        }

        const product = await response.json();

        // Populate the form fields with the product details
        document.getElementById("productId").value = product.id;
        document.getElementById("productName").value = product.name || "";
        document.getElementById("productDescription").value = product.description || "";
        document.getElementById("productPrice").value = product.price || 0;
        document.getElementById("productStock").value = product.stock_quantity || 0;
        document.getElementById("productImageUrl").value = product.image_url || "";
        document.getElementById("productShowcase").checked = !!product.is_showcase;
        document.getElementById("manufacturerProductNumber").value = product.manufacturer_product_number || "";
        document.getElementById("restockThreshold").value = product.restock_threshold || 0;

        // Load categories and set the selected category
        await loadCategories();
        document.getElementById("productCategory").value = product.category_id || "";

        // Load subcategories and set the selected subcategory
        if (product.category_id) {
            await loadSubcategories(product.category_id);
            document.getElementById("productSubCategory").value = product.sub_category_id || "";
        }

        // Load tags and set the selected tag
        if (product.sub_category_id) {
            await loadTags(product.sub_category_id);
            document.getElementById("productTag").value = product.tag_id || "";
        }

        // Show the "Update Product" button and hide the "Add Product" button
        document.getElementById("addProductBtn").style.display = "none";
        document.getElementById("updateProductBtn").style.display = "block";

        // Scroll to the top of the page
        window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
        console.error("Error fetching product details:", error.message);
        alert("Failed to load product details. Please try again.");
    }
}

async function deleteProduct(productId) {
    if (!confirm("Are you sure you want to delete this product?")) {
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/products/${productId}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
            if (response.status === 404) {
                alert("Product not found. It may have already been deleted.");
                return;
            }
            throw new Error("Failed to delete product");
        }

        alert("Product deleted successfully!");
        allProducts = allProducts.filter(product => product.id !== productId); // Remove the deleted product from the local array
        renderProducts(allProducts); // Re-render the product list
        loadLowStockProducts(); // Refresh the low-stock table
    } catch (error) {
        console.error("Error deleting product:", error.message);
        alert("An error occurred while deleting the product. Please try again later.");
    }
}

function handleSortChange(field) {
    if (field === "showcase") {
        showcasedSortMode = showcasedSortMode === "Yes" ? "No" : "Yes"; // Toggle showcased sort mode
        currentSort = { field: "showcase", order: showcasedSortMode === "Yes" ? "asc" : "desc" };
        const showcaseSortBtn = document.querySelector("button[onclick=\"handleSortChange('showcase')\"]");
        if (showcaseSortBtn) {
            showcaseSortBtn.textContent = `Sort by Showcased (${showcasedSortMode})`;
        }
    } else if (field === "name") {
        currentSort.order = currentSort.order === "asc" ? "desc" : "asc"; // Toggle sort order
        const nameSortBtn = document.querySelector("button[onclick=\"handleSortChange('name')\"]");
        if (nameSortBtn) {
            nameSortBtn.textContent = `Sort by Name (${currentSort.order === "asc" ? "Ascending" : "Descending"})`;
        }
    } else {
        if (currentSort.field === field) {
            currentSort.order = currentSort.order === "asc" ? "desc" : "asc";
        } else {
            currentSort.field = field;
            currentSort.order = "asc";
        }
    }
    renderProducts(allProducts); // Re-render products with the new sort order
}

async function loadLowStockProducts() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/low-stock-products`);
        if (!response.ok) throw new Error("Failed to fetch low-stock products");

        const lowStockProducts = await response.json();
        const filteredProducts = lowStockProducts.filter(product => product.stock_quantity < product.restock_threshold); // Only show products below threshold
        renderLowStockTable(filteredProducts);
    } catch (error) {
        console.error("Error loading low-stock products:", error);
        alert("Failed to load low-stock products. Please try again later.");
    }
}

function renderLowStockTable(products) {
    const lowStockTableBody = document.getElementById("low-stock-table-body");
    const rowCountElement = document.getElementById("row-count");

    if (!lowStockTableBody) return;

    if (products.length === 0) {
        lowStockTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No low-stock products</td></tr>`;
        rowCountElement.textContent = "Total Rows: 0";
        return;
    }

    rowCountElement.textContent = `Total Rows: ${products.length}`;
    lowStockTableBody.innerHTML = products
        .map(product => `
            <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${product.id}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${product.name}</td>
                <td style="border: 1px solid #ddd; padding: 8px; color: ${product.stock_quantity < 0 ? 'red' : 'black'};">${product.stock_quantity}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">${product.restock_threshold}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">
                    <a href="#" class="ViewProduct" onclick="filterByProductId(${product.id})">View Product</a>
                </td>
            </tr>
        `)
        .join("");
}

function populateSearch(productName) {
    const searchInput = document.getElementById("productSearch");
    if (searchInput) {
        searchInput.value = productName;
        searchInput.dispatchEvent(new Event("input")); // Trigger the search functionality
    }
}

function sortTable(column) {
    const lowStockTableBody = document.getElementById("low-stock-table-body");
    const rows = Array.from(lowStockTableBody.querySelectorAll("tr"));

    // Determine sort order
    if (currentSortColumn === column) {
        currentSortOrder = currentSortOrder === "asc" ? "desc" : "asc";
    } else {
        currentSortColumn = column;
        currentSortOrder = "asc";
    }

    // Sort rows
    rows.sort((a, b) => {
        const aValue = a.querySelector(`td:nth-child(${getColumnIndex(column)})`).textContent.trim();
        const bValue = b.querySelector(`td:nth-child(${getColumnIndex(column)})`).textContent.trim();

        if (column === "id" || column === "stock_quantity" || column === "restock_threshold") {
            return currentSortOrder === "asc" ? aValue - bValue : bValue - aValue;
        } else {
            return currentSortOrder === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        }
    });

    // Re-render sorted rows
    lowStockTableBody.innerHTML = "";
    rows.forEach((row) => lowStockTableBody.appendChild(row));
}

function getColumnIndex(column) {
    switch (column) {
        case "id":
            return 1;
        case "name":
            return 2;
        case "stock_quantity":
            return 3;
        case "restock_threshold":
            return 4;
        default:
            return 1;
    }
}

async function updateStock(productId, stockChange) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/products/${productId}/stock`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stockChange }),
        });
        if (!response.ok) throw new Error("Failed to update stock");

        alert("Stock updated successfully!");
        loadProducts(); // Reload the product list
        loadLowStockProducts(); // Refresh the low-stock table
    } catch (error) {
        console.error("Error updating stock:", error);
    }
}

function filterByProductId(productId) {
    const filteredProducts = allProducts.filter(product => product.id === productId);
    renderProducts(filteredProducts); // Render only the filtered product
}

async function updateStock(productId, stockChange) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/products/${productId}/stock`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stockChange }),
        });
        if (!response.ok) throw new Error("Failed to update stock");

        alert("Stock updated successfully!");
        loadProducts(); // Reload the product list
        loadLowStockProducts(); // Refresh the low-stock table
    } catch (error) {
        console.error("Error updating stock:", error);
    }
}

function filterByProductId(productId) {
    const filteredProducts = allProducts.filter(product => product.id === productId);
    renderProducts(filteredProducts); // Render only the filtered product
}

