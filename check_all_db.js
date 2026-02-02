const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.NEON_DB_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkAllData() {
    try {
        const client = await pool.connect();
        
        const tasksRes = await client.query('SELECT count(*) FROM team_tasks');
        console.log(`Total Tasks in DB: ${tasksRes.rows[0].count}`);

        const rewardsRes = await client.query('SELECT count(*) FROM team_rewards');
        console.log(`Total Rewards in DB: ${rewardsRes.rows[0].count}`);
        
        if (tasksRes.rows[0].count > 0) {
             const sample = await client.query('SELECT * FROM team_tasks LIMIT 3');
             console.log('Sample Tasks:', sample.rows);
        }

        client.release();
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

checkAllData();
