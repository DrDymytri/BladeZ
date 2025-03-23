document.addEventListener("DOMContentLoaded", () => {
    const categorySelect = document.getElementById('productCategory');
    const subcategorySelect = document.getElementById('productSubCategory');
    const tagSelect = document.getElementById('productTag');
    const productForm = document.getElementById("productForm");

    if (categorySelect) {
        categorySelect.addEventListener('change', async () => {
            const categoryId = categorySelect.value;

            // Reset and disable subcategory and tag dropdowns
            if (subcategorySelect) {
                subcategorySelect.innerHTML = '<option value="">Select a Subcategory</option>';
                subcategorySelect.disabled = true;
            }
            if (tagSelect) {
                tagSelect.innerHTML = '<option value="">Select a Tag</option>';
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
                tagSelect.innerHTML = '<option value="">Select a Tag</option>';
                tagSelect.disabled = true;
            }

            if (subCategoryId) {
                await loadTags(subCategoryId);
                if (tagSelect) tagSelect.disabled = false;
            }
        });
    }

    if (productForm) {
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
                const response = await fetch("http://localhost:5000/api/products", {
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
    } else {
        console.warn("Product form not found in the DOM.");
    }
});

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

async function loadCategories() {
    try {
        const categorySelect = document.getElementById('productCategory');
        if (!categorySelect) {
            console.error('Category select element not found in DOM');
            return;
        }

        const response = await fetch('http://localhost:5000/api/categories');
        if (!response.ok) throw new Error('Failed to fetch categories');

        const categories = await response.json();
        categorySelect.innerHTML = '<option value="">Select a Category</option>';
        categories.forEach(category => {
            categorySelect.innerHTML += `<option value="${category.Categoryid}">${category.name}</option>`;
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
      const subcategorySelect = document.getElementById('productSubCategory');
      subcategorySelect.innerHTML = '<option value="">Select a Subcategory</option>';
      subcategories.forEach(subcategory => {
          subcategorySelect.innerHTML += `<option value="${subcategory.SubCategoryID}">${subcategory.SubCategoryName}</option>`;
      });
  } catch (error) {
      console.error('Error loading subcategories:', error);
  }
}

async function loadTags(subCategoryId) {
  try {
      const response = await fetch(`http://localhost:5000/api/descriptors?subCategoryId=${subCategoryId}`);
      if (!response.ok) throw new Error('Failed to fetch tags');

      const tags = await response.json();
      const tagSelect = document.getElementById('productTag');
      tagSelect.innerHTML = '<option value="">Select a Tag</option>';
      tags.forEach(tag => {
          tagSelect.innerHTML += `<option value="${tag.DescriptorID}">${tag.DescriptorName}</option>`;
      });
  } catch (error) {
      console.error('Error loading tags:', error);
  }
}

// Handle missing default image gracefully
function getDefaultImageUrl() {
    return './Images/default-image.jpg'; // Ensure this path matches the actual location of the image
}

// Initial load
loadProducts();

// Update cart count on page load
updateCartCount();
