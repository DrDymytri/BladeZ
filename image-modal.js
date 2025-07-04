document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.event-image, .modal-trigger-image').forEach(img => {
        img.addEventListener('click', () => {
            showImageModal(img.src);
        });
    });
});

// Utility to open image in a popup window (for right-click/magnify)
function openImageInPopup(imageUrl) {
    const popupWidth = Math.min(window.screen.width * 0.8, 800);
    const popupHeight = Math.min(window.screen.height * 0.8, 600);
    const left = (window.screen.width - popupWidth) / 2;
    const top = (window.screen.height - popupHeight) / 2;

    const popup = window.open(
        "",
        "_blank",
        `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (popup) {
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
                overflow: hidden;
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
        popup.document.close();
    } else {
        alert("Popup blocked! Please allow popups for this site.");
    }
}

// Modal-based image viewer (for single-click enlarge)
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

        imageModal.querySelector(".close").addEventListener("click", () => {
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
