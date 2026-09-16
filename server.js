import express from "express";
import cors from "cors";
import { createClient } from "@libsql/client";

const app = express();
const PORT = process.env.PORT || 3000;

const db = createClient(
  process.env.TURSO_DATABASE_URL
    ? {
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
      }
    : {
        url: "file:travel.db"
      }
);

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "100kb" }));

async function initDatabase() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      google_maps TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function cleanText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function validMapsUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (
      url.hostname.includes("google.com") ||
      url.hostname.includes("maps.app.goo.gl") ||
      url.hostname.includes("goo.gl")
    );
  } catch {
    return false;
  }
}

app.get("/api/health", async (_req, res) => {
  try {
    await db.execute("SELECT 1");
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.get("/api/places", async (_req, res) => {
  try {
    const result = await db.execute(`
      SELECT id, name, description, google_maps, created_at, updated_at
      FROM places
      ORDER BY id DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Impossible de charger les lieux." });
  }
});

app.post("/api/places", async (req, res) => {
  try {
    const name = cleanText(req.body.name, 120);
    const description = cleanText(req.body.description, 500);
    const googleMaps = cleanText(req.body.google_maps, 500);

    if (!name) {
      return res.status(400).json({ error: "Le nom du lieu est obligatoire." });
    }

    if (!validMapsUrl(googleMaps)) {
      return res.status(400).json({ error: "Le lien Google Maps doit être une URL HTTPS valide." });
    }

    const result = await db.execute({
      sql: `
        INSERT INTO places (name, description, google_maps)
        VALUES (?, ?, ?)
      `,
      args: [name, description, googleMaps]
    });

    const created = await db.execute({
      sql: "SELECT id, name, description, google_maps, created_at, updated_at FROM places WHERE id = ?",
      args: [result.lastInsertRowid]
    });

    res.status(201).json(created.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Impossible d'ajouter le lieu." });
  }
});

app.put("/api/places/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Identifiant invalide." });
    }

    const name = cleanText(req.body.name, 120);
    const description = cleanText(req.body.description, 500);
    const googleMaps = cleanText(req.body.google_maps, 500);

    if (!name) {
      return res.status(400).json({ error: "Le nom du lieu est obligatoire." });
    }

    if (!validMapsUrl(googleMaps)) {
      return res.status(400).json({ error: "Le lien Google Maps doit être une URL HTTPS valide." });
    }

    const result = await db.execute({
      sql: `
        UPDATE places
        SET name = ?, description = ?, google_maps = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [name, description, googleMaps, id]
    });

    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: "Lieu introuvable." });
    }

    const updated = await db.execute({
      sql: "SELECT id, name, description, google_maps, created_at, updated_at FROM places WHERE id = ?",
      args: [id]
    });

    res.json(updated.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Impossible de modifier le lieu." });
  }
});

app.delete("/api/places/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Identifiant invalide." });
    }

    const result = await db.execute({
      sql: "DELETE FROM places WHERE id = ?",
      args: [id]
    });

    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: "Lieu introuvable." });
    }

    res.status(204).end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Impossible de supprimer le lieu." });
  }
});

initDatabase()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`API démarrée sur le port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Erreur d'initialisation de la base :", error);
    process.exit(1);
  });
