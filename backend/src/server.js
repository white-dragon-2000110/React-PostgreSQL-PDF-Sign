const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const db = require('./db');

const app = express();

app.use(cors());
app.use(express.json());

// health check
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// db health
app.get('/health/db', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ db: 'ok' });
  } catch (e) {
    res.status(500).json({ db: 'error', message: e?.message || 'unknown' });
  }
});

// root route
app.get('/', (_req, res) => {
  res.send('Signature backend is running');
});

const uploadsDirectory = process.env.UPLOAD_DIR
  ? path.isAbsolute(process.env.UPLOAD_DIR)
    ? process.env.UPLOAD_DIR
    : path.join(__dirname, '..', process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(uploadsDirectory)) {
  fs.mkdirSync(uploadsDirectory, { recursive: true });
}

const frontendPublicUploads = path.join(__dirname, '..', '..', 'frontend', 'public', 'uploads');
if (fs.existsSync(frontendPublicUploads)) {
  app.use('/uploads', express.static(frontendPublicUploads));
}
app.use('/uploads', express.static(uploadsDirectory));

const documentsRouter = require('./routes/documents');
app.use('/api/docs', documentsRouter);

async function ensureSchema() {
  // Create table
  await db.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL,
      path TEXT NOT NULL,
      mimetype TEXT,
      size_bytes BIGINT,
      signed_path TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Updated_at trigger function
  await db.query(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Trigger on documents
  await db.query(`
    DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
    CREATE TRIGGER trg_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
  `);
}

const port = Number(process.env.PORT || 3000);

(async () => {
  try {
    await ensureSchema();
  } catch (error) {
    console.warn('Failed to ensure database schema. Continuing without DB. Error:', error?.message || error);
  }

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`Uploads dir: ${uploadsDirectory}`);
    console.log(`SIGN_COMMAND_TEMPLATE: ${process.env.SIGN_COMMAND_TEMPLATE || 'default libresign'}`);
  });
})();