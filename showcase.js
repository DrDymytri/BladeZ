document.addEventListener("DOMContentLoaded", () => {
  const showcaseAddToCartButtons = document.querySelectorAll(".showcase-add-to-cart");

  showcaseAddToCartButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      const productId = event.target.dataset.productId;
      const productName = event.target.dataset.productName;
      const productPrice = parseFloat(event.target.dataset.productPrice);
      const productImage = event.target.dataset.productImage;

      if (!productId || !productName || !productPrice) {
        console.error("Missing product data for cart addition.");
        return;
      }

      // Retrieve the cart from localStorage
      const cart = JSON.parse(localStorage.getItem("cart")) || [];

      // Check if the product is already in the cart
      const existingProduct = cart.find((item) => item.id === productId);

      if (existingProduct) {
        existingProduct.quantity += 1; // Increment quantity
      } else {
        // Add new product to the cart
        cart.push({
          id: productId,
          name: productName,
          price: productPrice,
          image_url: productImage,
          quantity: 1,
        });
      }

      // Save the updated cart to localStorage
      localStorage.setItem("cart", JSON.stringify(cart));

      // Update the cart count
      updateCartCount();

      alert(`${productName} has been added to your cart.`);
    });
  });

  // Update cart count on page load
  updateCartCount();
});

function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  document.getElementById("cart-count").textContent = cartCount;
}
