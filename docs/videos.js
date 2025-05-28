document.addEventListener("DOMContentLoaded", () => {
  const videosContainer = document.getElementById("videos-container");

  if (!videosContainer) {
    console.error("Error: Element with ID 'videos-container' not found in the DOM.");
    return;
  }

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

      videosContainer.innerHTML = videos
        .map((video) => {
          if (video.type.toLowerCase() === "youtube") {
            // Render YouTube video using the embedded iframe code directly
            return `
              <div class="video-card">
                ${video.path} <!-- Embedded iframe code -->
                <p>${video.title}</p>
              </div>
            `;
          } else if (video.type.toLowerCase() === "video") {
            // Render locally uploaded video
            return `
              <div class="video-card">
                <video controls>
                  <source src="${video.path}" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                <p>${video.title}</p>
              </div>
            `;
          } else {
            console.warn("Unknown video type:", video.type);
            return "";
          }
        })
        .join("");
    })
    .catch((error) => {
      console.error("Error fetching videos:", error);
      videosContainer.innerHTML = "<p>Failed to load videos. Please try again later.</p>";
    });
});
