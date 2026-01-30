const { Client } = require('pg');
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

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    const databaseUrl = process.env.DATABASE_URL;

    // 1. Postgres Logic
    if (databaseUrl) {
        const client = new Client({
            connectionString: databaseUrl,
            ssl: { rejectUnauthorized: false }
        });

        try {
            await client.connect();

            if (event.httpMethod === 'GET') {
                const result = await client.query('SELECT * FROM team_tasks ORDER BY "createdAt" DESC');
                await client.end();
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ ok: true, tasks: result.rows })
                };
            }

            if (event.httpMethod === 'POST' || event.httpMethod === 'PATCH') {
                const body = JSON.parse(event.body);
                if (!body.id) {
                    await client.end();
                    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Task ID required' }) };
                }

                // Dynamic Upsert
                const keys = Object.keys(body).filter(k => k !== 'id');
                
                if (keys.length === 0) {
                     await client.end();
                     return { statusCode: 200, headers, body: JSON.stringify({ ok: true, task: body }) };
                }

                const cols = keys.map(k => `"${k}"`).join(', ');
                const vals = keys.map((_, i) => `$${i + 2}`); // $2, $3...
                const updates = keys.map(k => `"${k}" = EXCLUDED."${k}"`).join(', ');

                const query = `
                    INSERT INTO team_tasks (id, ${cols}) 
                    VALUES ($1, ${vals.join(', ')}) 
                    ON CONFLICT (id) 
                    DO UPDATE SET ${updates} 
                    RETURNING *
                `;
                
                const values = [body.id, ...keys.map(k => body[k])];
                
                const res = await client.query(query, values);
                await client.end();

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ ok: true, task: res.rows[0] })
                };
            }

            if (event.httpMethod === 'DELETE') {
                const id = event.queryStringParameters && event.queryStringParameters.id;
                if (!id) {
                    await client.end();
                    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Missing id parameter' }) };
                }
                
                // Handle PostgREST syntax like eq.ID if passed by client
                const cleanId = id.startsWith('eq.') ? id.substring(3) : id;

                await client.query('DELETE FROM team_tasks WHERE id = $1', [cleanId]);
                await client.end();

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ ok: true })
                };
            }
            
            await client.end();
            return { statusCode: 405, headers, body: 'Method Not Allowed' };

        } catch (err) {
            console.error('Postgres Error:', err);
            try { await client.end(); } catch(e) {}
            
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ ok: false, error: err.message })
            };
        }
    }

    // 2. Local Fallback (if no DATABASE_URL)
    console.warn('DATABASE_URL missing, using local file fallback.');
    try {
        let tasks = readLocalTasks();

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

            writeLocalTasks(tasks);
            
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
            
            const cleanId = id.startsWith('eq.') ? id.substring(3) : id;

            const initialLength = tasks.length;
            tasks = tasks.filter(t => t.id !== cleanId);
            if (tasks.length !== initialLength) {
                writeLocalTasks(tasks);
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
};
