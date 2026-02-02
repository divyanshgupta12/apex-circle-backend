const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.NEON_DB_URL,
    ssl: { rejectUnauthorized: false }
});

const MEMBER_ID = 'tm004'; // Aman Yadav

const SAMPLE_TASKS = [
    {
        id: `task_${Date.now()}_1`,
        title: 'Social Media Strategy Review',
        memberId: MEMBER_ID,
        eventName: 'Weekly Review',
        description: 'Review the performance of recent Instagram and LinkedIn posts.',
        dueDate: new Date().toISOString().split('T')[0], // Today
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    },
    {
        id: `task_${Date.now()}_2`,
        title: 'Post Event Photos',
        memberId: MEMBER_ID,
        eventName: 'Corporate Gala',
        description: 'Upload high-quality photos from the gala to the drive.',
        dueDate: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday
        status: 'completed',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date().toISOString()
    }
];

const SAMPLE_REWARD = {
    id: `rew_${Date.now()}`,
    memberId: MEMBER_ID,
    amount: 500,
    reason: 'Content Creator Bonus: Bonus for high engagement on the last campaign.',
    createdAt: new Date().toISOString()
};

async function addSampleData() {
    console.log(`Adding sample data for ${MEMBER_ID}...`);
    try {
        const client = await pool.connect();

        // Insert Tasks
        for (const task of SAMPLE_TASKS) {
            await client.query(`
                INSERT INTO team_tasks (id, title, "memberId", "eventName", description, "dueDate", status, "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (id) DO NOTHING
            `, [task.id, task.title, task.memberId, task.eventName, task.description, task.dueDate, task.status, task.createdAt, task.updatedAt]);
            console.log(`Added Task: ${task.title}`);
        }

        // Insert Reward
        await client.query(`
            INSERT INTO team_rewards (id, "memberId", amount, reason, "createdAt")
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO NOTHING
        `, [SAMPLE_REWARD.id, SAMPLE_REWARD.memberId, SAMPLE_REWARD.amount, SAMPLE_REWARD.reason, SAMPLE_REWARD.createdAt]);
        console.log(`Added Reward: ${SAMPLE_REWARD.reason}`);

        client.release();
        console.log('Sample data added successfully!');
    } catch (e) {
        console.error('Error adding data:', e);
    } finally {
        await pool.end();
    }
}

addSampleData();
