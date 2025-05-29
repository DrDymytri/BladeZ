const BACKEND_URL = process.env.BACKEND_URL; // Use environment variable only

document.addEventListener("DOMContentLoaded", () => {
  async function loadMedia() {
    const mediaList = document.getElementById("mediaList");
    const placeholder = document.getElementById("mediaPlaceholder");
    if (!mediaList) {
      console.error('Element with ID "mediaList" not found.');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/media`);
      if (!response.ok) throw new Error("Failed to fetch media");

      const media = await response.json();
      mediaList.innerHTML = ""; // Clear existing content

      if (media.length === 0) {
        mediaList.innerHTML = "<p>No media available.</p>";
        return;
      }

      media.forEach((item) => {
        const div = document.createElement("div");
        div.classList.add("media-item");

        if (item.MediaType === "image") {
          div.innerHTML = `<img src="${item.MediaPath}" alt="${item.MediaTitle}" />`;
        } else if (item.MediaType === "video") {
          div.innerHTML = `<video src="${item.MediaPath}" controls></video>`;
        } else if (item.MediaType === "youtube") {
          div.innerHTML = `
            <div class="youtube-embed">
              ${item.MediaPath} <!-- Assuming MediaPath contains the iframe embed code -->
            </div>
          `;
        }

        // Ensure the correct mediaId is passed to deleteMedia
        div.innerHTML += `<p>${item.MediaTitle}</p>
          <button onclick="deleteMedia(${item.id})">Delete</button>`; // Use item.id instead of item.MediaID
        mediaList.appendChild(div);
      });
    } catch (error) {
      console.error("Error loading media:", error);
      if (mediaList) {
        mediaList.innerHTML = "<p>Failed to load media. Please try again later.</p>";
      }
    }
  }

  // Utility: Show Errors on UI
  function showError(message) {
    const errorContainer = document.getElementById('error-container');
    if (errorContainer) {
        errorContainer.innerHTML = `<p class="error">${message}</p>`;
        setTimeout(() => errorContainer.innerHTML = '', 5000); // Clear error after 5 seconds
    } else {
        alert(message); // Fallback alert
    }
  }

  function validateFormData(formData) {
    const mediaType = formData.get("MediaType");
    const mediaFile = formData.get("mediaFile");
    const youtubeEmbedCode = formData.get("YouTubeURL");

    if (!mediaType) {
      alert("Please select a media type.");
      return false;
    }

    if (mediaType === "youtube") {
      if (!youtubeEmbedCode || !youtubeEmbedCode.trim()) {
        alert("Please provide a valid YouTube embed code.");
        return false;
      }
    } else if ((mediaType === "image" || mediaType === "video") && (!mediaFile || !mediaFile.name)) {
      alert("Please upload a valid media file.");
      return false;
    }

    return true;
  }

  async function submitMedia(formData) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/media`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        alert("Media uploaded successfully!");
        return true;
      } else {
        const errorText = await response.text();
        console.error("Server response:", errorText);
        alert("Failed to upload media.");
        return false;
      }
    } catch (error) {
      console.error("Error uploading media:", error);
      alert("An error occurred while uploading the media.");
      return false;
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);

    // Debugging: Log formData keys and values
    console.log("FormData being sent:");
    for (const [key, value] of formData.entries()) {
      console.log(`${key}: ${value}`);
    }

    // Validate form data
    if (!validateFormData(formData)) {
      return;
    }

    // Prepare form data for YouTube
    const mediaType = formData.get("MediaType");
    if (mediaType === "youtube") {
      const youtubeEmbedCode = formData.get("YouTubeURL")?.trim();
      if (!youtubeEmbedCode) {
        console.error("YouTubeURL is missing or empty.");
        alert("Please provide a valid YouTube embed code.");
        return;
      }
      formData.set("MediaPath", youtubeEmbedCode); // Send YouTube embed code as MediaPath
      formData.delete("YouTubeURL"); // Remove the YouTubeURL field
    }

    // Submit the media
    const success = await submitMedia(formData);
    if (success) {
      e.target.reset();
      loadMedia(); // Reload media without refreshing the page
    }
  }

  const uploadForm = document.getElementById("uploadForm");
  if (uploadForm) {
    uploadForm.addEventListener("submit", handleFormSubmit);
  } else {
    console.error('Upload form with ID "uploadForm" not found.');
  }

  window.deleteMedia = async function (mediaId) {
    console.log("Deleting media with ID:", mediaId); // Debug log
    if (!confirm('Are you sure you want to delete this media?')) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/media/${mediaId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete media: ${errorText}`);
      }

      console.log(`Media ${mediaId} deleted`);
      loadMedia(); // Reload media list after deletion
    } catch (error) {
      console.error('Error deleting media:', error);
      showError('Failed to delete media. Please try again later.');
    }
  };

  // Initial load
  loadMedia();
});

