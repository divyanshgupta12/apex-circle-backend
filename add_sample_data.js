const { Pool } = require('pg');
require('dotenv').config();
const { teamMembers } = require('./js/data');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.NEON_DB_URL,
    ssl: { rejectUnauthorized: false }
});

async function addSampleData() {
    console.log('Starting full database population...');
    const client = await pool.connect();

    try {
        for (const member of teamMembers) {
            console.log(`Processing member: ${member.name} (${member.id})`);

            // 1. Create Sample Tasks
            const tasks = [
                {
                    id: `task_${member.id}_1`,
                    title: `Welcome ${member.position}`,
                    memberId: member.id,
                    eventName: 'Onboarding',
                    description: `Welcome to the team! Please review the ${member.position} guidelines.`,
                    dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0], // +7 days
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                },
                {
                    id: `task_${member.id}_2`,
                    title: 'System Setup Check',
                    memberId: member.id,
                    eventName: 'IT Setup',
                    description: 'Confirm you can access the dashboard and see this task.',
                    dueDate: new Date().toISOString().split('T')[0],
                    status: 'completed',
                    createdAt: new Date(Date.now() - 86400000).toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ];

            for (const task of tasks) {
                await client.query(`
                    INSERT INTO team_tasks (id, title, "memberId", "eventName", description, "dueDate", status, "createdAt", "updatedAt")
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    ON CONFLICT (id) DO NOTHING
                `, [task.id, task.title, task.memberId, task.eventName, task.description, task.dueDate, task.status, task.createdAt, task.updatedAt]);
            }

            // 2. Create Sample Reward
            const reward = {
                id: `rew_${member.id}_1`,
                memberId: member.id,
                amount: 100,
                reason: 'Welcome Bonus: Account activation successful.',
                createdAt: new Date().toISOString()
            };

            await client.query(`
                INSERT INTO team_rewards (id, "memberId", amount, reason, "createdAt")
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO NOTHING
            `, [reward.id, reward.memberId, reward.amount, reward.reason, reward.createdAt]);
            
            console.log(`  -> Added sample data for ${member.name}`);
        }

        console.log('-----------------------------------');
        console.log('SUCCESS: All team members now have data in the primary database.');
        console.log('Please ensure your Netlify DATABASE_URL matches your local .env file.');
        
    } catch (e) {
        console.error('Error populating data:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

addSampleData();
