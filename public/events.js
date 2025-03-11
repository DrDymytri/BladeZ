document.addEventListener("DOMContentLoaded", () => {
  loadEvents();
});

async function loadEvents() {
  try {
    const response = await fetch("/api/events");
    if (!response.ok) {
      throw new Error("Failed to fetch events");
    }
    const events = await response.json();
    displayEvents(events);
  } catch (error) {
    console.error("Error loading events:", error);
    displayErrorMessage("Failed to load events. Please try again later.");
  }
}

function displayEvents(events) {
  const eventsContainer = document.getElementById("eventsContainer");
  eventsContainer.innerHTML = events
    .map(
      (event) => `
      <div class="event">
        <h2 class="eventTitle">${event.title}</h2>
        <p><strong>Start Date:</strong> ${new Date(event.event_start_date).toLocaleString()}</p>
        <p><strong>End Date:</strong> ${new Date(event.event_end_date).toLocaleString()}</p>
        <div class="divider"></div>
        <p>${event.description}</p><br>
        <div class="divider"></div>
        <p><strong>Website:</strong> <a href="${event.event_website}" target="_blank">${new URL(event.event_website).hostname}</a></p>
        <p><i class="fas fa-map-marker-alt"></i> <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}" target="_blank">${event.location}</a></p>
      </div>
    `
    )
    .join("");
}

function displayErrorMessage(message) {
  const eventsContainer = document.getElementById("eventsContainer");
  eventsContainer.innerHTML = `<div class="error-message">${message}</div>`;
}
