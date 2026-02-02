const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.NEON_DB_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
    try {
        console.log('START_CHECK');
        console.log('Checking team_rewards columns...');
        const res = await pool.query("SELECT * FROM team_rewards WHERE \"memberId\" = 'tm004'");
        if (res.rows.length > 0) {
            console.log(`Found ${res.rows.length} rewards for tm004:`);
            res.rows.forEach(r => console.log(r));
        } else {
            console.log('No rewards found for tm004');
        }
        console.log('END_CHECK');
    } catch (e) {
        console.error('ERROR:', e);
    } finally {
        pool.end();
    }
}

checkSchema();
