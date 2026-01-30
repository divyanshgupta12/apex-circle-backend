const https = require('https');
const fs = require('fs');
const path = require('path');

// Local Fallback File
// Use the bundled file in the same directory
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

    // Fallback Mode if no Key
    if (!apiKey) {
        console.warn('No NEON_API_KEY found, using local file fallback');
        
        try {
            if (event.httpMethod === 'GET') {
                const rewards = readLocalRewards();
                // Filter by memberId if needed
                const qs = event.queryStringParameters || {};
                let result = rewards;
                if (qs.memberId) {
                    // Check for PostgREST syntax like eq.ID
                    let memId = qs.memberId;
                    if (memId.startsWith('eq.')) memId = memId.substring(3);
                    result = rewards.filter(r => String(r.memberId) === String(memId));
                }
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ ok: true, rewards: result })
                };
            }
            
            if (event.httpMethod === 'POST') {
                const reward = JSON.parse(event.body);
                if (!reward.id) throw new Error('Reward ID required');
                
                let rewards = readLocalRewards();
                const idx = rewards.findIndex(r => String(r.id) === String(reward.id));
                
                if (idx >= 0) {
                    rewards[idx] = { ...rewards[idx], ...reward };
                } else {
                    rewards.push(reward);
                }
                
                writeLocalRewards(rewards);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ ok: true, reward })
                };
            }

            if (event.httpMethod === 'DELETE') {
                 const qs = event.queryStringParameters || {};
                 let rewards = readLocalRewards();
                 
                 // Handle various delete criteria
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
             console.error('Local Fallback Error:', e);
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

            const resp = await fetchFn(`${baseUrl}/team_rewards${query}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (!resp.ok) throw new Error(await resp.text());
            const rewards = await resp.json();
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ ok: true, rewards: Array.isArray(rewards) ? rewards : [] })
            };
        } 
        
        if (event.httpMethod === 'POST') {
            const reward = JSON.parse(event.body);
            if (!reward.id) throw new Error('Reward ID required');

            const encodedId = encodeURIComponent(reward.id);
            const check = await fetchFn(`${baseUrl}/team_rewards?id=eq.${encodedId}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            const existing = await check.json();
            
            let method = 'POST';
            let url = `${baseUrl}/team_rewards`;
            
            if (Array.isArray(existing) && existing.length > 0) {
                method = 'PATCH';
                url = `${baseUrl}/team_rewards?id=eq.${encodedId}`;
            }

            const saveResp = await fetchFn(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(reward)
            });

            if (!saveResp.ok) throw new Error(await saveResp.text());
            const saved = await saveResp.json();
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ ok: true, reward: Array.isArray(saved) ? saved[0] : saved })
            };
        }

        if (event.httpMethod === 'DELETE') {
            const qs = event.queryStringParameters || {};
            let url;

            if (qs.id) {
                 const id = encodeURIComponent(qs.id);
                 url = `${baseUrl}/team_rewards?id=eq.${id}`;
            } else if (qs.taskId) {
                const encodedTaskId = encodeURIComponent(qs.taskId);
                url = `${baseUrl}/team_rewards?taskId=eq.${encodedTaskId}`;
            } else if (qs.all === 'true') {
                url = `${baseUrl}/team_rewards?true=eq.true`; // Assuming this deletes all? Careful.
                // Actually PostgREST doesn't support delete all easily without a condition.
                // We should probably rely on the client sending a valid query.
                // But for safety, if all=true is passed, we might need a dummy condition that is always true?
                // Or just don't support it remotely to be safe?
                // The existing code had `true=eq.true`.
                url = `${baseUrl}/team_rewards?id=not.is.null`;
            } else {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ ok: false, error: 'Missing delete criteria' })
                };
            }

            const delResp = await fetchFn(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
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
        // Fallback to local on remote error? 
        // For now, return error to avoid data inconsistency, or we could fallback to read-only?
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ ok: false, error: e.message })
        };
    }
};
