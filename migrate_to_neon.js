const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Client } = require('pg');

// Configuration
let DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DB_URL || '';

const FILES = {
    tasks: 'team_tasks.json',
    schedule: 'team_scheduled_tasks.json',
    rewards: 'team_rewards.json'
};

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

async function migrate() {
    console.log('Starting Migration to Neon (via Postgres Connection)...');

    // 1. Get Connection String
    let isValid = false;
    
    // Check existing env var
    if (DATABASE_URL) {
        if (!DATABASE_URL.startsWith('postgres://') && !DATABASE_URL.startsWith('postgresql://')) {
            console.log(`Warning: Environment variable DATABASE_URL seems invalid (starts with "${DATABASE_URL.substring(0, 10)}..."). Ignoring.`);
            DATABASE_URL = '';
        } else {
            console.log('Using Connection String from environment variable.');
            isValid = true;
        }
    }

    while (!isValid) {
        if (!DATABASE_URL) {
            console.log('\nWe need your Neon Connection String.');
            console.log('It looks like: postgres://neondb_owner:password@ep-xyz.aws.neon.tech/neondb?sslmode=require');
            DATABASE_URL = await askQuestion('Please enter your Connection String: ');
            DATABASE_URL = DATABASE_URL.trim();
        }

        if (!DATABASE_URL) {
            console.error('Connection String is required to proceed.');
            continue;
        }

        if (!DATABASE_URL.startsWith('postgres://') && !DATABASE_URL.startsWith('postgresql://')) {
            console.error('Error: Connection String must start with "postgres://" or "postgresql://".');
            console.log(`You entered: "${DATABASE_URL}"`);
            DATABASE_URL = ''; // Reset to ask again
            continue;
        }

        isValid = true;
    }

    console.log(`Connecting to: ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')} ...`);

    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Required for Neon
    });

    try {
        await client.connect();
        console.log('Connected to Neon successfully!');

        // 1.5. Reset Schema (To ensure columns match)
        console.log('Resetting Database Schema...');
        const schemaPath = path.join(__dirname, 'db_schema.sql');
        if (fs.existsSync(schemaPath)) {
            // Drop existing tables to ensure clean state
            await client.query('DROP TABLE IF EXISTS team_tasks, team_scheduled_tasks, team_rewards CASCADE');
            
            // Read and execute schema
            const schemaSql = fs.readFileSync(schemaPath, 'utf8');
            await client.query(schemaSql);
            console.log('Schema applied successfully.');
        } else {
            console.warn('Warning: db_schema.sql not found. Assuming tables exist.');
        }

        // 2. Migrate Tasks
        if (fs.existsSync(FILES.tasks)) {
            const tasks = JSON.parse(fs.readFileSync(FILES.tasks, 'utf8') || '[]');
            console.log(`Found ${tasks.length} tasks.`);
            
            for (const task of tasks) {
                // Upsert task
                const query = `
                    INSERT INTO team_tasks (id, title, "memberId", "eventName", description, "dueDate", status, "createdAt", "updatedAt", "originScheduleId", "autoExtend", "endTime", "rewardAmount", "memberPhone", "extensionCount")
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                    ON CONFLICT (id) DO UPDATE SET
                        status = EXCLUDED.status,
                        "updatedAt" = EXCLUDED."updatedAt"
                `;
                const values = [
                    task.id, task.title, task.memberId, task.eventName, task.description, task.dueDate, task.status, task.createdAt, task.updatedAt, task.originScheduleId, task.autoExtend, task.endTime, task.rewardAmount, task.memberPhone, task.extensionCount
                ];
                await client.query(query, values);
            }
            console.log('Tasks migrated.');
        }

        // 3. Migrate Schedule
        if (fs.existsSync(FILES.schedule)) {
            const schedules = JSON.parse(fs.readFileSync(FILES.schedule, 'utf8') || '[]');
            console.log(`Found ${schedules.length} scheduled tasks.`);
            
            for (const sch of schedules) {
                const query = `
                    INSERT INTO team_scheduled_tasks (id, title, description, "memberId", "eventName", recurrence, "startTime", "endTime", "typeOfWork", "createdAt", "lastGenerated", "autoExtend", "updatedAt", "dailyVariations", "rewardAmount")
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                    ON CONFLICT (id) DO UPDATE SET
                        "lastGenerated" = EXCLUDED."lastGenerated",
                        "updatedAt" = EXCLUDED."updatedAt",
                        "dailyVariations" = EXCLUDED."dailyVariations",
                        "rewardAmount" = EXCLUDED."rewardAmount"
                `;
                const values = [
                    sch.id, sch.title, sch.description, sch.memberId, sch.eventName, sch.recurrence, sch.startTime, sch.endTime, sch.typeOfWork, sch.createdAt, sch.lastGenerated, sch.autoExtend, sch.updatedAt,
                    sch.dailyVariations ? JSON.stringify(sch.dailyVariations) : null,
                    sch.rewardAmount || 0
                ];
                await client.query(query, values);
            }
            console.log('Schedules migrated.');
        }

        // 4. Migrate Rewards
        if (fs.existsSync(FILES.rewards)) {
            const rewards = JSON.parse(fs.readFileSync(FILES.rewards, 'utf8') || '[]');
            console.log(`Found ${rewards.length} rewards.`);
            
            for (const reward of rewards) {
                const query = `
                    INSERT INTO team_rewards (id, "memberId", amount, reason, "createdAt", status)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (id) DO NOTHING
                `;
                const values = [
                    reward.id, reward.memberId, reward.amount, reward.reason, reward.createdAt, reward.status
                ];
                await client.query(query, values);
            }
            console.log('Rewards migrated.');
        }

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
        console.log('Disconnected.');
    }
}

migrate();
