// Initialize Admin Portal
function initAdminPortal() {
    loadAdminProducts();
    loadCategories();
    loadSubcategories();
    loadDescriptors();
    loadEvents();
    setupListeners();
}

document.addEventListener("DOMContentLoaded", () => {
    const categorySelect = document.getElementById("productCategory");
    const subcategorySelect = document.getElementById("productSubCategory");
    const descriptorSelect = document.getElementById("productTag");

    if (categorySelect) {
        // Load categories on page load
        loadCategories();

        // Populate subcategories when a category is selected
        categorySelect.addEventListener("change", async () => {
            const categoryId = categorySelect.value;

            // Reset and disable subcategory and descriptor dropdowns
            if (subcategorySelect) {
                subcategorySelect.innerHTML = '<option value="">Select a Subcategory</option>';
                subcategorySelect.disabled = true;
            }
            if (descriptorSelect) {
                descriptorSelect.innerHTML = '<option value="">Select a Descriptor</option>';
                descriptorSelect.disabled = true;
            }

            if (categoryId) {
                await loadSubcategories(categoryId);
                if (subcategorySelect) subcategorySelect.disabled = false;
            }
        });
    }

    if (subcategorySelect) {
        // Populate descriptors when a subcategory is selected
        subcategorySelect.addEventListener("change", async () => {
            const subCategoryId = subcategorySelect.value;

            // Reset and disable the descriptor dropdown
            if (descriptorSelect) {
                descriptorSelect.innerHTML = '<option value="">Select a Descriptor</option>';
                descriptorSelect.disabled = true;
            }

            if (subCategoryId) {
                await loadDescriptors(subCategoryId);
                if (descriptorSelect) descriptorSelect.disabled = false;
            }
        });
    }

    // Removed redundant event listeners for addProductBtn and updateProductBtn
});

