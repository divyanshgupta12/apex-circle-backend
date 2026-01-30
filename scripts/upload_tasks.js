
const fs = require('fs');
const path = require('path');
const https = require('https');

const TASKS_FILE = path.join(__dirname, '..', 'team_tasks.json');
const API_URL = 'https://apex-circle-backend.onrender.com/api/team_tasks';

async function uploadTasks() {
    if (!fs.existsSync(TASKS_FILE)) {
        console.error('No team_tasks.json found');
        return;
    }

    const raw = fs.readFileSync(TASKS_FILE, 'utf8');
    let tasks;
    try {
        tasks = JSON.parse(raw);
    } catch (e) {
        console.error('Failed to parse JSON:', e);
        return;
    }

    if (!Array.isArray(tasks)) {
        console.error('team_tasks.json is not an array');
        return;
    }

    console.log(`Found ${tasks.length} tasks. Uploading...`);

    for (const task of tasks) {
        await uploadTask(task);
    }
    
    console.log('Done!');
}

function uploadTask(task) {
    return new Promise((resolve, reject) => {
        const u = new URL(API_URL);
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(u, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log(`Uploaded task ${task.id}`);
                    resolve();
                } else {
                    console.error(`Failed to upload task ${task.id}: ${res.statusCode} ${data}`);
                    resolve(); // Continue anyway
                }
            });
        });

        req.on('error', (e) => {
            console.error(`Error uploading task ${task.id}:`, e);
            resolve();
        });

        req.write(JSON.stringify(task));
        req.end();
    });
}

uploadTasks();
