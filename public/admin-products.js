let currentPage = 1;
const productsPerPage = 60;
let allProducts = [];

document.addEventListener("DOMContentLoaded", () => {
    const productForm = document.getElementById("productForm");
    const updateProductBtn = document.getElementById("updateProductBtn");
    const categorySelect = document.getElementById("productCategory");
    const subcategorySelect = document.getElementById("productSubCategory");
    const tagSelect = document.getElementById("productTag");
    const searchInput = document.getElementById("productSearch");

    if (categorySelect) {
        loadCategories();
        categorySelect.addEventListener("change", async () => {
            const categoryId = categorySelect.value;
            resetDropdown(subcategorySelect, "Select a Subcategory");
            resetDropdown(tagSelect, "Select a Tag");
            if (categoryId) {
                await loadSubcategories(categoryId);
            }
        });
    }

    if (subcategorySelect) {
        subcategorySelect.addEventListener("change", async () => {
            const subCategoryId = subcategorySelect.value;
            resetDropdown(tagSelect, "Select a Tag");
            if (subCategoryId) {
                await loadTags(subCategoryId);
            }
        });
    }

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
        };

        try {
            const url = productId
                ? `http://localhost:5000/api/products/${productId}`
                : "http://localhost:5000/api/products";
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
                const errorText = await response.text();
                console.error("Failed to save product:", errorText);
                alert("Failed to save product. Please check your input.");
            }
        } catch (error) {
            console.error("Error saving product:", error);
            alert("An error occurred while saving the product. Please try again later.");
        }
    });

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
            };

            try {
                const response = await fetch(`http://localhost:5000/api/products/${productId}`, {
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
                    console.error("Failed to update product:", errorText);
                    alert("Failed to update product. Please check your input.");
                }
            } catch (error) {
                console.error("Error updating product:", error);
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

    loadProducts();
});

async function loadCategories() {
    try {
        const response = await fetch("http://localhost:5000/api/categories");
        const categories = await response.json();
        populateDropdown(document.getElementById("productCategory"), categories, "Categoryid", "name");
    } catch (error) {
        console.error("Error loading categories:", error);
    }
}

async function loadSubcategories(categoryId) {
    try {
        const response = await fetch(`http://localhost:5000/api/subcategories?categoryId=${categoryId}`);
        const subcategories = await response.json();
        populateDropdown(document.getElementById("productSubCategory"), subcategories, "SubCategoryID", "SubCategoryName");
    } catch (error) {
        console.error("Error loading subcategories:", error);
    }
}

async function loadTags(subCategoryId) {
    try {
        const response = await fetch(`http://localhost:5000/api/descriptors?subCategoryId=${subCategoryId}`);
        const tags = await response.json();
        populateDropdown(document.getElementById("productTag"), tags, "DescriptorID", "DescriptorName");
    } catch (error) {
        console.error("Error loading tags:", error);
    }
}

function resetForm() {
    document.getElementById("productForm").reset();
    document.getElementById("productId").value = ""; // Clear the productId field
    resetDropdown(document.getElementById("productSubCategory"), "Select a Subcategory");
    resetDropdown(document.getElementById("productTag"), "Select a Tag");
}

function resetDropdown(selectElement, placeholder) {
    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
}

function populateDropdown(selectElement, items, valueKey, textKey) {
    selectElement.innerHTML = `<option value="">Select</option>`;
    items.forEach(item => {
        selectElement.innerHTML += `<option value="${item[valueKey]}">${item[textKey]}</option>`;
    });
}

async function loadProducts() {
    try {
        const response = await fetch("http://localhost:5000/api/products");
        const products = await response.json();
        allProducts = products; // Populate the global allProducts array
        renderProducts(products);
    } catch (error) {
        console.error("Error loading products:", error);
    }
}

function renderProducts(products) {
    const startIndex = (currentPage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    const productsToDisplay = products.slice(startIndex, endIndex);

    const container = document.getElementById("admin-products-container");
    container.innerHTML = productsToDisplay.map(product => `
        <div class="product-card" data-id="${product.id}">
            <img src="${product.image_url || './images/default-image.jpg'}" alt="${product.name}" />
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <p><strong>Price:</strong> $${product.price.toFixed(2)}</p>
            <p><strong>Stock:</strong> ${product.stock_quantity}</p>
            <div class="product-actions">
                <button class="update-btn" onclick="handleUpdateClick(event, ${product.id})">Update</button>
                <button class="delete-btn" onclick="deleteProduct(${product.id})">Delete</button>
            </div>
        </div>
    `).join("");

    renderPagination(products.length);
}

function renderPagination(totalProducts) {
    const paginationControls = document.getElementById("paginationControls");
    paginationControls.innerHTML = ""; // Clear existing buttons

    const totalPages = Math.ceil(totalProducts / productsPerPage);
    for (let i = 1; i <= totalPages; i++) {
        const button = document.createElement("button");
        button.textContent = i;
        button.classList.add(i === currentPage ? "active" : "");
        button.disabled = i === currentPage;
        button.addEventListener("click", () => {
            currentPage = i;
            renderProducts(allProducts);
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
        const response = await fetch(`http://localhost:5000/api/products/${productId}`);
        if (!response.ok) throw new Error("Failed to fetch product details");

        const product = await response.json();

        // Populate the form fields with the product details
        document.getElementById("productId").value = product.id;
        document.getElementById("productName").value = product.name;
        document.getElementById("productDescription").value = product.description;
        document.getElementById("productPrice").value = product.price;
        document.getElementById("productStock").value = product.stock_quantity;
        document.getElementById("productImageUrl").value = product.image_url || "";
        document.getElementById("productCategory").value = product.category_id;
        document.getElementById("productShowcase").checked = product.is_showcase;

        // Load subcategories and tags dynamically
        if (product.category_id) {
            await loadSubcategories(product.category_id);
            document.getElementById("productSubCategory").value = product.sub_category_id || "";
        }

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
        console.error("Error editing product:", error);
        alert("Failed to load product details. Please try again.");
    }
}

async function deleteProduct(productId) {
    if (!confirm("Are you sure you want to delete this product?")) {
        return;
    }

    try {
        const response = await fetch(`http://localhost:5000/api/products/${productId}`, {
            method: "DELETE",
        });

        if (response.ok) {
            alert("Product deleted successfully!");
            loadProducts(); // Reload the product list
        } else {
            const errorText = await response.text();
            console.error("Failed to delete product:", errorText);
            alert("Failed to delete product. Please try again.");
        }
    } catch (error) {
        console.error("Error deleting product:", error);
        alert("An error occurred while deleting the product. Please try again later.");
    }
}
