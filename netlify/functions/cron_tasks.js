const https = require('https');

// Simple fetch wrapper for Node environment (Zero Dependency)
function nodeFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, {
            method: options.method || 'GET',
            headers: options.headers || {},
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    json: () => Promise.resolve(data ? JSON.parse(data) : {}),
                    text: () => Promise.resolve(data)
                });
            });
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

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
    
    // Fallback URL if env var not set (User should set NEON_API_URL and NEON_API_KEY in Netlify)
    const baseUrl = process.env.NEON_API_URL || 'https://ep-lively-union-ae21qnok.apirest.c-2.us-east-2.aws.neon.tech/neondb/rest/v1';
    const apiKey = process.env.NEON_API_KEY;

    if (!apiKey) {
        console.error('Missing NEON_API_KEY environment variable.');
        return { statusCode: 500, body: 'Missing NEON_API_KEY' };
    }

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    };

    try {
        // 1. Fetch Schedules
        const schResp = await nodeFetch(`${baseUrl}/team_scheduled_tasks`, { headers });
        const schedules = schResp.ok ? await schResp.json() : [];

        // 2. Fetch Existing Tasks (to check duplicates and overdue)
        // Optimization: Fetch only active/pending tasks if list is huge, but for now fetch all
        const taskResp = await nodeFetch(`${baseUrl}/team_tasks`, { headers });
        const tasks = taskResp.ok ? await taskResp.json() : [];
        
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const dayOfWeek = today.getDay(); // 0=Sun
        
        let updates = 0;
        let creations = 0;

        // A. Auto-Extend Overdue Tasks
        for (const task of tasks) {
            if (task.status !== 'completed' && task.status !== 'eliminated' && task.autoExtend) {
                const dueRaw = task.dueDate ? String(task.dueDate).split('T')[0] : null;
                if (dueRaw && dueRaw < todayStr) {
                    console.log(`Extending task ${task.id} to ${todayStr}`);
                    // Optimistic update
                    await nodeFetch(`${baseUrl}/team_tasks?id=eq.${task.id}`, {
                        method: 'PATCH',
                        headers,
                        body: JSON.stringify({ dueDate: todayStr })
                    });
                    updates++;
                }
            }
        }

        // B. Generate Daily Tasks
        if (Array.isArray(schedules)) {
            for (const sch of schedules) {
                if (sch.isActive === false) continue;
                if (sch.lastGenerated === todayStr) continue; // Already generated today

                let shouldGenerate = false;
                let taskTitle = sch.title;
                let taskDesc = sch.description;

                if (sch.recurrence === 'weekly-mon-fri') {
                    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                        shouldGenerate = true;
                        // Daily Variations
                        if (sch.dailyVariations && sch.dailyVariations[dayOfWeek]) {
                            taskTitle = sch.dailyVariations[dayOfWeek].title || taskTitle;
                            taskDesc = sch.dailyVariations[dayOfWeek].description || taskDesc;
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
                        const newTask = {
                            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
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

                        await nodeFetch(`${baseUrl}/team_tasks`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(newTask)
                        });
                        creations++;
                    }

                    // Update Schedule lastGenerated to prevent double generation today
                    await nodeFetch(`${baseUrl}/team_scheduled_tasks?id=eq.${sch.id}`, {
                        method: 'PATCH',
                        headers,
                        body: JSON.stringify({ lastGenerated: todayStr })
                    });
                }
            }
        }

        console.log(`Sync Complete: ${creations} tasks created, ${updates} tasks extended.`);
        return {
            statusCode: 200,
            body: JSON.stringify({ ok: true, updates, creations })
        };

    } catch (e) {
        console.error('Cron Error:', e);
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
};
