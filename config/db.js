const { Pool } = require('pg');
require('dotenv').config();

// Force IPv4 — Render's network can't reach Supabase via IPv6
try { require('dns').setDefaultResultOrder('ipv4first'); } catch (_) {}

const createDbConfig = () => {
  if (process.env.DATABASE_URL) {
    try {
      const dbUrl = new URL(process.env.DATABASE_URL);
      return {
        host: dbUrl.hostname,
        port: dbUrl.port || 5432,
        user: dbUrl.username,
        password: dbUrl.password,
        database: dbUrl.pathname?.slice(1),
        ssl: { rejectUnauthorized: false },
        family: 4,
      };
    } catch (err) {
      console.error('❌ Invalid DATABASE_URL:', err.message);
    }
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ? String(process.env.DB_PASSWORD) : undefined,
    database: process.env.DB_NAME,

    // Local Postgres (non-Supabase) SSL support nahi hoti; iss liye SSL ko optional rakha
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    family: 4,
  };
};
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect()
  .then(() => console.log('✅ Supabase PostgreSQL Connected!'))
  .catch(err => console.error('❌ DB Connection Error:', err));

module.exports = pool;
