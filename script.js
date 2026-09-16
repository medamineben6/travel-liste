const form = document.getElementById("place-form");
const placeId = document.getElementById("place-id");
const nameInput = document.getElementById("name");
const descriptionInput = document.getElementById("description");
const mapsInput = document.getElementById("google-maps");
const placesContainer = document.getElementById("places");
const empty = document.getElementById("empty");
const count = document.getElementById("count");
const message = document.getElementById("message");
const status = document.getElementById("status");
const lastSync = document.getElementById("last-sync");
const formTitle = document.getElementById("form-title");
const submitButton = document.getElementById("submit-button");
const cancelEdit = document.getElementById("cancel-edit");

function api(path = "") {
  return `${API_BASE_URL.replace(/\/$/, "")}${path}`;
}

function showMessage(text, type = "") {
  message.textContent = text;
  message.className = `message ${type}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderPlaces(places) {
  placesContainer.innerHTML = "";
  count.textContent = `(${places.length})`;
  empty.classList.toggle("hidden", places.length !== 0);

  for (const place of places) {
    const card = document.createElement("article");
    card.className = "place-card";

    const safeName = escapeHtml(place.name);
    const safeDescription = escapeHtml(place.description);
    const safeMaps = escapeHtml(place.google_maps);

    card.innerHTML = `
      <div class="place-top">
        <div>
          <h3 class="place-name">${safeName}</h3>
          <p class="place-description">${safeDescription || "Aucune description."}</p>
        </div>

        <div class="card-actions">
          <button class="icon-button copy-button" data-id="${place.id}"
            title="Créer une copie" aria-label="Créer une copie">➕</button>
          <button class="icon-button delete-button" data-id="${place.id}"
            title="Supprimer" aria-label="Supprimer">×</button>
        </div>
      </div>

      ${place.google_maps
        ? `<a class="map-link" href="${safeMaps}" target="_blank" rel="noopener noreferrer">Voir sur la carte →</a>`
        : ""}
    `;

    placesContainer.appendChild(card);
  }
}

async function loadPlaces(silent = false) {
  try {
    const response = await fetch(api("/api/places"), { cache: "no-store" });
    if (!response.ok) throw new Error();

    const places = await response.json();
    renderPlaces(places);

    status.textContent = "● Connecté";
    status.style.color = "#397052";
    lastSync.textContent = `Dernière synchro : ${new Date().toLocaleTimeString("fr-FR")}`;

    if (!silent) showMessage("");
  } catch {
    status.textContent = "● Hors connexion";
    status.style.color = "#a33b2e";
    if (!silent) showMessage("Impossible de contacter le serveur.", "error");
  }
}

function prepareCopy(place) {
  placeId.value = "";
  nameInput.value = place.name || "";
  descriptionInput.value = place.description || "";
  mapsInput.value = place.google_maps || "";

  formTitle.textContent = "Créer un nouvel endroit";
  submitButton.textContent = "Créer";
  cancelEdit.classList.remove("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
  nameInput.focus();
}

function resetForm() {
  form.reset();
  placeId.value = "";
  formTitle.textContent = "Créer un nouvel endroit";
  submitButton.textContent = "Créer";
  cancelEdit.classList.add("hidden");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = {
    name: nameInput.value.trim(),
    description: descriptionInput.value.trim(),
    google_maps: mapsInput.value.trim()
  };

  if (!data.name) return;

  submitButton.disabled = true;

  try {
    const response = await fetch(api("/api/places"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "Une erreur est survenue.");
    }

    resetForm();
    showMessage("Lieu ajouté avec succès.", "success");
    await loadPlaces(true);
  } catch (error) {
    showMessage(error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
});

cancelEdit.addEventListener("click", () => {
  resetForm();
  showMessage("");
});

placesContainer.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const id = Number(button.dataset.id);

  if (button.classList.contains("copy-button")) {
    try {
      const response = await fetch(api("/api/places"), { cache: "no-store" });
      if (!response.ok) throw new Error();
      const places = await response.json();
      const place = places.find(item => Number(item.id) === id);
      if (place) prepareCopy(place);
    } catch {
      showMessage("Impossible de récupérer le lieu.", "error");
    }
    return;
  }

  if (button.classList.contains("delete-button")) {
    try {
      const response = await fetch(api(`/api/places/${id}`), {
        method: "DELETE"
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Impossible de supprimer le lieu.");
      }

      showMessage("Lieu supprimé.", "success");
      await loadPlaces(true);
    } catch (error) {
      showMessage(error.message, "error");
    }
  }
});

loadPlaces();
setInterval(() => loadPlaces(true), 5000);
