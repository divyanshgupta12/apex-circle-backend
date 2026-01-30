
const https = require('https');

const API_URL = 'https://apex-circle-backend.onrender.com/api/team_tasks';

function fetchTasks() {
    return new Promise((resolve, reject) => {
        https.get(API_URL, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    const tasks = Array.isArray(response) ? response : (response.tasks || []);
                    resolve(tasks);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function run() {
    try {
        console.log('Fetching tasks...');
        const tasks = await fetchTasks();
        const remindTask = tasks.filter(t => t.title.toLowerCase().includes('remind'));
        
        console.log(`Found ${remindTask.length} tasks with "remind":`);
        remindTask.forEach(t => {
            console.log(`- Assigned to: ${t.memberId}, Status: ${t.status}, Title: ${t.title}`);
        });

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
