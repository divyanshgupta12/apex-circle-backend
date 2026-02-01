const { Client } = require('pg');
const readline = require('readline');
require('dotenv').config();

// Helper to ask for input
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}

async function run() {
    let connectionString = process.env.DATABASE_URL || process.env.NEON_DB_URL;

    // Ask for connection string if missing
    if (!connectionString) {
        console.log('\nTo add a test task, we need to connect to the database.');
        connectionString = await askQuestion('Please paste your Connection String (postgres://...): ');
        connectionString = connectionString.trim();
    }

    if (!connectionString) {
        console.error('No connection string provided. Exiting.');
        return;
    }

    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected!');

        const taskId = 'task_' + Date.now();
        const today = new Date().toISOString().split('T')[0];

        // Create a task for 'tm001' (Team Leader)
        const query = `
            INSERT INTO team_tasks (id, title, "memberId", "eventName", description, "dueDate", status, "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;

        const values = [
            taskId,
            'Test Task - Database Verification',
            'tm001', 
            'System Check',
            'If you see this, the database is working!',
            today,
            'pending',
            new Date().toISOString(),
            new Date().toISOString()
        ];

        const res = await client.query(query, values);
        console.log('Success! Task added:', res.rows[0].title);
        console.log('Go to your Team Portal and click REFRESH.');

        await client.end();
    } catch (e) {
        console.error('Error:', e.message);
    }
}

run();
