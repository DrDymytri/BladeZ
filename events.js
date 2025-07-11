document.addEventListener("DOMContentLoaded", async () => {
  const eventsContainer = document.getElementById("events-container");
  try {
    const events = await apiService.get("/api/events");
    if (!events || events.length === 0) {
      eventsContainer.innerHTML = "<p>No events available at the moment.</p>";
      return;
    }
    eventsContainer.innerHTML = events
      .map(
        (event) => `
        <div class="event-card">
          <h3>${event.title}</h3>
          <p>${event.description}</p>
          <p><strong>Start:</strong> ${new Date(event.startDate).toLocaleString()}</p>
          <p><strong>End:</strong> ${new Date(event.endDate).toLocaleString()}</p>
          <p><strong>Location:</strong> 
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}" target="_blank">
              ${event.location}
            </a>
          </p>
          ${
            event.event_website
              ? `<p><a href="${event.event_website}" target="_blank">Event Website</a></p>`
              : ""
          }
        </div>
      `
      )
      .join("");
  } catch (error) {
    console.error("Error fetching events:", error);
    eventsContainer.innerHTML = "<p>Failed to load events. Please try again later.</p>";
  }
});

async function loadEvents() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/events`);
    if (!response.ok) throw new Error("Failed to fetch events");

    const events = await response.json();
    const eventsTableBody = document.querySelector("#admin-events-table tbody");
    eventsTableBody.innerHTML = events
      .map(
        (event) => `
          <tr>
              <td>${event.title}</td>
              <td>${new Date(event.event_start_date).toLocaleString()}</td>
              <td>${new Date(event.event_end_date).toLocaleString()}</td>
              <td>${event.location}</td>
              <td>${event.description}</td>
              <td>
                  <button class="update-btn" data-id="${event.id}">Update</button>
                  <button class="delete-btn" data-id="${event.id}">Delete</button>
              </td>
          </tr>
      `
      )
      .join("");

    attachEventListeners();
  } catch (error) {
    console.error("Error loading events:", error);
  }
}

function displayEvents(events) {
  const eventContainer = document.getElementById("eventsContainer");
  eventContainer.innerHTML = events
    .map(
      (event) => `
      <div class="event">
        <h3 class="eventTitle">${event.title}</h3>
        <p>${event.description}</p>
        <p><strong>Start:</strong> ${new Date(event.event_start_date).toLocaleString()}</p>
        <p><strong>End:</strong> ${new Date(event.event_end_date).toLocaleString()}</p>
        <p><strong>Location:</strong> <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}" target="_blank">${event.location}</a></p>
        ${
          event.event_website
            ? `<p><a href="${event.event_website}" target="_blank">Event Website</a></p>`
            : ""
        }
      </div>`
    )
    .join("");
}

function attachEventListeners() {
  document.querySelectorAll(".update-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const eventId = event.target.dataset.id;
      editEvent(eventId);
    });
  });
}

function displayErrorMessage(message) {
  const eventContainer = document.getElementById("eventsContainer");
  eventContainer.innerHTML = `<div class="error-message">${message}</div>`;
}
