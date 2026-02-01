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
        console.log('Connected to DB.');

        // Clear existing data (optional, but good for clean state if requested, or just append)
        // Let's just append for now to avoid losing important data if any.
        // Actually, for "tasks not showing", having fresh data is good.
        
        // 1. Team Training Videos
        const videos = [
            { id: 'vid001', memberId: 'all', title: 'Onboarding Basics', description: 'Introduction to Apex Circle values.', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
            { id: 'vid002', memberId: 'tm001', title: 'Leadership Training', description: 'Advanced leadership skills.', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }
        ];

        for (const v of videos) {
            await client.query(`
                INSERT INTO team_training_videos (id, "memberId", title, description, url)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO NOTHING
            `, [v.id, v.memberId, v.title, v.description, v.url]);
        }
        console.log('Seeded Videos.');

        // 2. Team Rewards
        const rewards = [
            { id: 'rew001', memberId: 'tm001', amount: 100, reason: 'Excellent leadership', createdAt: new Date().toISOString() },
            { id: 'rew002', memberId: 'tm002', amount: 50, reason: 'Great support', createdAt: new Date().toISOString() },
            { id: 'rew003', memberId: 'tm001', amount: 200, reason: 'Event success', createdAt: new Date().toISOString() }
        ];

        for (const r of rewards) {
            await client.query(`
                INSERT INTO team_rewards (id, "memberId", amount, reason, "createdAt")
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO NOTHING
            `, [r.id, r.memberId, r.amount, r.reason, r.createdAt]);
        }
        console.log('Seeded Rewards.');

        // 3. Team Tasks
        const tasks = [
            { id: 'tsk001', memberId: 'tm001', title: 'Review budget', description: 'Check Q1 budget.', dueDate: '2026-02-01', status: 'pending' },
            { id: 'tsk002', memberId: 'tm001', title: 'Team meeting', description: 'Weekly sync.', dueDate: '2026-01-30', status: 'completed' },
            { id: 'tsk003', memberId: 'tm002', title: 'Update guest list', description: 'Finalize RSVP.', dueDate: '2026-02-05', status: 'in_progress' }
        ];

        for (const t of tasks) {
            await client.query(`
                INSERT INTO team_tasks (id, "memberId", title, description, "dueDate", status)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO NOTHING
            `, [t.id, t.memberId, t.title, t.description, t.dueDate, t.status]);
        }
        console.log('Seeded Tasks.');

        // 4. Scheduled Tasks
        // Columns: title, description, memberId, eventName, recurrence, startTime, endTime, typeOfWork, rewardAmount
        const scheduled = [
            { id: 'sch001', memberId: 'tm001', title: 'Morning Briefing', startTime: '2026-02-01T09:00:00.000Z', endTime: '2026-02-01T10:00:00.000Z', status: 'pending' },
            { id: 'sch002', memberId: 'all', title: 'General Assembly', startTime: '2026-02-01T10:00:00.000Z', endTime: '2026-02-01T11:00:00.000Z', status: 'pending' }
        ];

        for (const s of scheduled) {
            // Note: status is not in the columns list for scheduled tasks?
            // Columns list: rewardAmount, description, memberId, eventName, recurrence, startTime, id, typeOfWork, createdAt, lastGenerated, updatedAt, dailyVariations, endTime, title
            // No 'status' column in scheduled tasks table?
            // Let's omit status or check if it's needed. Usually scheduled tasks are templates.
            // But the user dashboard displays them.
            // Maybe they are generated into team_tasks?
            // But dashboard fetches /scheduled_tasks directly.
            // Let's insert without status for now.
            
            await client.query(`
                INSERT INTO team_scheduled_tasks (id, "memberId", title, "startTime", "endTime")
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (id) DO NOTHING
            `, [s.id, s.memberId, s.title, s.startTime, s.endTime]);
        }
        console.log('Seeded Scheduled Tasks.');

        client.release();
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}

run();
