
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.NEON_DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000 // 5s timeout
});

console.log('DB Config:', {
    connectionString: (process.env.DATABASE_URL || '').replace(/:[^:@]+@/, ':***@'), // Mask password
    ssl: true
});

async function run() {
    console.log('Attempting to connect...');
    try {
        const client = await pool.connect();
        console.log('Connected to DB successfully!');
        const res = await client.query('SELECT NOW()');
        console.log('Query success, current time:', res.rows[0]);
        client.release();
    } catch (e) {
        console.error('Connection/Query error:', e);
    } finally {
        await pool.end();
        console.log('Pool ended.');
    }
}

run();
