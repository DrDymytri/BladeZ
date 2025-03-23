document.addEventListener("DOMContentLoaded", async () => {
  await showShowcaseModal(); // Ensure the modal is shown before loading other content
  loadProducts();
  updateCartCount();
});

async function loadProducts() {
  try {
      const response = await fetch('http://localhost:5000/api/products');
      if (!response.ok) throw new Error('Failed to fetch products');

      const products = await response.json();
      console.log('Products fetched:', products);

      const productsContainer = document.getElementById('product-container');
      if (!productsContainer) {
          console.error('Product container not found in DOM');
          return;
      }

      if (products.length === 0) {
          productsContainer.innerHTML = '<p class="error-message">No products available at the moment.</p>';
          return;
      }

      productsContainer.innerHTML = products.map(product => `
          <div class="product-item">
              <img src="${product.image_url || './images/default-image.jpg'}" alt="${product.name}" onclick="openImageInPopup('${product.image_url || './images/default-image.jpg'}')" />
              <h3>${product.name}</h3>
              <p>${product.description}</p>
              <p><strong>Price:</strong> $${product.price.toFixed(2)}</p>
              <p><strong>Stock:</strong> ${product.stock_quantity}</p>
              <button class="add-to-cart" onclick="addToCart(${product.id}, '${product.name}', ${product.price})">Add to Cart</button>
          </div>
      `).join('');
  } catch (error) {
      console.error('Error loading products:', error);
      displayErrorMessage('Failed to load products. Please try again later.');
  }
}

async function showShowcaseModal() {
  try {
    const response = await fetch("/api/showcase-products");
    if (!response.ok) throw new Error("Failed to fetch showcase products");
    const products = await response.json();

    let modal = document.querySelector(".modal");
    if (modal) {
      modal.style.display = "flex"; // Ensure the modal is visible
      return;
    }

    modal = document.createElement("div");
    modal.classList.add("modal");
    modal.innerHTML = `
      <div class="modal-content">
        <h1 class="businessName">Showcased Products
          <span class="close">&times;</span>
        </h1>
        <p class="subTitle">--- Take it off the shelf and look at it! ---<br>
            Right Click on Image, go to "magnify image" to zoom and pan image.
            <br>Click on the image to see the image in full size.
        </p>
        <div class="showcase-products-grid">
          ${products.map(p => `
            <div class="product-item">
              <img src="${p.image_url || './images/default-image.jpg'}" alt="${p.name}" class="product-image" onclick="openImageInPopup('${p.image_url || './images/default-image.jpg'}')" />
              <h3>${p.name}</h3>
              <p>${p.description}</p>
              <p class="price"><strong>Price:</strong> <em>$${p.price.toFixed(2)}</em></p>
              <p class="stock"><strong>Stock:</strong> <em>${p.stock_quantity}</em></p>
              <button class="add-to-cart" onclick="addToCart(${p.id}, '${p.name}', ${p.price})">Add to Cart</button>
            </div>`
          ).join('')}
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const closeBtn = modal.querySelector(".close");
    closeBtn.addEventListener("click", () => {
      modal.style.display = "none";
    });

    window.addEventListener("click", (event) => {
      if (event.target === modal) {
        modal.style.display = "none";
      }
    });

    modal.style.display = "flex"; // Ensure the modal is displayed in the center

  } catch (error) {
    console.error("Error loading showcase products:", error);
    displayErrorMessage('Failed to load showcase products. Please try again later.');
  }
}

function openImageInPopup(imageUrl) {
  const popupWidth = 800; // Set desired width
  const popupHeight = 600; // Set desired height
  const left = (screen.width - popupWidth) / 2; // Center horizontally
  const top = (screen.height - popupHeight) / 2; // Center vertically

  // Open the new window
  const popup = window.open(
    "",
    "_blank",
    "fullscreen=yes,toolbar=no,location=no,directories=no,status=no,menubar=no,copyhistory=no",
    `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );

  if (popup) {
    // Set the content for the popup
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
              max-width: 100vw;
              max-height: 100vh;
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


function displayProducts(products) {
  const productContainer = document.getElementById("product-container");
  if (productContainer) {
    productContainer.innerHTML = products
      .map(
        (p) => `
          <div class="product-card">
            <img src="${p.image_url}" alt="${p.name}" class="product-image" onclick="openImageInPopup('${p.image_url}')" />
            <h3>${p.name}</h3>
            <p>${p.description}</p>
            <p class="price"><strong>Price:</strong> <em>${p.price.toFixed(2)}</em></p>
            <p class="stock"><strong>Stock:</strong> <em>${p.stock_quantity}</em></p>
            <button class="add-to-cart" onclick="addToCart(${p.id}, '${p.name}', ${p.price})">Add to Cart</button>
          </div>`
      )
      .join("");
  }

  // Setup image modal for images within the product section
  setupImageModal(productContainer);
}


function displayErrorMessage(message) {
  const productContainer = document.getElementById("product-container");
  if (productContainer) {
    productContainer.innerHTML = `<div class="error-message">${message}</div>`;
  }
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
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const cartCountElement = document.getElementById("cart-count");

    if (cartCountElement) {
        cartCountElement.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    } else {
        console.warn("Cart count element not found in the DOM.");
    }
}

// Update cart count on page load
updateCartCount();

function setupImageModal(container = document) {
  container.addEventListener("click", (event) => {
      const target = event.target;
      if (target.classList.contains("product-image")) {
          showImageModal(target.src); // Only open the modal when an image is clicked
      }
  });
}

function showImageModal(imageSrc) {
  let imageModal = document.getElementById("image-modal");
  if (!imageModal) {
    imageModal = document.createElement("div");
    imageModal.id = "image-modal";
    imageModal.classList.add("image-modal");
    imageModal.innerHTML = `
      <span class="close">&times;</span>
      <img class="modal-image" id="modal-image" />
    `;
    document.body.appendChild(imageModal);

    const closeBtn = imageModal.querySelector(".close");
    closeBtn.addEventListener("click", () => {
      imageModal.style.display = "none";
      document.getElementById("modal-image").src = "";
    });

    window.addEventListener("click", (event) => {
      if (event.target === imageModal) {
        imageModal.style.display = "none";
        document.getElementById("modal-image").src = "";
      }
    });
  }

  const modalImage = document.getElementById("modal-image");
  modalImage.src = imageSrc;
  imageModal.style.display = "flex";
}
