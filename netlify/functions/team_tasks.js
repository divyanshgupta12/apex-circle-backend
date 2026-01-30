const https = require('https');
const fs = require('fs');
const path = require('path');

// Local Fallback File
const TASKS_FILE = path.join(__dirname, 'team_tasks.json');

// Helper to read local file
function readLocalTasks() {
    if (!fs.existsSync(TASKS_FILE)) return [];
    try {
        const data = fs.readFileSync(TASKS_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (e) {
        console.error('Read error:', e);
        return [];
    }
}

// Helper to write local file
function writeLocalTasks(tasks) {
    try {
        // Ensure directory exists
        const dir = path.dirname(TASKS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
        return true;
    } catch (e) {
        console.error('Write error:', e);
        return false;
    }
}

// Simple fetch wrapper for Node environment (if native fetch is missing)
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

// Use native fetch if available, else fallback
const fetchFn = typeof fetch === 'function' ? fetch : nodeFetch;

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    const baseUrl = process.env.NEON_API_URL || 'https://ep-lively-union-ae21qnok.apirest.c-2.us-east-2.aws.neon.tech/neondb/rest/v1';
    // Prioritize environment variable, then check Authorization header
    let apiKey = process.env.NEON_API_KEY;
    if (!apiKey && event.headers) {
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            apiKey = authHeader.substring(7).trim();
        }
    }

    // Fallback to local file system if API key is missing
    if (!apiKey) {
        console.warn('NEON_API_KEY missing, using local file fallback.');
        try {
            // Ensure file exists or treat as empty
            let tasks = [];
            if (fs.existsSync(TASKS_FILE)) {
                try {
                    const raw = fs.readFileSync(TASKS_FILE, 'utf8');
                    tasks = JSON.parse(raw);
                } catch (e) {
                    console.warn('Failed to parse local tasks file, starting fresh.', e);
                    tasks = [];
                }
            }
            if (!Array.isArray(tasks)) tasks = [];

            if (event.httpMethod === 'GET') {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ ok: true, tasks })
                };
            }

            if (event.httpMethod === 'POST' || event.httpMethod === 'PATCH') {
                const body = JSON.parse(event.body);
                if (!body.id) {
                    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Task ID required' }) };
                }

                const idx = tasks.findIndex(t => t.id === body.id);
                let savedTask;
                if (idx >= 0) {
                    tasks[idx] = { ...tasks[idx], ...body };
                    savedTask = tasks[idx];
                } else {
                    savedTask = body;
                    tasks.push(savedTask);
                }

                // Ensure directory exists
                const dir = path.dirname(TASKS_FILE);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ ok: true, task: savedTask })
                };
            }

            if (event.httpMethod === 'DELETE') {
                const id = event.queryStringParameters && event.queryStringParameters.id;
                if (!id) {
                    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Missing id parameter' }) };
                }

                const initialLength = tasks.length;
                tasks = tasks.filter(t => t.id !== id);
                if (tasks.length !== initialLength) {
                    // Ensure directory exists
                    const dir = path.dirname(TASKS_FILE);
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }
                    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
                }
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ ok: true })
                };
            }

            return { statusCode: 405, headers, body: 'Method Not Allowed' };

        } catch (err) {
            console.error('Local File Fallback Error:', err);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ ok: false, error: err.message })
            };
        }
    }

    // Neon DB Logic
    try {
        if (event.httpMethod === 'GET') {
            const resp = await fetchFn(`${baseUrl}/team_tasks`, {
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
        
        if (event.httpMethod === 'POST' || event.httpMethod === 'PATCH') {
            const task = JSON.parse(event.body);
            if (!task.id) throw new Error('Task ID required');

            // If it's a direct PATCH request, just try to patch
            if (event.httpMethod === 'PATCH') {
                const patchResp = await fetchFn(`${baseUrl}/team_tasks?id=eq.${task.id}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(task)
                });
                if (!patchResp.ok) throw new Error(await patchResp.text());
                const patched = await patchResp.json();
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ ok: true, task: patched[0] })
                };
            }

            // POST with upsert logic
            // Check if exists
            const check = await fetchFn(`${baseUrl}/team_tasks?id=eq.${task.id}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            const existing = await check.json();
            
            let method = 'POST';
            let url = `${baseUrl}/team_tasks`;
            
            if (Array.isArray(existing) && existing.length > 0) {
                method = 'PATCH';
                url = `${baseUrl}/team_tasks?id=eq.${task.id}`;
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

            const delResp = await fetchFn(`${baseUrl}/team_tasks?id=eq.${encodeURIComponent(id)}`, {
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
