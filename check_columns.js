const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.NEON_DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
});

async function run() {
    try {
        const client = await pool.connect();
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'team_tasks'
        `);
        console.log('Columns:', res.rows);
        client.release();
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

run();
