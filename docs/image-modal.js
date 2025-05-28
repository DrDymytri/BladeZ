document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    const closeBtn = document.querySelector('.close'); // Use querySelector to select the first element with the class 'close'

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    document.querySelectorAll('.event-image').forEach(img => {
        img.addEventListener('click', () => {
            modal.style.display = 'block';
            modalImg.src = img.src;
        });
    });

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});

function openImageInPopup(imageUrl) {
    const popupWidth = Math.min(screen.width * 0.8, 800); // 80% of screen width, max 800px
    const popupHeight = Math.min(screen.height * 0.8, 600); // 80% of screen height, max 600px
    const left = (screen.width - popupWidth) / 2; // Center horizontally
    const top = (screen.height - popupHeight) / 2; // Center vertically

    // Open a new popup window with calculated dimensions
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
                overflow: hidden; /* Prevent unwanted scrollbars */
              }
              img {
                max-width: 100%;
                max-height: 100%;
                border: 3px solid white;
                border-radius: 5px;
                box-shadow: 0 0 15px rgba(255, 255, 255, 0.7);
              }
            </style>
          </head>
          <body>
            <img src="${imageUrl}" alt="Product Image">
          </body>
        </html>
        `);

        popup.document.close(); // Close the document stream for rendering
    } else {
        alert("Popup blocked! Please allow popups for this site.");
    }
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
