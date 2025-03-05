document.addEventListener("DOMContentLoaded", () => {
  const productContainer = document.getElementById("product-container");
  const imageModal = document.getElementById("image-modal");
  const modalImage = document.getElementById("modal-image");

  productContainer.addEventListener("click", (event) => {
    const target = event.target;
    if (target.tagName === "IMG") {
      modalImage.src = target.src;
      imageModal.style.display = "flex";
    }
  });

  imageModal.addEventListener("click", () => {
    imageModal.style.display = "none";
    modalImage.src = "";
  });
});
