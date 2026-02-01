const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config(); // Load environment variables from .env
const { URLSearchParams } = require('url');
// Load environment variables
try { require('dotenv').config(); } catch (e) {}
const { Pool } = require('pg');

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('Starting Server v1.2 (Fixed NEON_API_KEY issue)...');
const PORT = 8002;
const TASKS_FILE = path.join(__dirname, 'team_tasks.json');
const REWARDS_FILE = path.join(__dirname, 'team_rewards.json');
const SCHEDULED_TASKS_FILE = path.join(__dirname, 'team_scheduled_tasks.json');
const TRAINING_VIDEOS_FILE = path.join(__dirname, 'team_training_videos.json');
const UPDATES_FILE = path.join(__dirname, 'team_updates.json');
const NOTIFICATIONS_FILE = path.join(__dirname, 'team_notifications.json');

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DB_URL;
let pool = null;

if (DATABASE_URL) {
    console.log('Connecting to Neon Database via Postgres...');
    pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
}

async function dbQuery(text, params) {
    if (!pool) return { ok: false, error: 'No Database Connection' };
    try {
        const res = await pool.query(text, params);
        return { ok: true, rows: res.rows, rowCount: res.rowCount };
    } catch (e) {
        console.error('DB Error:', e);
        return { ok: false, error: e.message };
    }
}

// Load config from sms-config.json
let smsConfig = {};
try {
    const configPath = path.join(__dirname, 'sms-config.json');
    if (fs.existsSync(configPath)) {
        smsConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        console.log('Loaded configuration from sms-config.json');
    }
} catch (e) {
    console.error('Warning: Could not read sms-config.json:', e.message);
}

// Merge config into process.env for compatibility with existing functions
for (const [key, value] of Object.entries(smsConfig)) {
    if (process.env[key] === undefined) {
        process.env[key] = String(value);
    }
}

const SMS_SERVER_API_KEY = String(process.env.SMS_SERVER_API_KEY || '').trim();
const SMS_SENDER_NAME = Object.prototype.hasOwnProperty.call(process.env, 'SMS_SENDER_NAME')
    ? String(process.env.SMS_SENDER_NAME || '').trim()
    : 'The Apex Circle';

// --- SMS Helper Functions ---

function readJson(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 50_000_000) {
                reject(new Error('Body too large'));
                try { req.destroy(); } catch {}
            }
        });
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}

function sendJson(res, statusCode, data) {
    const payload = JSON.stringify(data || {});
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS, PUT, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, Access-Control-Request-Private-Network',
        'Access-Control-Allow-Private-Network': 'true'
    });
    res.end(payload);
}

function getProviderStatus() {
    const textBeeConfigured = Boolean(String(process.env.TEXTBEE_API_KEY || '').trim() && String(process.env.TEXTBEE_DEVICE_ID || '').trim());
    const smsGateLocalConfigured = Boolean(String(process.env.SMSGATE_DEVICE_URL || '').trim() && String(process.env.SMSGATE_USERNAME || '').trim() && String(process.env.SMSGATE_PASSWORD || '').trim());
    const smsGate3rdPartyConfigured = Boolean(getSmsGate3rdPartyUrl() && String(process.env.SMSGATE_USERNAME || '').trim() && String(process.env.SMSGATE_PASSWORD || '').trim());
    const twilioConfigured = Boolean(String(process.env.TWILIO_ACCOUNT_SID || '').trim() && String(process.env.TWILIO_AUTH_TOKEN || '').trim() && String(process.env.TWILIO_FROM_NUMBER || '').trim());
    return {
        textbee: textBeeConfigured,
        smsgateLocal: smsGateLocalConfigured,
        smsgate3rdParty: smsGate3rdPartyConfigured,
        twilio: twilioConfigured
    };
}

function normalizePhoneE164(phone) {
    const raw = String(phone || '').trim();
    if (!raw) return '';
    if (raw.startsWith('+')) return raw.replace(/[^\d+]/g, '');
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits) return '';
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
    return `+${digits}`;
}

function applySenderNameToMessage(message) {
    const text = String(message || '').trim();
    const sender = String(SMS_SENDER_NAME || '').trim();
    if (!text || !sender) return text;
    if (text.toLowerCase().startsWith(sender.toLowerCase())) return text;
    return `${sender}: ${text}`;
}

