const https = require('https');
const fs = require('fs');
const path = require('path');

// Local Fallback File
const SCHEDULE_FILE = path.join(__dirname, 'team_scheduled_tasks.json');

function readLocalSchedule() {
    if (!fs.existsSync(SCHEDULE_FILE)) return [];
    try {
        const data = fs.readFileSync(SCHEDULE_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (e) {
        console.error('Read error:', e);
        return [];
    }
}

function writeLocalSchedule(tasks) {
    try {
        fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(tasks, null, 2));
        return true;
    } catch (e) {
        console.error('Write error:', e);
        return false;
    }
}

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

const fetchFn = typeof fetch === 'function' ? fetch : nodeFetch;

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    const baseUrl = process.env.NEON_API_URL || 'https://ep-lively-union-ae21qnok.apirest.c-2.us-east-2.aws.neon.tech/neondb/rest/v1';
    
    // 1. Try Env Var
    let apiKey = process.env.NEON_API_KEY;
    
    // 2. Try Auth Header
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!apiKey && authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.split(' ')[1];
    }

    // Fallback Mode
    if (!apiKey) {
        console.warn('No NEON_API_KEY found, using local file fallback');
        
        try {
            if (event.httpMethod === 'GET') {
                const tasks = readLocalSchedule();
                // Basic Filtering
                const qs = event.queryStringParameters || {};
                let result = tasks;
                
                // Handle 'or' query for (memberId.eq.X,memberId.eq.all) - very simplified
                if (qs.or) {
                    // Just return all for now, client filters anyway?
                    // Or try to parse: (memberId.eq.tm001,memberId.eq.all)
                    // This is complex to parse perfectly. 
                    // Let's just return all tasks, and let client filter?
                    // Or if we can extract the ID.
                    // For now, return all.
                }
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ ok: true, tasks: result })
                };
            }
            
            if (event.httpMethod === 'POST') {
                const task = JSON.parse(event.body);
                if (!task.id) throw new Error('Task ID required');
                
                let tasks = readLocalSchedule();
                const idx = tasks.findIndex(t => String(t.id) === String(task.id));
                
                if (idx >= 0) {
                    tasks[idx] = { ...tasks[idx], ...task };
                } else {
                    tasks.push(task);
                }
                
                writeLocalSchedule(tasks);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ ok: true, task })
                };
            }

            if (event.httpMethod === 'DELETE') {
                 const qs = event.queryStringParameters || {};
                 let tasks = readLocalSchedule();
                 
                 if (qs.id) {
                     let id = qs.id;
                     if (id.startsWith('eq.')) id = id.substring(3);
                     tasks = tasks.filter(t => String(t.id) !== String(id));
                     writeLocalSchedule(tasks);
                     return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
                 }
                 return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Missing id' }) };
            }

            return { statusCode: 405, headers, body: 'Method Not Allowed' };

        } catch(e) {
             return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e.message }) };
        }
    }

    // Remote Logic
    try {
        if (event.httpMethod === 'GET') {
            // Forward query params
            const qs = event.queryStringParameters;
            let query = '';
            if (qs && Object.keys(qs).length > 0) {
                query = '?' + Object.keys(qs).map(k => `${k}=${qs[k]}`).join('&');
            }

            const resp = await fetchFn(`${baseUrl}/team_scheduled_tasks${query}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (!resp.ok) throw new Error(await resp.text());
            const tasks = await resp.json();
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ ok: true, tasks: Array.isArray(tasks) ? tasks : [] })
            };
        } 
        
        if (event.httpMethod === 'POST') {
            const task = JSON.parse(event.body);
            if (!task.id) throw new Error('Task ID required');

            const encodedId = encodeURIComponent(task.id);
            const check = await fetchFn(`${baseUrl}/team_scheduled_tasks?id=eq.${encodedId}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            
            let method = 'POST';
            let url = `${baseUrl}/team_scheduled_tasks`;

            if (check.ok) {
                const existing = await check.json();
                if (Array.isArray(existing) && existing.length > 0) {
                    method = 'PATCH';
                    url = `${baseUrl}/team_scheduled_tasks?id=eq.${encodedId}`;
                }
            }

            const saveResp = await fetchFn(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(task)
            });

            if (!saveResp.ok) throw new Error(await saveResp.text());
            const saved = await saveResp.json();
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ ok: true, task: Array.isArray(saved) ? saved[0] : saved })
            };
        }

        if (event.httpMethod === 'DELETE') {
            const id = event.queryStringParameters && event.queryStringParameters.id;
            if (!id) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ ok: false, error: 'Missing id parameter' })
                };
            }
            
            // Clean ID if needed (though usually passed as eq.ID)
            const encodedId = encodeURIComponent(id.startsWith('eq.') ? id.substring(3) : id);

            const delResp = await fetchFn(`${baseUrl}/team_scheduled_tasks?id=eq.${encodedId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });

            if (!delResp.ok) throw new Error(await delResp.text());

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ ok: true })
            };
        }

        return { statusCode: 405, headers, body: 'Method Not Allowed' };

    } catch (e) {
        console.error('Neon API Error:', e);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ ok: false, error: e.message })
        };
    }
};