// Load Categories (Populates dropdowns or forms)
async function loadCategories() {
    try {
        const categorySelect = document.getElementById("productCategory");
        if (!categorySelect) {
            console.error("Category select element not found in DOM");
            return;
        }

        const response = await fetch('http://localhost:5000/api/categories');
        if (!response.ok) throw new Error('Failed to fetch categories');

        const categories = await response.json();
        categorySelect.innerHTML = '<option value="">Select a Category</option>';
        categories.forEach(cat => {
            categorySelect.innerHTML += `<option value="${cat.Categoryid}">${cat.name}</option>`;
        });
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function loadSubcategories(categoryId) {
    try {
        const response = await fetch(`http://localhost:5000/api/subcategories?categoryId=${categoryId}`);
        if (!response.ok) throw new Error('Failed to fetch subcategories');

        const subcategories = await response.json();
        const subcategorySelect = document.getElementById("productSubCategory");
        subcategorySelect.innerHTML = '<option value="">Select a Subcategory</option>';
        if (subcategories.length === 0) {
            subcategorySelect.innerHTML = '<option value="">No subcategories available</option>';
            return;
        }
        subcategories.forEach(sub => {
            subcategorySelect.innerHTML += `<option value="${sub.SubCategoryID}">${sub.SubCategoryName}</option>`;
        });
        subcategorySelect.disabled = false;
    } catch (error) {
        console.error('Error loading subcategories:', error);
    }
}

async function loadDescriptors(subCategoryId) {
    try {
        const response = await fetch(`http://localhost:5000/api/descriptors?subCategoryId=${subCategoryId}`);
        if (!response.ok) throw new Error('Failed to fetch descriptors');

        const descriptors = await response.json();
        const descriptorSelect = document.getElementById("productTag");
        descriptorSelect.innerHTML = '<option value="">Select a Descriptor</option>';
        if (descriptors.length === 0) {
            descriptorSelect.innerHTML = '<option value="">No descriptors available</option>';
            return;
        }
        descriptors.forEach(desc => {
            descriptorSelect.innerHTML += `<option value="${desc.DescriptorID}">${desc.DescriptorName}</option>`;
        });
        descriptorSelect.disabled = false;
    } catch (error) {
        console.error('Error loading descriptors:', error);
    }
}

// Load Products
async function loadAdminProducts() {
    try {
        const response = await fetch('http://localhost:5000/api/products');
        if (!response.ok) throw new Error('Failed to fetch products');

        const products = await response.json();
        console.log('Products fetched:', products); // Log fetched products

        const productsTableBody = document.querySelector('#admin-products-table tbody');
        console.log('Products Table Body:', productsTableBody); // Log DOM element
        if (!productsTableBody) throw new Error('Products table body not found');

        productsTableBody.innerHTML = products.map(product => `
            <tr>
                <td>${product.name}</td>
                <td>${product.description}</td>
                <td>$${product.price.toFixed(2)}</td>
                <td>${product.stock_quantity}</td>
                <td class="actions-column">
                    <button class="update-btn" data-id="${product.id}">Update</button>
                    <button class="delete-btn" data-id="${product.id}">Delete</button>
                </td>
            </tr>
        `).join('');
        console.log('Rendered Products Table HTML:', productsTableBody.innerHTML);

        attachEventListeners(); // Attach button listeners after rendering rows
    } catch (error) {
        console.error('Error loading products:', error);
    }
}

// Load Events
async function loadEvents() {
    try {
        const response = await fetch('http://localhost:5000/api/events');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const events = await response.json();
        console.log('Events:', events); // Debugging line

        const eventsTableBody = document.querySelector('#admin-events-table tbody');
        if (eventsTableBody) {
            eventsTableBody.innerHTML = events.map(event => `
                <tr>
                    <td>${event.title}</td>
                    <td>${new Date(event.event_start_date).toLocaleString()}</td>
                    <td>${new Date(event.event_end_date).toLocaleString()}</td>
                    <td>${event.location}</td>
                    <td>${event.description}</td>
                    <td><a href="${event.event_website}" target="_blank">Website</a></td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading events:', error);
        showError('Failed to load events. Please try again later.');
    }
}

// Attach Event Listeners for Dynamic Buttons
function attachEventListeners() {
    document.querySelectorAll('.update-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.id;
            editProduct(productId);
        });
    });

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const productId = event.target.dataset.id;
            deleteProduct(productId);
        });
    });
}

// Edit Product
async function editProduct(productId) {
    try {
        const response = await fetch(`http://localhost:5000/api/products/${productId}`);
        if (!response.ok) throw new Error('Failed to fetch product details');

        const product = await response.json();

        // Populate main form fields
        document.getElementById("productId").value = product.id;
        document.getElementById("productName").value = product.name;
        document.getElementById("productDescription").value = product.description;
        document.getElementById("productPrice").value = product.price;
        document.getElementById("productStock").value = product.stock_quantity;
        document.getElementById("productImageUrl").value = product.image_url || ''; // Correct field for image URL
        document.getElementById("productCategory").value = product.category_id || '';

        // Load and populate dependent dropdowns
        if (product.category_id) {
            await loadSubcategories(product.category_id); // Populate subcategories based on category
            document.getElementById("productSubCategory").value = product.sub_category_id || ''; // Assign subcategory value
        }

        if (product.sub_category_id) {
            await loadDescriptors(product.sub_category_id); // Populate descriptors based on subcategory
            document.getElementById("productTag").value = product.tag_id || ''; // Assign tag value
        }

        // Ensure dropdowns are enabled
        document.getElementById("productSubCategory").disabled = false;
        document.getElementById("productTag").disabled = false;

        // Toggle buttons
        document.getElementById("addProductBtn").style.display = "none";
        document.getElementById("updateProductBtn").style.display = "block";
    } catch (error) {
        console.error('Error editing product:', error);
    }
}

// Update Product
async function updateProduct() {
    const productId = document.getElementById("productId").value;
    const name = document.getElementById("productName").value;
    const description = document.getElementById("productDescription").value;
    const price = parseFloat(document.getElementById("productPrice").value);
    const stock_quantity = parseInt(document.getElementById("productStock").value, 10);
    const image_url = document.getElementById("productImageUrl").value.trim(); // Correct field for image URL
    const category_id = parseInt(document.getElementById("productCategory").value, 10);
    const sub_category_id = parseInt(document.getElementById("productSubCategory").value, 10);
    const tag_id = parseInt(document.getElementById("productTag").value, 10);

    try {
        const response = await fetch(`http://localhost:5000/api/products/${productId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                description,
                price,
                stock_quantity,
                image_url,
                category_id,
                sub_category_id,
                tag_id,
                is_showcase: false // Assuming this is not editable in the admin UI
            })
        });

        if (!response.ok) throw new Error('Failed to update product');

        alert('Product updated successfully!');
        loadAdminProducts(); // Reload product list
        resetForm(); // Reset the form after update
    } catch (error) {
        console.error('Error updating product:', error);
        alert('Failed to update product. Please try again.');
    }
}

// Add Product
async function addProduct() {
    const name = document.getElementById("productName").value.trim();
    const description = document.getElementById("productDescription").value.trim();
    const price = parseFloat(document.getElementById("productPrice").value);
    const stock_quantity = parseInt(document.getElementById("productStock").value, 10);
    const image_url = document.getElementById("productImage").value.trim(); // Ensure no leading/trailing spaces
    const category_id = parseInt(document.getElementById("productCategory").value, 10);
    const sub_category_id = parseInt(document.getElementById("productSubCategory").value, 10);
    const tag_id = parseInt(document.getElementById("productTag").value, 10);

    try {
        const response = await fetch('http://localhost:5000/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                description,
                price,
                stock_quantity,
                image_url: image_url || null, // Send null if the field is empty
                category_id,
                sub_category_id: sub_category_id || null, // Send null if not selected
                tag_id: tag_id || null, // Send null if not selected
                is_showcase: false // Assuming this is not editable in the admin UI
            })
        });

        if (!response.ok) throw new Error('Failed to add product');

        alert('Product added successfully!');
        loadAdminProducts(); // Reload product list
        resetForm(); // Reset the form after adding
    } catch (error) {
        console.error('Error adding product:', error);
        alert('Failed to add product. Please try again.');
    }
}

// Reset Form
function resetForm() {
    document.getElementById("productForm").reset();
    document.getElementById("addProductBtn").style.display = "block";
    document.getElementById("updateProductBtn").style.display = "none";

    // Reset and disable dependent dropdowns
    document.getElementById("productSubCategory").innerHTML = '<option value="">Select a Subcategory</option>';
    document.getElementById("productSubCategory").disabled = true;
    document.getElementById("productTag").innerHTML = '<option value="">Select a Descriptor</option>';
    document.getElementById("productTag").disabled = true;
}

// Delete Product
async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
        const response = await fetch(`http://localhost:5000/api/products/${productId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete product');

        console.log(`Product ${productId} deleted`);
        loadAdminProducts(); // Reload product list after deletion
    } catch (error) {
        console.error('Error deleting product:', error);
        showError('Failed to delete product. Please try again later.');
    }
}

function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const cartCountElement = document.getElementById("cart-count");

    if (cartCountElement) {
        cartCountElement.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    } else {
        console.warn("Cart count element not found in the DOM.");
    }
}



