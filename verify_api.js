const http = require('http');
const fs = require('fs');

function log(msg) {
    console.log(msg);
    fs.appendFileSync('api_result.txt', msg + '\n');
}

log('Starting checks...');

function check(path) {
    return new Promise((resolve) => {
        http.get('http://localhost:8002' + path, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                log(`PATH: ${path} | STATUS: ${res.statusCode}`);
                try {
                    const json = JSON.parse(data);
                    // Handle array response (scheduled_tasks) or object response
                    if (Array.isArray(json)) {
                        log(`RESPONSE: Array Length=${json.length}`);
                    } else {
                        log(`RESPONSE: OK=${json.ok}`);
                        if (json.videos) log(`Videos: ${json.videos.length}`);
                        if (json.rewards) log(`Rewards: ${json.rewards.length}`);
                        if (json.tasks) log(`Tasks: ${json.tasks.length}`);
                    }
                } catch (e) {
                    log('RESPONSE (raw): ' + data.substring(0, 100));
                }
                resolve();
            });
        }).on('error', (e) => {
            log(`ERROR ${path}: ` + e.message);
            resolve();
        });
    });
}

async function run() {
    await check('/api/team_training_videos');
    await check('/api/team_rewards?memberId=tm001');
    await check('/api/team_tasks?memberId=tm001');
    await check('/api/scheduled_tasks');
}

run();