function twilioRequest(accountSid, authToken, method, path, form) {
    return new Promise((resolve, reject) => {
        const body = form instanceof URLSearchParams ? form.toString() : String(form || '');
        const options = {
            hostname: 'api.twilio.com',
            port: 443,
            path,
            method,
            headers: {
                'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
                if (!ok) {
                    return reject(new Error(`Twilio error ${res.statusCode}: ${data}`));
                }
                resolve(data);
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function httpRequest(urlString, { method, headers, body }) {
    return new Promise((resolve, reject) => {
        const u = new URL(urlString);
        const isHttps = u.protocol === 'https:';
        const lib = isHttps ? https : http;

        const opts = {
            protocol: u.protocol,
            hostname: u.hostname,
            port: u.port ? Number(u.port) : (isHttps ? 443 : 80),
            path: `${u.pathname}${u.search || ''}`,
            method: method || 'GET',
            headers: headers || {}
        };

        const req = lib.request(opts, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve({ statusCode: res.statusCode || 0, body: data }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

function getTextBeeSendUrl(deviceId) {
    const base = String(process.env.TEXTBEE_BASE_URL || 'https://api.textbee.dev').trim().replace(/\/+$/, '');
    return `${base}/api/v1/gateway/devices/${encodeURIComponent(String(deviceId || '').trim())}/send-sms`;
}

async function sendViaTextBee({ to, message }) {
    const apiKey = String(process.env.TEXTBEE_API_KEY || '').trim();
    const deviceId = String(process.env.TEXTBEE_DEVICE_ID || '').trim();

    if (!apiKey || !deviceId) return { ok: false, error: 'Missing TEXTBEE_API_KEY / TEXTBEE_DEVICE_ID' };

    const target = normalizePhoneE164(to);
    const text = String(message || '').trim();
    if (!target || !text) return { ok: false, error: 'Missing to or message' };

    const url = getTextBeeSendUrl(deviceId);
    const body = JSON.stringify({
        recipients: [target],
        message: text
    });

    const resp = await httpRequest(url, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(body)
        },
        body
    });

    const ok = resp.statusCode >= 200 && resp.statusCode < 300;
    if (!ok) return { ok: false, error: `TextBee error ${resp.statusCode}: ${resp.body}` };
    return { ok: true };
}

async function sendViaSmsGateLocal({ to, message }) {
    const baseUrl = String(process.env.SMSGATE_DEVICE_URL || '').trim();
    const username = String(process.env.SMSGATE_USERNAME || '').trim();
    const password = String(process.env.SMSGATE_PASSWORD || '').trim();

    if (!baseUrl || !username || !password) return { ok: false, error: 'Missing SMSGATE_DEVICE_URL / SMSGATE_USERNAME / SMSGATE_PASSWORD' };

    const target = normalizePhoneE164(to);
    const text = String(message || '').trim();
    if (!target || !text) return { ok: false, error: 'Missing to or message' };

    const url = baseUrl.replace(/\/+$/, '') + '/message';
    const auth = Buffer.from(`${username}:${password}`).toString('base64');
    const body = JSON.stringify({
        textMessage: { text },
        phoneNumbers: [target]
    });

    const resp = await httpRequest(url, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(body)
        },
        body
    });

    const ok = resp.statusCode >= 200 && resp.statusCode < 300;
    if (!ok) return { ok: false, error: `SMSGate local error ${resp.statusCode}: ${resp.body}` };
    return { ok: true };
}

function getSmsGate3rdPartyUrl() {
    const full = String(process.env.SMSGATE_3RDPARTY_URL || '').trim();
    if (full) return full;
    const base = String(process.env.SMSGATE_BASE_URL || '').trim();
    if (!base) return '';
    return base.replace(/\/+$/, '') + '/3rdparty/v1/messages?skipPhoneValidation=true';
}

async function sendViaSmsGate3rdParty({ to, message }) {
    const url = getSmsGate3rdPartyUrl();
    const username = String(process.env.SMSGATE_USERNAME || '').trim();
    const password = String(process.env.SMSGATE_PASSWORD || '').trim();

    if (!url || !username || !password) {
        return { ok: false, error: 'Missing SMSGATE_3RDPARTY_URL or SMSGATE_BASE_URL / SMSGATE_USERNAME / SMSGATE_PASSWORD' };
    }

    const target = normalizePhoneE164(to);
    const text = String(message || '').trim();
    if (!target || !text) return { ok: false, error: 'Missing to or message' };

    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    const payload = {
        textMessage: { text },
        phoneNumbers: [target]
    };

    const simNumberRaw = Number(process.env.SMSGATE_SIM_NUMBER);
    if (Number.isFinite(simNumberRaw) && simNumberRaw > 0) payload.simNumber = Math.floor(simNumberRaw);

    const ttlRaw = Number(process.env.SMSGATE_TTL_SECONDS);
    if (Number.isFinite(ttlRaw) && ttlRaw > 0) payload.ttl = Math.floor(ttlRaw);

    const priorityRaw = Number(process.env.SMSGATE_PRIORITY);
    if (Number.isFinite(priorityRaw)) payload.priority = Math.max(-128, Math.min(127, Math.floor(priorityRaw)));

    const body = JSON.stringify(payload);

    const resp = await httpRequest(url, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(body)
        },
        body
    });

    const ok = resp.statusCode >= 200 && resp.statusCode < 300;
    if (!ok) return { ok: false, error: `SMSGate 3rdparty error ${resp.statusCode}: ${resp.body}` };
    return { ok: true };
}

async function sendViaTwilio({ to, message }) {
    const accountSid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
    const authToken = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
    const from = String(process.env.TWILIO_FROM_NUMBER || '').trim();

    if (!accountSid || !authToken || !from) {
        return { ok: false, error: 'Missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER' };
    }

    const target = normalizePhoneE164(to);
    const bodyText = String(message || '').trim();
    if (!target || !bodyText) return { ok: false, error: 'Missing to or message' };

    const form = new URLSearchParams();
    form.set('From', from);
    form.set('To', target);
    form.set('Body', bodyText);

    await twilioRequest(accountSid, authToken, 'POST', `/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, form);
    return { ok: true };
}

async function handleSendSms(req, res) {
    let payload;
    try {
        payload = await readJson(req);
    } catch (e) {
        return sendJson(res, 400, { ok: false, error: 'Invalid JSON' });
    }

    try {
        const to = payload && payload.to;
        const message = applySenderNameToMessage(payload && payload.message);

        const providers = getProviderStatus();
        const anyProviderConfigured = providers.textbee || providers.smsgateLocal || providers.smsgate3rdParty || providers.twilio;
        if (!anyProviderConfigured) {
            return sendJson(res, 503, {
                ok: false,
                error: 'No SMS provider configured. Set TEXTBEE_API_KEY + TEXTBEE_DEVICE_ID (or SMSGATE_* / TWILIO_*).',
                providers
            });
        }

        const result = providers.textbee
            ? await sendViaTextBee({ to, message })
            : (providers.smsgateLocal
                ? await sendViaSmsGateLocal({ to, message })
                : (providers.smsgate3rdParty ? await sendViaSmsGate3rdParty({ to, message }) : await sendViaTwilio({ to, message })));

        if (result && result.ok) return sendJson(res, 200, { ok: true });
        return sendJson(res, 500, { ok: false, error: result && result.error ? result.error : 'Send failed' });
    } catch (e) {
        return sendJson(res, 502, { ok: false, error: String(e && e.message ? e.message : e) });
    }
}

// --- Scheduler Logic ---

async function sendSmsInternal(to, message) {
    const providers = getProviderStatus();
    const anyProviderConfigured = providers.textbee || providers.smsgateLocal || providers.smsgate3rdParty || providers.twilio;
    if (!anyProviderConfigured) {
        return { ok: false, error: 'No SMS provider configured' };
    }
    const msg = applySenderNameToMessage(message);
    
    if (providers.textbee) return sendViaTextBee({ to, message: msg });
    if (providers.smsgateLocal) return sendViaSmsGateLocal({ to, message: msg });
    if (providers.smsgate3rdParty) return sendViaSmsGate3rdParty({ to, message: msg });
    return sendViaTwilio({ to, message: msg });
}

// Canonical Team Members List
const teamMembers = [
    { id: 'tm001', name: 'Mr. Divyansh Gupta', email: 'divyansh.gupta@apexcircle.com', position: 'Team Leader' },
    { id: 'tm002', name: 'Anurag Sangar', email: 'anurag.sangar@apexcircle.com', position: 'Registration Management' },
    { id: 'tm003', name: 'Miss Palak', email: 'palak@apexcircle.com', position: 'Guest Management' },
    { id: 'tm004', name: 'Aman Yadav', email: 'aman.yadav@apexcircle.com', position: 'Social Media & PR' },
    { id: 'tm005', name: 'Aarti Yadav', email: 'aarti.yadav@apexcircle.com', position: 'Host & Anchor' },
    { id: 'tm006', name: 'Prince Jangra', email: 'prince.jangra@apexcircle.com', position: 'Event Coordinator' },
    { id: 'tm007', name: 'Naman Singh', email: 'naman.singh@apexcircle.com', position: 'Social Media & PR' },
    { id: 'tm008', name: 'Drishti Pathak', email: 'drishti.pathak@apexcircle.com', position: 'Creative Team Head' },
    { id: 'tm009', name: 'Deepti', email: 'deepti@apexcircle.com', position: 'Stage Coordinator' }
];

async function processScheduledTasks() {
    try {
        const now = new Date();
        const nowIso = now.toISOString();
        const todayStr = nowIso.split('T')[0];
        const dayOfWeek = now.getDay(); // 0=Sun

        let schedules = [];
        
        // 1. Fetch Schedules
        if (pool) {
             const resp = await dbQuery('SELECT * FROM team_scheduled_tasks');
             if (resp.ok && Array.isArray(resp.rows)) {
                 schedules = resp.rows;
             }
        } else {
             if (fs.existsSync(SCHEDULED_TASKS_FILE)) {
                 const raw = fs.readFileSync(SCHEDULED_TASKS_FILE, 'utf8');
                 schedules = JSON.parse(raw || '[]');
             }
        }

        if (!schedules.length) return;
        let creations = 0;

        for (const sch of schedules) {
            if (sch.isActive === false) continue;
            // Check if already generated today
            if (sch.lastGenerated === todayStr) continue; 

            let shouldGenerate = false;
            let taskTitle = sch.title;
            let taskDesc = sch.description;

            // Determine if we should generate based on recurrence
            if (sch.recurrence === 'weekly-mon-fri') {
                if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                    shouldGenerate = true;
                    // Daily Variations logic if needed
                    if (sch.dailyVariations && sch.dailyVariations[dayOfWeek]) {
                        taskTitle = sch.dailyVariations[dayOfWeek].title || taskTitle;
                        taskDesc = sch.dailyVariations[dayOfWeek].description || taskDesc;
                    }
                }
            } else if (sch.recurrence === 'daily') {
                shouldGenerate = true;
            } else if (sch.recurrence === 'one-time' && sch.scheduledAt) {
                // Legacy support for one-time scheduled tasks
                const scheduledDate = new Date(sch.scheduledAt).toISOString().split('T')[0];
                if (scheduledDate <= todayStr && sch.status === 'pending') {
                    shouldGenerate = true;
                }
            }

            if (shouldGenerate) {
                console.log(`Generating tasks for schedule: ${sch.title}`);
                // Generate Task
                const members = sch.memberId === 'all' ? teamMembers : [teamMembers.find(m => m.id === sch.memberId)].filter(Boolean);
                
                for (const member of members) {
                    const newTask = {
                        id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        title: taskTitle,
                        description: taskDesc,
                        memberId: member.id,
                        eventName: sch.eventName,
                        dueDate: sch.recurrence === 'one-time' && sch.dueDate ? sch.dueDate : todayStr,
                        status: 'pending',
                        createdAt: nowIso,
                        updatedAt: nowIso,
                        originScheduleId: sch.id,
                        autoExtend: sch.autoExtend || false,
                        rewardAmount: sch.rewardAmount
                    };

                    // Save Task
                    if (pool) {
                        const fields = Object.keys(newTask);
                        const values = Object.values(newTask);
                        const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
                        const sql = `INSERT INTO team_tasks (${fields.join(', ')}) VALUES (${placeholders})`;
                        await dbQuery(sql, values);
                    } else {
                        let list = [];
                        if (fs.existsSync(TASKS_FILE)) {
                            list = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8') || '[]');
                        }
                        list.push(newTask);
                        fs.writeFileSync(TASKS_FILE, JSON.stringify(list));
                    }
                    creations++;
                    
                    // Send SMS (Optional)
                    if (member.phone || sch.memberPhone) {
                         const phone = member.phone || sch.memberPhone;
                         // const smsBody = `New Task: ${newTask.title}\nCheck Team Portal.`;
                         // await sendSmsInternal(phone, smsBody);
                    }
                }

                // Update Schedule lastGenerated (and status if one-time)
                const updateData = { lastGenerated: todayStr };
                if (sch.recurrence === 'one-time') updateData.status = 'completed';

                if (pool) {
                    const keys = Object.keys(updateData).map(k => `"${k}" = $${Object.keys(updateData).indexOf(k) + 2}`).join(', ');
                    const vals = Object.values(updateData);
                    await dbQuery(`UPDATE team_scheduled_tasks SET ${keys} WHERE id = $1`, [sch.id, ...vals]);
                } else {
                    let list = JSON.parse(fs.readFileSync(SCHEDULED_TASKS_FILE, 'utf8') || '[]');
                    const idx = list.findIndex(t => t.id === sch.id);
                    if (idx !== -1) {
                        list[idx] = { ...list[idx], ...updateData };
                        fs.writeFileSync(SCHEDULED_TASKS_FILE, JSON.stringify(list));
                    }
                }
            }
        }
        
        if (creations > 0) {
            console.log(`Generated ${creations} tasks from schedules.`);
        }

    } catch (e) {
        console.error('Error processing scheduled tasks:', e);
    }
}

// Run scheduler every 60 seconds
setInterval(processScheduledTasks, 60 * 1000);

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.woff': 'application/font-woff',
    '.ttf': 'application/font-ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.otf': 'application/font-otf',
    '.wasm': 'application/wasm'
};

http.createServer(async (req, res) => {
    const urlStr = req.url || '/';
    console.log(`request ${urlStr}`);
    
    // Parse URL to check for API calls
    const u = new URL(urlStr, `http://${req.headers.host || 'localhost'}`);
    
    // API Handling
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS, PUT, PATCH',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, Access-Control-Request-Private-Network',
            'Access-Control-Allow-Private-Network': 'true'
        });
        return res.end();
    }

    if (req.method === 'GET' && u.pathname === '/api/health') {
        const providers = getProviderStatus();
        return sendJson(res, 200, {
            ok: true,
            port: PORT,
            senderName: SMS_SENDER_NAME,
            providers
        });
    }

    if (req.method === 'POST' && (u.pathname === '/api/sms' || u.pathname === '/.netlify/functions/sms')) {
        if (SMS_SERVER_API_KEY) {
            const key = String(req.headers['x-api-key'] || '').trim();
            if (key !== SMS_SERVER_API_KEY) return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
        }
        return handleSendSms(req, res);
    }

    if (req.method === 'GET' && u.pathname === '/api/team_tasks') {
        try {
            if (pool) {
                const resDb = await dbQuery('SELECT * FROM team_tasks ORDER BY "createdAt" DESC');
                return sendJson(res, resDb.ok ? 200 : 500, { ok: resDb.ok, tasks: resDb.rows || [] });
            }
            let list = [];
            if (fs.existsSync(TASKS_FILE)) {
                const raw = fs.readFileSync(TASKS_FILE, 'utf8');
                const parsed = JSON.parse(raw || '[]');
                list = Array.isArray(parsed) ? parsed : [];
            }
            return sendJson(res, 200, { ok: true, tasks: list });
        } catch (e) {
            return sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
        }
    }


    // --- Scheduled Tasks Endpoints ---
    if (req.method === 'GET' && u.pathname === '/api/scheduled_tasks') {
        try {
            if (pool) {
                const resp = await dbQuery('SELECT * FROM team_scheduled_tasks ORDER BY "createdAt" DESC');
                return sendJson(res, resp.ok ? 200 : 500, { ok: resp.ok, tasks: resp.rows || [] });
            }
            let list = [];
            if (fs.existsSync(SCHEDULED_TASKS_FILE)) {
                const raw = fs.readFileSync(SCHEDULED_TASKS_FILE, 'utf8');
                const parsed = JSON.parse(raw || '[]');
                list = Array.isArray(parsed) ? parsed : [];
            }
            return sendJson(res, 200, { ok: true, tasks: list });
        } catch (e) {
            return sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
        }
    }

    if (req.method === 'POST' && u.pathname === '/api/scheduled_tasks') {
        try {
            const body = await readJson(req);
            if (pool) {
                if (!body.id) throw new Error('Task ID required');
                const check = await dbQuery('SELECT id FROM team_scheduled_tasks WHERE id = $1', [body.id]);
                const exists = check.ok && check.rows.length > 0;
                
                if (exists) {
                     const keys = Object.keys(body).map(k => `"${k}" = $${Object.keys(body).indexOf(k) + 2}`).join(', ');
                     const vals = Object.values(body);
                     const update = await dbQuery(`UPDATE team_scheduled_tasks SET ${keys} WHERE id = $1 RETURNING *`, [body.id, ...vals]);
                     return sendJson(res, update.ok ? 200 : 500, { ok: update.ok, task: update.rows ? update.rows[0] : null });
                } else {
                     const keys = Object.keys(body).map(k => `"${k}"`).join(', ');
                     const vals = Object.values(body);
                     const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
                     const insert = await dbQuery(`INSERT INTO team_scheduled_tasks (${keys}) VALUES (${placeholders}) RETURNING *`, vals);
                     return sendJson(res, insert.ok ? 200 : 500, { ok: insert.ok, task: insert.rows ? insert.rows[0] : null });
                }
            }

            const next = body && typeof body === 'object' ? body : {};
            let list = [];
            if (fs.existsSync(SCHEDULED_TASKS_FILE)) {
                const raw = fs.readFileSync(SCHEDULED_TASKS_FILE, 'utf8');
                const parsed = JSON.parse(raw || '[]');
                list = Array.isArray(parsed) ? parsed : [];
            }
            const id = String(next.id || '').trim() || ('sch_task_' + Date.now());
            const nowIso = new Date().toISOString();
            const idx = list.findIndex(t => String(t && t.id) === id);
            
            // Default fields for new tasks
            const defaults = idx === -1 ? {
                status: 'pending',
                createdAt: nowIso
            } : {};

            const payload = {
                ...defaults,
                ...list[idx] || {},
                ...next,
                id,
                updatedAt: nowIso
            };
            if (idx === -1) list.push(payload);
            else list[idx] = payload;
            fs.writeFileSync(SCHEDULED_TASKS_FILE, JSON.stringify(list));
            return sendJson(res, 200, { ok: true, task: payload });
        } catch (e) {
            return sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
        }
    }

    if (req.method === 'DELETE' && u.pathname === '/api/scheduled_tasks') {
        try {
            const id = u.searchParams.get('id');
            if (!id) return sendJson(res, 400, { ok: false, error: 'Missing query: provide id' });

            if (pool) {
                const del = await dbQuery('DELETE FROM team_scheduled_tasks WHERE id = $1', [id]);
                return sendJson(res, del.ok ? 200 : 500, { ok: del.ok });
            }

            let list = [];
            if (fs.existsSync(SCHEDULED_TASKS_FILE)) {
                const raw = fs.readFileSync(SCHEDULED_TASKS_FILE, 'utf8');
                const parsed = JSON.parse(raw || '[]');
                list = Array.isArray(parsed) ? parsed : [];
            }
            list = list.filter(t => String(t && t.id) !== String(id));
            fs.writeFileSync(SCHEDULED_TASKS_FILE, JSON.stringify(list));
            return sendJson(res, 200, { ok: true });
        } catch (e) {
            return sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
        }
    }
    // --- End Scheduled Tasks Endpoints ---

    if (req.method === 'POST' && u.pathname === '/api/team_tasks') {
        try {
            const body = await readJson(req);
            if (pool) {
                if (!body.id) throw new Error('Task ID required');
                const check = await dbQuery('SELECT id FROM team_tasks WHERE id = $1', [body.id]);
                const exists = check.ok && check.rows.length > 0;
                
                if (exists) {
                    const keys = Object.keys(body).map(k => `"${k}" = $${Object.keys(body).indexOf(k) + 2}`).join(', ');
                    const vals = Object.values(body);
                    const update = await dbQuery(`UPDATE team_tasks SET ${keys} WHERE id = $1 RETURNING *`, [body.id, ...vals]);
                    return sendJson(res, update.ok ? 200 : 500, { ok: update.ok, task: update.rows ? update.rows[0] : null });
                } else {
                    const keys = Object.keys(body).map(k => `"${k}"`).join(', ');
                    const vals = Object.values(body);
                    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
                    const insert = await dbQuery(`INSERT INTO team_tasks (${keys}) VALUES (${placeholders}) RETURNING *`, vals);
                    return sendJson(res, insert.ok ? 200 : 500, { ok: insert.ok, task: insert.rows ? insert.rows[0] : null });
                }
            }

            const next = body && typeof body === 'object' ? body : {};
            let list = [];
            if (fs.existsSync(TASKS_FILE)) {
                const raw = fs.readFileSync(TASKS_FILE, 'utf8');
                const parsed = JSON.parse(raw || '[]');
                list = Array.isArray(parsed) ? parsed : [];
            }
            const id = String(next.id || '').trim() || ('task_' + Date.now());
            const nowIso = new Date().toISOString();
            const idx = list.findIndex(t => String(t && t.id) === id);
            const payload = {
                ...list[idx] || {},
                ...next,
                id,
                updatedAt: nowIso,
                createdAt: list[idx] && list[idx].createdAt ? list[idx].createdAt : (next.createdAt || nowIso)
            };
            if (idx === -1) list.push(payload);
            else list[idx] = payload;
            fs.writeFileSync(TASKS_FILE, JSON.stringify(list));
            return sendJson(res, 200, { ok: true, task: payload });
        } catch (e) {
            return sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
        }
    }

    if (req.method === 'DELETE' && u.pathname === '/api/team_tasks') {
        try {
            const id = u.searchParams.get('id');
            if (!id) {
                return sendJson(res, 400, { ok: false, error: 'Missing query: provide id' });
            }

            if (pool) {
                const del = await dbQuery('DELETE FROM team_tasks WHERE id = $1', [id]);
                return sendJson(res, del.ok ? 200 : 500, { ok: del.ok });
            }

            let list = [];
            if (fs.existsSync(TASKS_FILE)) {
                const raw = fs.readFileSync(TASKS_FILE, 'utf8');
                const parsed = JSON.parse(raw || '[]');
                list = Array.isArray(parsed) ? parsed : [];
            }
            list = list.filter(t => String(t && t.id) !== String(id));
            fs.writeFileSync(TASKS_FILE, JSON.stringify(list));
            return sendJson(res, 200, { ok: true });
        } catch (e) {
            return sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
        }
    }

    if (req.method === 'POST' && u.pathname === '/api/team_tasks/delete') {
        try {
            const body = await readJson(req);
            const id = String(body && body.id ? body.id : '').trim();
            if (!id) return sendJson(res, 400, { ok: false, error: 'Missing id' });
            if (pool) {
                const del = await dbQuery('DELETE FROM team_tasks WHERE id = $1', [id]);
                return sendJson(res, del.ok ? 200 : 500, { ok: del.ok });
            }
            let list = [];
            if (fs.existsSync(TASKS_FILE)) {
                const raw = fs.readFileSync(TASKS_FILE, 'utf8');
                const parsed = JSON.parse(raw || '[]');
                list = Array.isArray(parsed) ? parsed : [];
            }
            list = list.filter(t => String(t && t.id) !== String(id));
            fs.writeFileSync(TASKS_FILE, JSON.stringify(list));
            return sendJson(res, 200, { ok: true });
        } catch (e) {
            return sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
        }
    }

    if (req.method === 'GET' && u.pathname === '/api/team_rewards') {
        try {
            if (pool) {
                const resDb = await dbQuery('SELECT * FROM team_rewards');
                return sendJson(res, resDb.ok ? 200 : 500, { ok: resDb.ok, rewards: resDb.rows || [] });
            }
            let list = [];
            if (fs.existsSync(REWARDS_FILE)) {
                const raw = fs.readFileSync(REWARDS_FILE, 'utf8');
                const parsed = JSON.parse(raw || '[]');
                list = Array.isArray(parsed) ? parsed : [];
            }
            return sendJson(res, 200, { ok: true, rewards: list });
        } catch (e) {
            return sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
        }
    }

    if (req.method === 'POST' && u.pathname === '/api/team_rewards') {
        try {
            const body = await readJson(req);
            if (pool) {
                if (!body.id) throw new Error('Reward ID required');
                const check = await dbQuery('SELECT id FROM team_rewards WHERE id = $1', [body.id]);
                const exists = check.ok && check.rows.length > 0;
                
                if (exists) {
                    const keys = Object.keys(body).map(k => `"${k}" = $${Object.keys(body).indexOf(k) + 2}`).join(', ');
                    const vals = Object.values(body);
                    const update = await dbQuery(`UPDATE team_rewards SET ${keys} WHERE id = $1 RETURNING *`, [body.id, ...vals]);
                    return sendJson(res, update.ok ? 200 : 500, { ok: update.ok, reward: update.rows ? update.rows[0] : null });
                } else {
                    const keys = Object.keys(body).map(k => `"${k}"`).join(', ');
                    const vals = Object.values(body);
                    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
                    const insert = await dbQuery(`INSERT INTO team_rewards (${keys}) VALUES (${placeholders}) RETURNING *`, vals);
                    return sendJson(res, insert.ok ? 200 : 500, { ok: insert.ok, reward: insert.rows ? insert.rows[0] : null });
                }
            }

            const next = body && typeof body === 'object' ? body : {};
            let list = [];
            if (fs.existsSync(REWARDS_FILE)) {
                const raw = fs.readFileSync(REWARDS_FILE, 'utf8');
                const parsed = JSON.parse(raw || '[]');
                list = Array.isArray(parsed) ? parsed : [];
            }
            const id = String(next.id || '').trim() || ('reward_' + Date.now());
            const nowIso = new Date().toISOString();
            const idx = list.findIndex(r => String(r && r.id) === id);
            const payload = {
                ...list[idx] || {},
                ...next,
                id,
                updatedAt: nowIso,
                createdAt: list[idx] && list[idx].createdAt ? list[idx].createdAt : (next.createdAt || nowIso)
            };
            if (idx === -1) list.push(payload);
            else list[idx] = payload;
            fs.writeFileSync(REWARDS_FILE, JSON.stringify(list));
            return sendJson(res, 200, { ok: true, reward: payload });
        } catch (e) {
            return sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
        }
    }

    if (req.method === 'DELETE' && u.pathname === '/api/team_rewards') {
        try {
            const all = u.searchParams.get('all');
            const taskId = u.searchParams.get('taskId');
            if (pool) {
                if (all === 'true') {
                    const del = await dbQuery('DELETE FROM team_rewards');
                    return sendJson(res, del.ok ? 200 : 500, { ok: del.ok });
                } else if (taskId) {
                    const del = await dbQuery('DELETE FROM team_rewards WHERE "taskId" = $1', [taskId]);
                    return sendJson(res, del.ok ? 200 : 500, { ok: del.ok });
                } else {
                    return sendJson(res, 400, { ok: false, error: 'Missing query: provide all=true or taskId' });
                }
            }
            let list = [];
            if (fs.existsSync(REWARDS_FILE)) {
                const raw = fs.readFileSync(REWARDS_FILE, 'utf8');
                const parsed = JSON.parse(raw || '[]');
                list = Array.isArray(parsed) ? parsed : [];
            }
            if (all === 'true') {
                list = [];
            } else if (taskId) {
                list = list.filter(r => String(r && r.taskId) !== String(taskId));
            } else {
                return sendJson(res, 400, { ok: false, error: 'Missing query: provide all=true or taskId' });
            }
            fs.writeFileSync(REWARDS_FILE, JSON.stringify(list));
            return sendJson(res, 200, { ok: true });
        } catch (e) {
            return sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
        }
    }

    if (req.method === 'GET' && u.pathname === '/api/team_training_videos') {
        try {
            if (pool) {
                const resDb = await dbQuery('SELECT * FROM team_training_videos');
                return sendJson(res, resDb.ok ? 200 : 500, { ok: resDb.ok, videos: resDb.rows || [] });
            }
            let list = [];
            if (fs.existsSync(TRAINING_VIDEOS_FILE)) {
                const raw = fs.readFileSync(TRAINING_VIDEOS_FILE, 'utf8');
                const parsed = JSON.parse(raw || '[]');
                list = Array.isArray(parsed) ? parsed : [];
            }
            return sendJson(res, 200, { ok: true, videos: list });
        } catch (e) {
            return sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
        }
    }

    if (req.method === 'POST' && u.pathname === '/api/team_training_videos') {
        try {
            const body = await readJson(req);
            if (pool) {
                if (!body.id) throw new Error('Video ID required');
                const check = await dbQuery('SELECT id FROM team_training_videos WHERE id = $1', [body.id]);
                const exists = check.ok && check.rows.length > 0;
                
                if (exists) {
                    const keys = Object.keys(body).map(k => `"${k}" = $${Object.keys(body).indexOf(k) + 2}`).join(', ');
                    const vals = Object.values(body);
                    const update = await dbQuery(`UPDATE team_training_videos SET ${keys} WHERE id = $1 RETURNING *`, [body.id, ...vals]);
                    return sendJson(res, update.ok ? 200 : 500, { ok: update.ok, video: update.rows ? update.rows[0] : null });
                } else {
                    const keys = Object.keys(body).map(k => `"${k}"`).join(', ');
                    const vals = Object.values(body);
                    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
                    const insert = await dbQuery(`INSERT INTO team_training_videos (${keys}) VALUES (${placeholders}) RETURNING *`, vals);
                    return sendJson(res, insert.ok ? 200 : 500, { ok: insert.ok, video: insert.rows ? insert.rows[0] : null });
                }
            }

            const next = body && typeof body === 'object' ? body : {};
            let list = [];
            if (fs.existsSync(TRAINING_VIDEOS_FILE)) {
                const raw = fs.readFileSync(TRAINING_VIDEOS_FILE, 'utf8');
                const parsed = JSON.parse(raw || '[]');
                list = Array.isArray(parsed) ? parsed : [];
            }
            const id = String(next.id || '').trim() || ('video_' + Date.now());
            const nowIso = new Date().toISOString();
            const idx = list.findIndex(v => String(v && v.id) === id);
            const payload = {
                ...list[idx] || {},
                ...next,
                id,
                updatedAt: nowIso,
                createdAt: list[idx] && list[idx].createdAt ? list[idx].createdAt : (next.createdAt || nowIso)
            };
            if (idx === -1) list.push(payload);
            else list[idx] = payload;
            fs.writeFileSync(TRAINING_VIDEOS_FILE, JSON.stringify(list));
            return sendJson(res, 200, { ok: true, video: payload });
        } catch (e) {
            return sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
        }
    }

    if (req.method === 'DELETE' && u.pathname === '/api/team_training_videos') {
        try {
            const id = u.searchParams.get('id');
            if (!id) return sendJson(res, 400, { ok: false, error: 'Missing query: provide id' });

            if (pool) {
                const del = await dbQuery('DELETE FROM team_training_videos WHERE id = $1', [id]);
                return sendJson(res, del.ok ? 200 : 500, { ok: del.ok });
            }

            let list = [];
            if (fs.existsSync(TRAINING_VIDEOS_FILE)) {
                const raw = fs.readFileSync(TRAINING_VIDEOS_FILE, 'utf8');
                const parsed = JSON.parse(raw || '[]');
                list = Array.isArray(parsed) ? parsed : [];
            }
            list = list.filter(v => String(v && v.id) !== String(id));
            fs.writeFileSync(TRAINING_VIDEOS_FILE, JSON.stringify(list));
            return sendJson(res, 200, { ok: true });
        } catch (e) {
            return sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
        }
    }

    // --- Team Updates (Events) ---
    if (req.method === 'GET' && u.pathname === '/api/team_updates') {
        try {
            if (pool) {
                const resDb = await dbQuery('SELECT * FROM team_updates ORDER BY "date" ASC');
                return sendJson(res, resDb.ok ? 200 : 500, { ok: resDb.ok, updates: resDb.rows || [] });
            }
            let list = [];
            if (fs.existsSync(UPDATES_FILE)) {
                const raw = fs.readFileSync(UPDATES_FILE, 'utf8');
                const parsed = JSON.parse(raw || '[]');
                list = Array.isArray(parsed) ? parsed : [];
            }
            return sendJson(res, 200, { ok: true, updates: list });
        } catch (e) {
            return sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
        }
    }

    if (req.method === 'POST' && u.pathname === '/api/team_updates') {
        try {
            const body = await readJson(req);
            if (pool) {
                if (!body.id) throw new Error('Update ID required');
                const check = await dbQuery('SELECT id FROM team_updates WHERE id = $1', [body.id]);
                const exists = check.ok && check.rows.length > 0;
                
                if (exists) {
                    const keys = Object.keys(body).map(k => `"${k}" = $${Object.keys(body).indexOf(k) + 2}`).join(', ');
                    const vals = Object.values(body);
                    const update = await dbQuery(`UPDATE team_updates SET ${keys} WHERE id = $1 RETURNING *`, [body.id, ...vals]);
                    return sendJson(res, update.ok ? 200 : 500, { ok: update.ok, update: update.rows ? update.rows[0] : null });
                } else {
                    const keys = Object.keys(body).map(k => `"${k}"`).join(', ');
                    const vals = Object.values(body);
                    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
                    const insert = await dbQuery(`INSERT INTO team_updates (${keys}) VALUES (${placeholders}) RETURNING *`, vals);
                    return sendJson(res, insert.ok ? 200 : 500, { ok: insert.ok, update: insert.rows ? insert.rows[0] : null });
                }
            }

            const next = body && typeof body === 'object' ? body : {};
            let list = [];
            if (fs.existsSync(UPDATES_FILE)) {
                const raw = fs.readFileSync(UPDATES_FILE, 'utf8');
                const parsed = JSON.parse(raw || '[]');
                list = Array.isArray(parsed) ? parsed : [];
            }
            const id = String(next.id || '').trim() || ('update_' + Date.now());
            const nowIso = new Date().toISOString();
            const idx = list.findIndex(u => String(u && u.id) === id);
            const payload = {
                ...list[idx] || {},
                ...next,
                id,
                updatedAt: nowIso,
                createdAt: list[idx] && list[idx].createdAt ? list[idx].createdAt : (next.createdAt || nowIso)
            };
            if (idx === -1) list.push(payload);
            else list[idx] = payload;
            fs.writeFileSync(UPDATES_FILE, JSON.stringify(list));
            return sendJson(res, 200, { ok: true, update: payload });
        } catch (e) {
            return sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
        }
    }

    // --- Team Notifications ---
    if (req.method === 'GET' && u.pathname === '/api/team_notifications') {
        try {
            if (pool) {
                const resDb = await dbQuery('SELECT * FROM team_notifications ORDER BY "createdAt" DESC');
                return sendJson(res, resDb.ok ? 200 : 500, { ok: resDb.ok, notifications: resDb.rows || [] });
            }
            let list = [];
            if (fs.existsSync(NOTIFICATIONS_FILE)) {
                const raw = fs.readFileSync(NOTIFICATIONS_FILE, 'utf8');
                const parsed = JSON.parse(raw || '[]');
                list = Array.isArray(parsed) ? parsed : [];
            }
            return sendJson(res, 200, { ok: true, notifications: list });
        } catch (e) {
            return sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
        }
    }

    if (req.method === 'POST' && u.pathname === '/api/team_notifications') {
        try {
            const body = await readJson(req);
            if (pool) {
                if (!body.id) throw new Error('Notification ID required');
                const check = await dbQuery('SELECT id FROM team_notifications WHERE id = $1', [body.id]);
                const exists = check.ok && check.rows.length > 0;
                
                if (exists) {
                    const keys = Object.keys(body).map(k => `"${k}" = $${Object.keys(body).indexOf(k) + 2}`).join(', ');
                    const vals = Object.values(body);
                    const update = await dbQuery(`UPDATE team_notifications SET ${keys} WHERE id = $1 RETURNING *`, [body.id, ...vals]);
                    return sendJson(res, update.ok ? 200 : 500, { ok: update.ok, notification: update.rows ? update.rows[0] : null });
                } else {
                    const keys = Object.keys(body).map(k => `"${k}"`).join(', ');
                    const vals = Object.values(body);
                    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
                    const insert = await dbQuery(`INSERT INTO team_notifications (${keys}) VALUES (${placeholders}) RETURNING *`, vals);
                    return sendJson(res, insert.ok ? 200 : 500, { ok: insert.ok, notification: insert.rows ? insert.rows[0] : null });
                }
            }

            const next = body && typeof body === 'object' ? body : {};
            let list = [];
            if (fs.existsSync(NOTIFICATIONS_FILE)) {
                const raw = fs.readFileSync(NOTIFICATIONS_FILE, 'utf8');
                const parsed = JSON.parse(raw || '[]');
                list = Array.isArray(parsed) ? parsed : [];
            }
            const id = String(next.id || '').trim() || ('notif_' + Date.now());
            const nowIso = new Date().toISOString();
            const idx = list.findIndex(n => String(n && n.id) === id);
            const payload = {
                ...list[idx] || {},
                ...next,
                id,
                updatedAt: nowIso,
                createdAt: list[idx] && list[idx].createdAt ? list[idx].createdAt : (next.createdAt || nowIso)
            };
            if (idx === -1) list.push(payload);
            else list[idx] = payload;
            fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(list));
            return sendJson(res, 200, { ok: true, notification: payload });
        } catch (e) {
            return sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
        }
    }

    if (u.pathname.startsWith('/api/')) {
        console.log(`API 404 Not Found: ${req.method} ${u.pathname}`);
        return sendJson(res, 404, { ok: false, error: 'Not Found' });
    }

    // Static File Serving
    let filePath = '.' + u.pathname;
    if (filePath.endsWith('/')) {
        filePath += 'index.html';
    }

    console.log('Request for:', filePath);

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.stat(filePath, (err, stats) => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.readFile('./404.html', (error, content) => {
                    if (error) {
                        res.writeHead(404);
                        res.end('404 Not Found');
                    } else {
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.end(content, 'utf-8');
                    }
                });
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + err.code);
            }
            return;
        }

        const fileSize = stats.size;
        const range = req.headers.range;

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(filePath, { start, end });
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': contentType,
            };
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
                'Content-Length': fileSize,
                'Content-Type': contentType,
            };
            res.writeHead(200, head);
            const file = fs.createReadStream(filePath);
            file.pipe(res);
        }
    });

}).listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}/`);
    
    // Log LAN IP
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`Network URL: http://${iface.address}:${PORT}/`);
            }
        }
    }
});
