document.addEventListener("DOMContentLoaded", async () => {
    const videosContainer = document.getElementById("videos-container");
    try {
        if (!window.apiService) {
            console.error("apiService is not defined. Ensure config.js is loaded before this script.");
            videosContainer.innerHTML = "<p>Failed to load videos. Please try again later.</p>";
            return;
        }

        const videos = await apiService.get("/api/videos");
        if (!videos || videos.length === 0) {
            videosContainer.innerHTML = "<p>No videos available at the moment.</p>";
            return;
        }

        videosContainer.innerHTML = videos
            .map(
                (video) => `
        <div class="video-card">
          <video controls src="${video.videoUrl}" poster="${video.thumbnailUrl || '/images/Default1.png'}">
            Your browser does not support the video tag.
          </video>
          <p>${video.title}</p>
          <p>${video.description}</p>
        </div>
      `
            )
            .join("");
    } catch (error) {
        console.error("Error fetching videos:", error.message);
        videosContainer.innerHTML = "<p>Failed to load videos. Please try again later.</p>";
    }
});
