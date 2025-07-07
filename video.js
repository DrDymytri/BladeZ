// Video player module for BladeZ application

document.addEventListener('DOMContentLoaded', () => {
    // Initialize all video players on the page
    initVideoPlayers();
    
    // Set up event delegation for video modal triggers
    document.body.addEventListener('click', event => {
        if (event.target.classList.contains('video-modal-trigger')) {
            const videoUrl = event.target.dataset.video;
            const videoTitle = event.target.dataset.title || 'Product Video';
            openVideoModal(videoUrl, videoTitle);
        }
    });
    
    // Close modal on escape key
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            const activeModal = document.querySelector('.video-modal.active');
            if (activeModal) {
                closeVideoModal(activeModal);
            }
        }
    });
});

function initVideoPlayers() {
    // Find all video players
    const videoPlayers = document.querySelectorAll('.video-player');
    
    videoPlayers.forEach(player => {
        const videoElement = player.querySelector('video');
        if (!videoElement) return;
        
        // Handle video errors
        videoElement.addEventListener('error', function() {
            handleVideoError(this, player);
        });
        
        // Create custom controls if none exist
        if (!player.querySelector('.video-controls')) {
            createVideoControls(videoElement, player);
        }
        
        // Ensure the video is responsive
        videoElement.style.width = '100%';
        videoElement.style.height = 'auto';
        
        // Use poster image from data attribute if available
        const posterUrl = videoElement.dataset.poster;
        if (posterUrl && !videoElement.hasAttribute('poster')) {
            videoElement.setAttribute('poster', posterUrl);
        }
    });
}

function handleVideoError(videoElement, container) {
    console.error('Video error:', videoElement.error);
    
    // Display error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'video-error';
    errorDiv.innerHTML = `
        <p>Sorry, there was an error loading this video.</p>
        <p>Please try again later or contact support.</p>
    `;
    
    // Clear the container and show error
    container.innerHTML = '';
    container.appendChild(errorDiv);
    
    // Report error to analytics or logging service
    if (window.apiService) {
        apiService.post('/api/log/error', {
            type: 'video_error',
            message: videoElement.error ? videoElement.error.message : 'Unknown video error',
            source: videoElement.src,
            timestamp: new Date().toISOString()
        }).catch(err => console.error('Error logging video failure:', err));
    }
}

function createVideoControls(videoElement, container) {
    const controls = document.createElement('div');
    controls.className = 'video-controls';
    controls.innerHTML = `
        <button class="play-pause-btn" aria-label="Play/Pause">
            <i class="fas fa-play"></i>
        </button>
        <div class="progress-container">
            <div class="progress-bar">
                <div class="progress-indicator"></div>
            </div>
        </div>
        <button class="mute-btn" aria-label="Mute">
            <i class="fas fa-volume-up"></i>
        </button>
        <button class="fullscreen-btn" aria-label="Fullscreen">
            <i class="fas fa-expand"></i>
        </button>
    `;
    
    container.appendChild(controls);
    
    // Set up control functionality
    const playPauseBtn = controls.querySelector('.play-pause-btn');
    const progressBar = controls.querySelector('.progress-bar');
    const progressIndicator = controls.querySelector('.progress-indicator');
    const muteBtn = controls.querySelector('.mute-btn');
    const fullscreenBtn = controls.querySelector('.fullscreen-btn');
    
    // Play/Pause button
    playPauseBtn.addEventListener('click', () => {
        if (videoElement.paused) {
            videoElement.play().catch(err => {
                console.error('Error playing video:', err);
                handleVideoError(videoElement, container);
            });
            playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            videoElement.pause();
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
    });
    
    // Progress bar
    videoElement.addEventListener('timeupdate', () => {
        const progress = (videoElement.currentTime / videoElement.duration) * 100;
        progressIndicator.style.width = `${progress}%`;
    });
    
    progressBar.addEventListener('click', (e) => {
        const rect = progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        videoElement.currentTime = pos * videoElement.duration;
    });
    
    // Mute button
    muteBtn.addEventListener('click', () => {
        videoElement.muted = !videoElement.muted;
        muteBtn.innerHTML = videoElement.muted ? 
            '<i class="fas fa-volume-mute"></i>' : 
            '<i class="fas fa-volume-up"></i>';
    });
    
    // Fullscreen button
    fullscreenBtn.addEventListener('click', () => {
        if (container.requestFullscreen) {
            container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) { /* Safari */
            container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) { /* IE11 */
            container.msRequestFullscreen();
        }
    });
}

function openVideoModal(videoUrl, title) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('video-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'video-modal';
        modal.className = 'video-modal';
        document.body.appendChild(modal);
    }
    
    // Set modal content
    modal.innerHTML = `
        <div class="video-modal-content">
            <div class="video-modal-header">
                <h2>${title}</h2>
                <span class="close-video-modal">&times;</span>
            </div>
            <div class="video-container">
                <video controls src="${videoUrl}" autoplay>
                    Your browser does not support the video tag.
                </video>
            </div>
        </div>
    `;
    
    // Show the modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent scrolling
    
    // Set up close button
    const closeBtn = modal.querySelector('.close-video-modal');
    closeBtn.addEventListener('click', () => closeVideoModal(modal));
    
    // Close when clicking outside content
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeVideoModal(modal);
        }
    });
}

function closeVideoModal(modal) {
    // Stop video playback
    const video = modal.querySelector('video');
    if (video) video.pause();
    
    // Hide modal
    modal.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
    
    // Optional: remove from DOM after animation
    setTimeout(() => {
        if (!modal.classList.contains('active')) {
            modal.remove();
        }
    }, 300);
}
