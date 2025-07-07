document.addEventListener("DOMContentLoaded", async () => {
    const videosContainer = document.getElementById("videos-container");
    try {
        const videos = await apiService.get("/api/videos");
        if (!videos || videos.length === 0) {
            videosContainer.innerHTML = "<p>No videos available at the moment.</p>";
            return;
        }
        videosContainer.innerHTML = videos.map(video => `
            <div class="video-card">
                <video controls poster="${video.thumbnailUrl}">
                    <source src="${video.videoUrl}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
                <p>${video.title}</p>
                <p>${video.description}</p>
            </div>
        `).join("");
    } catch (error) {
        console.error("Error fetching videos:", error);
        videosContainer.innerHTML = "<p>Failed to load videos. Please try again later.</p>";
    }
});
