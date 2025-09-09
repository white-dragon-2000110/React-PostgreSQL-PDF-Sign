const { Pool } = require('pg');

const databasePool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'signature_user',
  password: process.env.DB_PASSWORD || 'yourpassword',
  database: process.env.DB_NAME || 'signature_app',
});

module.exports = {
  query: (text, params) => databasePool.query(text, params),
  pool: databasePool,
};