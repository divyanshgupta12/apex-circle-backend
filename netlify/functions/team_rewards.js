const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const REWARDS_FILE = path.join(__dirname, 'team_rewards.json');

function readLocalRewards() {
    if (!fs.existsSync(REWARDS_FILE)) return [];
    try {
        const data = fs.readFileSync(REWARDS_FILE, 'utf8');
        return JSON.parse(data || '[]');
    } catch (e) {
        console.error('Read error:', e);
        return [];
    }
}

function writeLocalRewards(rewards) {
    try {
        fs.writeFileSync(REWARDS_FILE, JSON.stringify(rewards, null, 2));
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
                const qs = event.queryStringParameters || {};
                let query = 'SELECT * FROM team_rewards';
                let params = [];
                
                if (qs.memberId) {
                    let memId = qs.memberId;
                    if (memId.startsWith('eq.')) memId = memId.substring(3);
                    query += ' WHERE "memberId" = $1';
                    params.push(memId);
                }
                
                query += ' ORDER BY "createdAt" DESC';
                
                const result = await client.query(query, params);
                await client.end();
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ ok: true, rewards: result.rows })
                };
            }

            if (event.httpMethod === 'POST') {
                const body = JSON.parse(event.body);
                if (!body.id) {
                    await client.end();
                    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Reward ID required' }) };
                }

                const keys = Object.keys(body).filter(k => k !== 'id');
                if (keys.length === 0) {
                     await client.end();
                     return { statusCode: 200, headers, body: JSON.stringify({ ok: true, reward: body }) };
                }

                const cols = keys.map(k => `"${k}"`).join(', ');
                const vals = keys.map((_, i) => `$${i + 2}`);
                const updates = keys.map(k => `"${k}" = EXCLUDED."${k}"`).join(', ');

                const query = `
                    INSERT INTO team_rewards (id, ${cols}) 
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
                    body: JSON.stringify({ ok: true, reward: res.rows[0] })
                };
            }

            if (event.httpMethod === 'DELETE') {
                const qs = event.queryStringParameters || {};
                let query = 'DELETE FROM team_rewards';
                let params = [];
                
                if (qs.id) {
                    let id = qs.id;
                    if (id.startsWith('eq.')) id = id.substring(3);
                    query += ' WHERE id = $1';
                    params.push(id);
                } else if (qs.taskId) { 
                     // Not supporting mass delete by taskId via query for safety unless needed
                     await client.end();
                     return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Only ID deletion supported via this API for now' }) };
                } else if (qs.all === 'true' || qs.true === 'eq.true') {
                     // Delete all? Dangerous.
                } else {
                     await client.end();
                     return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Missing delete criteria' }) };
                }

                await client.query(query, params);
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
            const rewards = readLocalRewards();
            const qs = event.queryStringParameters || {};
            let result = rewards;
            if (qs.memberId) {
                let memId = qs.memberId;
                if (memId.startsWith('eq.')) memId = memId.substring(3);
                result = rewards.filter(r => String(r.memberId) === String(memId));
            }
            return { statusCode: 200, headers, body: JSON.stringify({ ok: true, rewards: result }) };
        }
        
        if (event.httpMethod === 'POST') {
            const reward = JSON.parse(event.body);
            if (!reward.id) return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Reward ID required' }) };
            
            let rewards = readLocalRewards();
            const idx = rewards.findIndex(r => String(r.id) === String(reward.id));
            
            if (idx >= 0) {
                rewards[idx] = { ...rewards[idx], ...reward };
            } else {
                rewards.push(reward);
            }
            
            writeLocalRewards(rewards);
            return { statusCode: 200, headers, body: JSON.stringify({ ok: true, reward }) };
        }

        if (event.httpMethod === 'DELETE') {
             const qs = event.queryStringParameters || {};
             let rewards = readLocalRewards();
             if (qs.id) {
                 let id = qs.id;
                 if (id.startsWith('eq.')) id = id.substring(3);
                 rewards = rewards.filter(r => String(r.id) !== String(id));
             } else if (qs.taskId) {
                 let tid = qs.taskId;
                 if (tid.startsWith('eq.')) tid = tid.substring(3);
                 rewards = rewards.filter(r => String(r.taskId) !== String(tid));
             } else if (qs.all === 'true' || qs.true === 'eq.true') {
                 rewards = [];
             } else {
                 return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Missing delete criteria' }) };
             }
             writeLocalRewards(rewards);
             return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
        }

        return { statusCode: 405, headers, body: 'Method Not Allowed' };

    } catch(e) {
         return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: e.message }) };
    }
};
