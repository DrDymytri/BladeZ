document.addEventListener("DOMContentLoaded", () => {
  const imagesContainer = document.getElementById("images-container");

  if (!imagesContainer) {
    console.error("Error: Element with ID 'images-container' not found in the DOM.");
    return;
  }

  // Fetch images from the server
  fetch(`${BACKEND_URL}/api/images`)
    .then((response) => {
      if (!response.ok) {
        console.error(`Error: Received status ${response.status}`);
        throw new Error("Failed to fetch images");
      }
      return response.json();
    })
    .then((images) => {
      if (!images || images.length === 0) {
        console.warn("No images found in the response.");
        imagesContainer.innerHTML = "<p>No images available at the moment.</p>";
        return;
      }

      imagesContainer.innerHTML = images
        .map(
          (image) => `
          <div class="image-card">
            <img src="${image.path}" alt="${image.title}" onclick="openImagePopup('${image.path}', '${image.title}')" />
            <p>${image.title}</p>
          </div>
        `
        )
        .join("");
    })
    .catch((error) => {
      console.error("Error fetching images:", error);
      imagesContainer.innerHTML = "<p>Failed to load images. Please try again later.</p>";
    });
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
