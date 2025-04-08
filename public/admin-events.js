document.addEventListener("DOMContentLoaded", () => {
  // Initialize Flatpickr for date and time selection
  flatpickr("#eventStartDate", {
    enableTime: true,
    dateFormat: "Y-m-d H:i",
  });

  flatpickr("#eventEndDate", {
    enableTime: true,
    dateFormat: "Y-m-d H:i",
  });

  loadEvents();

  const eventForm = document.getElementById("eventForm");
  const addEventBtn = document.getElementById("addEventBtn");
  const updateEventBtn = document.getElementById("updateEventBtn");

  eventForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const eventId = document.getElementById("eventId")?.value || null;
    const newEvent = {
      title: document.getElementById("eventTitle").value.trim(),
      description: document.getElementById("eventDescription").value.trim(),
      event_start_date: document.getElementById("eventStartDate").value.trim(),
      event_end_date: document.getElementById("eventEndDate").value.trim(),
      location: document.getElementById("eventLocation").value.trim(),
      website: document.getElementById("eventWebsite").value.trim(),
    };

    if (!newEvent.title || !newEvent.description || !newEvent.event_start_date || !newEvent.event_end_date || !newEvent.location || !newEvent.website) {
      alert("All fields are required. Please fill in all fields.");
      return;
    }

    console.log("Submitting event data:", newEvent); // Debugging log

    try {
      const url = eventId
        ? `http://localhost:5000/api/events/${eventId}` // Corrected endpoint
        : "http://localhost:5000/api/events"; // Corrected endpoint
      const method = eventId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEvent),
      });

      console.log("Server response status:", response.status); // Debugging log
      console.log("Server response text:", await response.text()); // Debugging log

      if (response.ok) {
        alert(eventId ? "Event updated successfully!" : "Event added successfully!");
        eventForm.reset();
        resetForm();
        loadEvents();
      } else {
        alert("Failed to save event. Please check your input.");
      }
    } catch (error) {
      console.error("Error saving event:", error);
      alert("An error occurred while saving the event. Please try again later.");
    }
  });

  updateEventBtn.addEventListener("click", () => {
    resetForm();
  });
});

async function loadEvents() {
  try {
    const response = await fetch("http://localhost:5000/api/events");
    if (!response.ok) throw new Error("Failed to fetch events");

    const events = await response.json();
    const eventsContainer = document.getElementById("eventsContainer");

    if (!eventsContainer) {
      console.error('Element with ID "eventsContainer" not found.');
      return;
    }

    eventsContainer.innerHTML = events
      .map((event) => {
        const startDate = formatLocalDate(event.startDate);
        const endDate = formatLocalDate(event.endDate);

        return `
          <div class="event-card" data-id="${event.id}">
            <h3 contenteditable="false" class="editable event-title">${event.title}</h3>
            <p><strong>Start:</strong> <input type="text" class="editable event-start" value="${startDate}" readonly></p>
            <p><strong>End:</strong> <input type="text" class="editable event-end" value="${endDate}" readonly></p>
            <p><strong>Location:</strong> 
              <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}" 
                 target="_blank" 
                 class="event-location-link">
                ${event.location}
              </a>
            </p>
            <p><strong>Website:</strong> 
              <a href="${event.event_website || "#"}" class="editable event-website" target="_blank">
                ${event.event_website || "No Website"}
              </a>
            </p>
            <p contenteditable="false" class="editable event-description">${event.description}</p>
            <div class="event-actions">
              <button class="edit-btn">Edit</button>
              <button class="save-btn" style="display: none;">Save</button>
              <button class="cancel-btn" style="display: none;">Cancel</button>
              <button class="delete-btn">Delete</button>
            </div>
          </div>`;
      })
      .join("");

    attachEventListeners();
  } catch (error) {
    console.error("Error loading events:", error);
    const eventsContainer = document.getElementById("eventsContainer");
    if (eventsContainer) {
      eventsContainer.innerHTML = "<p>Failed to load events. Please try again later.</p>";
    }
  }
}

