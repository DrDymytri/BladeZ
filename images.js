document.addEventListener("DOMContentLoaded", async () => {
  const imagesContainer = document.getElementById("images-container");

  try {
    const response = await fetch("https://<your-backend-url>/api/images");
    if (!response.ok) throw new Error("Failed to fetch images");

    const images = await response.json();
    imagesContainer.innerHTML = images
      .map(
        (image) => `
        <div class="image-card">
          <img src="${image.url}" alt="${image.title}" class="image" />
          <h3>${image.title}</h3>
          <p>${image.description}</p>
        </div>
      `
      )
      .join("");
  } catch (error) {
    console.error("Error loading images:", error.message);
    imagesContainer.innerHTML = "<p>Error loading images. Please try again later.</p>";
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
function closeImagePopup() {
  const popup = document.querySelector(".image-popup");
  if (popup) {
    popup.remove();
  }
}
