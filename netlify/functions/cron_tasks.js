const { Client } = require('pg');

// Canonical Team Members List (Sync with js/data.js)
const teamMembers = [
    { id: 'tm001', name: 'Mr. Divyansh Gupta', email: 'divyansh.gupta@apexcircle.com', position: 'Team Leader' },
    { id: 'tm002', name: 'Anurag Sangar', email: 'anurag.sangar@apexcircle.com', position: 'Registration Management' },
    { id: 'tm003', name: 'Miss Palak', email: 'palak@apexcircle.com', position: 'Guest Management' },
    { id: 'tm004', name: 'Aman Yadav', email: 'aman.yadav@apexcircle.com', position: 'Social Media & PR' },
    { id: 'tm005', name: 'Aarti Yadav', email: 'aarti.yadav@apexcircle.com', position: 'Host & Anchor' },
    { id: 'tm006', name: 'Prince Jangra', email: 'prince.jangra@apexcircle.com', position: 'Event Coordinator' },
    { id: 'tm007', name: 'Naman Singh', email: 'naman.singh@apexcircle.com', position: 'Social Media & PR' },
    { id: 'tm008', name: 'Drishti Pathak', email: 'drishti.pathak@apexcircle.com', position: 'Creative Team Head' },
    { id: 'tm009', name: 'Deepti', email: 'deepti@apexcircle.com', position: 'Stage Coordinator' }
];

exports.handler = async function(event, context) {
    console.log('Running Cron Task Sync (Scheduled for 9:00 AM IST)...');
    
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        console.error('Missing DATABASE_URL environment variable.');
        return { statusCode: 500, body: 'Missing DATABASE_URL' };
    }

    const client = new Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Fetch Schedules
        const schedulesRes = await client.query('SELECT * FROM team_scheduled_tasks');
        const schedules = schedulesRes.rows;

        // 2. Fetch Active Tasks (to check duplicates)
        // Optimization: Fetch tasks created recently or just all active ones
        const tasksRes = await client.query('SELECT * FROM team_tasks WHERE status != \'completed\' AND status != \'eliminated\'');
        const activeTasks = tasksRes.rows;
        
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const dayOfWeek = today.getDay(); // 0=Sun
        
        let updates = 0;
        let creations = 0;

        // A. Auto-Extend Overdue Tasks
        for (const task of activeTasks) {
            if (task.autoExtend) {
                const dueRaw = task.dueDate ? String(task.dueDate).split('T')[0] : null;
                if (dueRaw && dueRaw < todayStr) {
                    console.log(`Extending task ${task.id} to ${todayStr}`);
                    await client.query('UPDATE team_tasks SET "dueDate" = $1, "extensionCount" = COALESCE("extensionCount", 0) + 1 WHERE id = $2', [todayStr, task.id]);
                    updates++;
                }
            }
        }

        // B. Generate Daily Tasks
        for (const sch of schedules) {
            if (sch.isActive === false) continue;
            if (sch.lastGenerated === todayStr) continue; // Already generated today

            let shouldGenerate = false;
            let taskTitle = sch.title;
            let taskDesc = sch.description;

            // Handle dailyVariations (could be JSON or stringified JSON)
            let variations = sch.dailyVariations;
            if (typeof variations === 'string') {
                try { variations = JSON.parse(variations); } catch(e) {}
            }

            if (sch.recurrence === 'weekly-mon-fri') {
                if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                    shouldGenerate = true;
                    if (variations && variations[dayOfWeek]) {
                        taskTitle = variations[dayOfWeek].title || taskTitle;
                        taskDesc = variations[dayOfWeek].description || taskDesc;
                    }
                }
            } else if (sch.recurrence === 'daily') {
                shouldGenerate = true;
            } else if (sch.recurrence === 'one-time' && sch.scheduledAt) {
                const scheduledDate = new Date(sch.scheduledAt).toISOString().split('T')[0];
                if (scheduledDate <= todayStr) {
                    shouldGenerate = true;
                }
            }

            if (shouldGenerate) {
                // Generate Task
                const members = sch.memberId === 'all' ? teamMembers : [teamMembers.find(m => m.id === sch.memberId)].filter(Boolean);
                
                for (const member of members) {
                    const newId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
                    const newTask = {
                        id: newId,
                        title: taskTitle,
                        description: taskDesc,
                        memberId: member.id,
                        eventName: sch.eventName,
                        dueDate: sch.recurrence === 'one-time' && sch.dueDate ? sch.dueDate : todayStr,
                        status: 'pending',
                        createdAt: new Date().toISOString(),
                        originScheduleId: sch.id,
                        autoExtend: sch.autoExtend || false,
                        rewardAmount: sch.rewardAmount
                    };

                    const keys = Object.keys(newTask);
                    const cols = keys.map(k => `"${k}"`).join(', ');
                    const vals = keys.map((_, i) => `$${i + 1}`);
                    const values = keys.map(k => newTask[k]);

                    await client.query(`INSERT INTO team_tasks (${cols}) VALUES (${vals})`, values);
                    creations++;
                }

                // Update Schedule lastGenerated
                await client.query('UPDATE team_scheduled_tasks SET "lastGenerated" = $1 WHERE id = $2', [todayStr, sch.id]);
            }
        }

        console.log(`Sync Complete: ${creations} tasks created, ${updates} tasks extended.`);
        await client.end();
        
        return {
            statusCode: 200,
            body: JSON.stringify({ ok: true, updates, creations })
        };

    } catch (e) {
        console.error('Cron Error:', e);
        try { await client.end(); } catch(err) {}
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
};
