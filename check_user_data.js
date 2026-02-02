const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.NEON_DB_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkUserData(memberId) {
    console.error(`DEBUG: Start checking data for member: ${memberId}`);
    try {
        // Check Tasks
        console.error('DEBUG: Querying tasks...');
        const tasksRes = await pool.query('SELECT * FROM team_tasks WHERE "memberId" = $1 OR "memberId" = \'all\'', [memberId]);
        console.log(`Tasks found (${tasksRes.rowCount}):`);
        if (tasksRes.rowCount > 0) {
            console.log(tasksRes.rows.map(t => `${t.id}: ${t.title} (${t.status})`).join('\n'));
        } else {
            console.log('No tasks found.');
        }

        // Check Rewards
        const rewardsRes = await pool.query('SELECT * FROM team_rewards WHERE "memberId" = $1', [memberId]);
        console.log(`\nRewards found (${rewardsRes.rowCount}):`);
        if (rewardsRes.rowCount > 0) {
            console.log(rewardsRes.rows.map(r => {
                // Detailed debug of the row
                // console.log('Row debug:', JSON.stringify(r));
                return `${r.id}: ${r.reason || r.title || 'NO_TITLE_OR_REASON'} (${r.amount})`;
            }).join('\n'));
        } else {
            console.log('No rewards found.');
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

checkUserData('tm001');
