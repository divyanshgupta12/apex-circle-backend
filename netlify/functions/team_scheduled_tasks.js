const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

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

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers };
    }

    const databaseUrl = process.env.DATABASE_URL;

    if (databaseUrl) {
        const client = new Client({
            connectionString: databaseUrl,
            ssl: { rejectUnauthorized: false }
        });

        try {
            await client.connect();

            if (event.httpMethod === 'GET') {
                const result = await client.query('SELECT * FROM team_scheduled_tasks ORDER BY "createdAt" DESC');
                await client.end();
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ ok: true, tasks: result.rows })
                };
            }

            if (event.httpMethod === 'POST') {
                const body = JSON.parse(event.body);
                if (!body.id) {
                    await client.end();
                    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Task ID required' }) };
                }

                const keys = Object.keys(body).filter(k => k !== 'id');
                if (keys.length === 0) {
                     await client.end();
                     return { statusCode: 200, headers, body: JSON.stringify({ ok: true, task: body }) };
                }

                const cols = keys.map(k => `"${k}"`).join(', ');
                const vals = keys.map((_, i) => `$${i + 2}`);
                const updates = keys.map(k => `"${k}" = EXCLUDED."${k}"`).join(', ');

                const query = `
                    INSERT INTO team_scheduled_tasks (id, ${cols}) 
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
                const qs = event.queryStringParameters || {};
                if (!qs.id) {
                    await client.end();
                    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Missing id parameter' }) };
                }
                
                let id = qs.id;
                if (id.startsWith('eq.')) id = id.substring(3);

                await client.query('DELETE FROM team_scheduled_tasks WHERE id = $1', [id]);
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
            return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
        }
    }

    // Local Fallback
    console.warn('DATABASE_URL missing, using local file fallback.');
    try {
        if (event.httpMethod === 'GET') {
            const tasks = readLocalSchedule();
            return { statusCode: 200, headers, body: JSON.stringify({ ok: true, tasks }) };
        }
        
        if (event.httpMethod === 'POST') {
            const task = JSON.parse(event.body);
            if (!task.id) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Task ID required' }) };
            
            let tasks = readLocalSchedule();
            const idx = tasks.findIndex(t => String(t.id) === String(task.id));
            
            if (idx >= 0) {
                tasks[idx] = { ...tasks[idx], ...task };
            } else {
                tasks.push(task);
            }
            
            writeLocalSchedule(tasks);
            return { statusCode: 200, headers, body: JSON.stringify({ ok: true, task }) };
        }

        if (event.httpMethod === 'DELETE') {
             const qs = event.queryStringParameters || {};
             if (qs.id) {
                 let id = qs.id;
                 if (id.startsWith('eq.')) id = id.substring(3);
                 let tasks = readLocalSchedule();
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
};
