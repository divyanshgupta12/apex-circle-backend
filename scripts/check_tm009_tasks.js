
const https = require('https');

const API_URL = 'https://apex-circle-backend.onrender.com/api/team_tasks';

function fetchTasks() {
    return new Promise((resolve, reject) => {
        https.get(API_URL, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const tasks = JSON.parse(data);
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
        const response = await fetchTasks();
        const tasks = Array.isArray(response) ? response : (response.tasks || []);
        
        console.log(`Total tasks on server: ${tasks.length}`);
        
        const myTasks = tasks.filter(t => t.memberId === 'tm009');
        console.log(`Tasks for tm009 (Deepti): ${myTasks.length}`);
        
        myTasks.forEach(t => {
            console.log(`- [${t.status}] ${t.title} (ID: ${t.id})`);
        });

        // Check for "Day 3" task
        const day3 = tasks.find(t => t.title.includes('Day 3'));
        if (day3) {
            console.log('\nFound "Day 3" task:');
            console.log(JSON.stringify(day3, null, 2));
        } else {
            console.log('\n"Day 3" task not found on server.');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