function formatLocalDate(dateString) {
  if (!dateString) return "Invalid Date";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date format: ${dateString}`);
    return "Invalid Date";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function attachEventListeners() {
  document.querySelectorAll(".edit-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const eventCard = event.target.closest(".event-card");
      toggleEditMode(eventCard, true);
      initializeDatePickers(eventCard);
    });
  });

  document.querySelectorAll(".save-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const eventCard = event.target.closest(".event-card");
      const eventId = eventCard.dataset.id;
      await saveEvent(eventCard, eventId);
    });
  });

  document.querySelectorAll(".cancel-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      const eventCard = event.target.closest(".event-card");
      toggleEditMode(eventCard, false);
      loadEvents();
    });
  });

  document.querySelectorAll(".delete-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      const eventCard = event.target.closest(".event-card");
      const eventId = eventCard.dataset.id;
      await deleteEvent(eventId);
    });
  });
}

function toggleEditMode(eventCard, isEditing) {
  const editableFields = eventCard.querySelectorAll(".editable");
  editableFields.forEach((field) => {
    if (field.tagName === "INPUT" || field.tagName === "A") {
      field.readOnly = !isEditing;
      field.style.border = isEditing ? "1px solid #ccc" : "none";
      field.style.backgroundColor = isEditing ? "#f9f9f9" : "transparent";
    } else {
      field.contentEditable = isEditing;
      field.style.border = isEditing ? "1px solid #ccc" : "none";
      field.style.backgroundColor = isEditing ? "#f9f9f9" : "transparent";
    }
  });

  eventCard.querySelector(".edit-btn").style.display = isEditing ? "none" : "inline-block";
  eventCard.querySelector(".save-btn").style.display = isEditing ? "inline-block" : "none";
  eventCard.querySelector(".cancel-btn").style.display = isEditing ? "inline-block" : "none";
}

function initializeDatePickers(eventCard) {
  const startInput = eventCard.querySelector(".event-start");
  const endInput = eventCard.querySelector(".event-end");

  flatpickr(startInput, {
    enableTime: true,
    dateFormat: "Y-m-d H:i",
    defaultDate: startInput.value || null,
  });

  flatpickr(endInput, {
    enableTime: true,
    dateFormat: "Y-m-d H:i",
    defaultDate: endInput.value || null,
  });
}

async function saveEvent(eventCard, eventId) {
  const updatedEvent = {
    title: eventCard.querySelector(".event-title").textContent.trim(),
    description: eventCard.querySelector(".event-description").textContent.trim(),
    event_start_date: eventCard.querySelector(".event-start").value.trim(),
    event_end_date: eventCard.querySelector(".event-end").value.trim(),
    location: eventCard.querySelector(".event-location-link").textContent.trim(),
    website: eventCard.querySelector(".event-website").textContent.trim(),
  };

  console.log("Updating event with ID:", eventId); // Debugging log
  console.log("Event data being sent:", updatedEvent); // Debugging log

  if (!updatedEvent.title || !updatedEvent.description || !updatedEvent.event_start_date || !updatedEvent.event_end_date || !updatedEvent.location || !updatedEvent.website) {
    alert("All fields are required. Please fill in all fields.");
    return;
  }

  try {
    const response = await fetch(`http://localhost:5000/api/events/${eventId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedEvent),
    });

    if (response.ok) {
      alert("Event updated successfully!");
      toggleEditMode(eventCard, false);
      loadEvents();
    } else {
      const errorText = await response.text();
      console.error("Failed to update event:", errorText);
      alert(`Failed to update event. Server response: ${errorText}`);
    }
  } catch (error) {
    console.error("Error updating event:", error);
    alert("An error occurred while updating the event. Please try again later.");
  }
}

async function deleteEvent(eventId) {
  console.log("Deleting event with ID:", eventId); // Debugging log

  if (!confirm("Are you sure you want to delete this event?")) return;

  try {
    const response = await fetch(`http://localhost:5000/api/events/${eventId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete event: ${errorText}`);
    }

    alert("Event deleted successfully!");
    loadEvents();
  } catch (error) {
    console.error("Error deleting event:", error);
    alert(`Failed to delete event: ${error.message}`);
  }
}

function resetForm() {
  document.getElementById("eventForm").reset();
  document.getElementById("addEventBtn").style.display = "block";
  document.getElementById("updateEventBtn").style.display = "none";
}

function validateDate(dateString) {
  const dateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
  return dateRegex.test(dateString);
}
