require('dotenv').config();
const { Pool } = require('pg');

console.log('DATABASE_URL:', process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect()
  .then(() => {
    console.log('Connected to Supabase!');
    process.exit(0);
  })
  .catch(err => {
    console.log('Error:', err.message);
    process.exit(1);
  });
