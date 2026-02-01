const { Pool } = require('pg');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DB_URL;

if (!DATABASE_URL) {
    console.error('No DATABASE_URL found.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('Creating team_updates table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS team_updates (
                id TEXT PRIMARY KEY,
                title TEXT,
                date TEXT,
                description TEXT,
                type TEXT,
                "createdAt" TEXT,
                "updatedAt" TEXT
            );
        `);
        console.log('team_updates table created.');

        console.log('Creating team_notifications table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS team_notifications (
                id TEXT PRIMARY KEY,
                message TEXT,
                "createdAt" TEXT,
                read BOOLEAN DEFAULT false,
                "memberId" TEXT
            );
        `);
        console.log('team_notifications table created.');

        // Seed data if empty
        const updates = await pool.query('SELECT count(*) FROM team_updates');
        if (parseInt(updates.rows[0].count) === 0) {
            console.log('Seeding team_updates...');
            await pool.query(`
                INSERT INTO team_updates (id, title, date, description, type, "createdAt")
                VALUES ('evt_001', 'Team Meeting', '2026-02-05', 'Weekly sync up', 'meeting', '2026-02-01T10:00:00Z')
            `);
        }

        const notifs = await pool.query('SELECT count(*) FROM team_notifications');
        if (parseInt(notifs.rows[0].count) === 0) {
            console.log('Seeding team_notifications...');
            await pool.query(`
                INSERT INTO team_notifications (id, message, "createdAt", read, "memberId")
                VALUES ('notif_001', 'Welcome to the new dashboard!', '2026-02-01T09:00:00Z', false, 'all')
            `);
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

run();
