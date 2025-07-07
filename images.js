document.addEventListener("DOMContentLoaded", async () => {
  const imagesContainer = document.getElementById("images-container");
  try {
    if (!window.BACKEND_URL) {
      console.error("BACKEND_URL is not defined. Ensure config.js is loaded before this script.");
      imagesContainer.innerHTML = "<p>Failed to load images. Please try again later.</p>";
      return;
    }

    const images = await apiService.get("/api/images");
    if (!images || images.length === 0) {
      imagesContainer.innerHTML = "<p>No images available at the moment.</p>";
      return;
    }

    imagesContainer.innerHTML = images
      .map(
        (image) => `
        <div class="image-card">
          <img src="${image.url}" alt="${image.title}" />
          <p>${image.title}</p>
        </div>
      `
      )
      .join("");
  } catch (error) {
    console.error("Error fetching images:", error.message);
    imagesContainer.innerHTML = "<p>Failed to load images. Please try again later.</p>";
  }
});

// Function to open the image in a popup
function openImagePopup(imagePath, imageTitle) {
  // Create the popup container
  const popup = document.createElement("div");
  popup.classList.add("image-popup");

  // Add the popup content
  popup.innerHTML = `
    <div class="popup-content">
      <span class="close-popup" onclick="closeImagePopup()">&times;</span>
      <img src="${imagePath}" alt="${imageTitle}" />
      <p>${imageTitle}</p>
    </div>
  `;

  // Ensure the popup is scrollable if needed
  popup.style.overflow = "auto";

  // Append the popup to the body
  document.body.appendChild(popup);
}

// Function to close the popup
function closeImagePopup() {
  const popup = document.querySelector(".image-popup");
  if (popup) {
    popup.remove();
  }
}
