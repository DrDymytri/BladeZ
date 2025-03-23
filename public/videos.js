document.addEventListener("DOMContentLoaded", () => {
  const videosContainer = document.getElementById("videoGallery");

  // Fetch videos from the server
  fetch("http://localhost:5000/api/videos")
    .then((response) => {
      if (!response.ok) {
        console.error(`Error: Received status ${response.status}`);
        throw new Error("Failed to fetch videos");
      }
      return response.json();
    })
    .then((videos) => {
      if (!videos || videos.length === 0) {
        console.warn("No videos found in the response.");
        videosContainer.innerHTML = "<p>No videos available at the moment.</p>";
        return;
      }

      videos.forEach((video) => {
        if (!video.video_url || !video.title || !video.type) {
          console.warn("Invalid video data:", video);
          return;
        }

        // Create video card
        const videoCard = document.createElement("div");
        videoCard.classList.add("video-card");

        if (video.type === "youtube") {
          // Use the iframe code directly from the database
          videoCard.innerHTML = `
            ${video.video_url}
            <p>${video.title}</p>
          `;
        } else if (video.type === "video") {
          // Locally uploaded video
          videoCard.innerHTML = `
            <video controls class="gallery-video">
              <source src="${video.video_url}" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <p>${video.title}</p>
          `;
        }

        // Append card to container
        videosContainer.appendChild(videoCard);
      });
    })
    .catch((error) => {
      console.error("Error fetching videos:", error);
      videosContainer.innerHTML = "<p>Failed to load videos. Please try again later.</p>";
    });
});
