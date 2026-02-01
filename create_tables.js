const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.NEON_DB_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
});

async function run() {
    try {
        const client = await pool.connect();
        console.log('Connected.');

        // Create team_training_videos table
        await client.query(`
            CREATE TABLE IF NOT EXISTS team_training_videos (
                id TEXT PRIMARY KEY,
                "memberId" TEXT,
                title TEXT,
                description TEXT,
                url TEXT,
                "createdAt" TIMESTAMPTZ DEFAULT NOW(),
                "updatedAt" TIMESTAMPTZ DEFAULT NOW()
            );
        `);
        console.log('Created team_training_videos table.');

        client.release();
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

run();
