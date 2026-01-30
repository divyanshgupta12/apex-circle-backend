const fs = require('fs');
const path = require('path');
const https = require('https');

const TASKS_FILE = path.join(__dirname, 'team_tasks.json');
const SCHEDULED_TASKS_FILE = path.join(__dirname, 'team_scheduled_tasks.json');
const NEON_API_KEY = process.env.NEON_API_KEY;
const NEON_API_URL = process.env.NEON_API_URL || 'https://ep-lively-union-ae21qnok.apirest.c-2.us-east-2.aws.neon.tech/neondb/rest/v1';

// Canonical Team Members List
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

function neonRequest(method, endpoint, body) {
    return new Promise((resolve, reject) => {
        const u = new URL(NEON_API_URL + endpoint);
        const req = https.request(u, {
            method,
            headers: {
                'Authorization': `Bearer ${NEON_API_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, data: json });
                } catch (e) {
                    resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, data: null });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function processScheduledTasks() {
    try {
        const now = new Date();
        const nowIso = now.toISOString();
        const todayStr = nowIso.split('T')[0];
        const dayOfWeek = now.getDay(); // 0=Sun

        console.log(`Checking schedules for ${todayStr} (Day ${dayOfWeek})`);

        let schedules = [];
        
        // 1. Fetch Schedules
        if (NEON_API_KEY) {
             const resp = await neonRequest('GET', '/team_scheduled_tasks');
             if (resp.ok && Array.isArray(resp.data)) {
                 schedules = resp.data;
             }
        } else {
             if (fs.existsSync(SCHEDULED_TASKS_FILE)) {
                 const raw = fs.readFileSync(SCHEDULED_TASKS_FILE, 'utf8');
                 schedules = JSON.parse(raw || '[]');
             }
        }

        if (!schedules.length) {
            console.log('No schedules found.');
            return;
        }
        let creations = 0;

        for (const sch of schedules) {
            if (sch.isActive === false) continue;
            // Check if already generated today
            if (sch.lastGenerated === todayStr) {
                console.log(`Schedule "${sch.title}" already generated for today.`);
                continue; 
            }

            let shouldGenerate = false;
            let taskTitle = sch.title;
            let taskDesc = sch.description;

            // Determine if we should generate based on recurrence
            if (sch.recurrence === 'weekly-mon-fri') {
                if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                    shouldGenerate = true;
                    // Daily Variations logic if needed
                    if (sch.dailyVariations && sch.dailyVariations[dayOfWeek]) {
                        taskTitle = sch.dailyVariations[dayOfWeek].title || taskTitle;
                        taskDesc = sch.dailyVariations[dayOfWeek].description || taskDesc;
                    }
                }
            } else if (sch.recurrence === 'daily') {
                shouldGenerate = true;
            } else if (sch.recurrence === 'one-time' && sch.scheduledAt) {
                // Legacy support for one-time scheduled tasks
                const scheduledDate = new Date(sch.scheduledAt).toISOString().split('T')[0];
                if (scheduledDate <= todayStr && sch.status === 'pending') {
                    shouldGenerate = true;
                }
            }

            if (shouldGenerate) {
                console.log(`Generating tasks for schedule: ${sch.title}`);
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
                        createdAt: nowIso,
                        updatedAt: nowIso,
                        originScheduleId: sch.id,
                        autoExtend: sch.autoExtend || false,
                        rewardAmount: sch.rewardAmount
                    };

                    // Save Task
                    if (NEON_API_KEY) {
                        await neonRequest('POST', '/team_tasks', newTask);
                    } else {
                        let list = [];
                        if (fs.existsSync(TASKS_FILE)) {
                            list = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8') || '[]');
                        }
                        list.push(newTask);
                        fs.writeFileSync(TASKS_FILE, JSON.stringify(list, null, 2));
                    }
                    creations++;
                }

                // Update Schedule lastGenerated (and status if one-time)
                const updateData = { lastGenerated: todayStr };
                if (sch.recurrence === 'one-time') updateData.status = 'completed';

                if (NEON_API_KEY) {
                    await neonRequest('PATCH', `/team_scheduled_tasks?id=eq.${sch.id}`, updateData);
                } else {
                    let list = JSON.parse(fs.readFileSync(SCHEDULED_TASKS_FILE, 'utf8') || '[]');
                    const idx = list.findIndex(t => t.id === sch.id);
                    if (idx !== -1) {
                        list[idx] = { ...list[idx], ...updateData };
                        fs.writeFileSync(SCHEDULED_TASKS_FILE, JSON.stringify(list, null, 2));
                    }
                }
            } else {
                console.log(`Schedule "${sch.title}" skipped (not due today).`);
            }
        }
        
        console.log(`Generated ${creations} tasks from schedules.`);

    } catch (e) {
        console.error('Error processing scheduled tasks:', e);
    }
}

processScheduledTasks();
