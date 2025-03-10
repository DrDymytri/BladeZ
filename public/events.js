document.addEventListener("DOMContentLoaded", () => {
  loadEvents();
});

async function loadEvents() {
  try {
    const response = await fetch("/api/events");
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const events = await response.json();
    const eventsContainer = document.getElementById("eventsContainer");
    eventsContainer.innerHTML = events
      .map(
        (event) => `
      <div class="event">
        <h2>${event.title}</h2>
        <p>${new Date(event.event_start_date).toLocaleString()} - ${new Date(
          event.event_end_date
        ).toLocaleString()}</p>
        <p>${event.location}</p>
        <p>${event.description}</p>
        <a href="${event.event_website}" target="_blank">Event Website</a>
      </div>
    `
      )
      .join("");
  } catch (error) {
    console.error("Error loading events:", error);
  }
}
