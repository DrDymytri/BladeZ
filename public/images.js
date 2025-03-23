document.addEventListener("DOMContentLoaded", () => {
  const imagesContainer = document.getElementById("imageGallery");

  // Fetch images from the server
  fetch("http://localhost:5000/api/images") // Ensure this URL matches your backend
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

      images.forEach((image) => {
        if (!image.image_url || !image.description) {
          console.warn("Invalid image data:", image);
          return;
        }

        // Create image card
        const imageCard = document.createElement("div");
        imageCard.classList.add("image-card");

        imageCard.innerHTML = `
          <img src="${image.image_url}" alt="${image.description}" class="gallery-image" />
          <p>${image.description}</p>
        `;

        // Add click event to open the image in a larger view
        imageCard.querySelector("img").addEventListener("click", () => {
          openImageInPopup(image.image_url);
        });

        // Append card to container
        imagesContainer.appendChild(imageCard);
      });
    })
    .catch((error) => {
      console.error("Error fetching images:", error);
      imagesContainer.innerHTML = "<p>Failed to load images. Please try again later.</p>";
    });

  // Function to open the image in a popup
  function openImageInPopup(imageUrl) {
    const popup = document.createElement("div");
    popup.classList.add("image-popup");
    popup.innerHTML = `
      <div class="popup-content">
        <span class="close-popup">&times;</span>
        <img src="${imageUrl}" alt="Image" />
      </div>
    `;

    // Close popup on click
    popup.querySelector(".close-popup").addEventListener("click", () => {
      popup.remove();
    });

    document.body.appendChild(popup);
  }
});
