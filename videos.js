document.addEventListener("DOMContentLoaded", async () => {
  const videosContainer = document.getElementById("videos-container");

  try {
    const response = await fetch("https://<your-backend-url>/api/videos");
    if (!response.ok) throw new Error("Failed to fetch videos");

    const videos = await response.json();
    videosContainer.innerHTML = videos
      .map(
        (video) => `
        <div class="video-card">
          <video controls>
            <source src="${video.url}" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <h3>${video.title}</h3>
          <p>${video.description}</p>
        </div>
      `
      )
      .join("");
  } catch (error) {
    console.error("Error loading videos:", error.message);
    videosContainer.innerHTML = "<p>Error loading videos. Please try again later.</p>";
  }
});
