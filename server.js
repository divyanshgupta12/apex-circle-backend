const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URLSearchParams } = require('url');

const PORT = 8000;
const TASKS_FILE = path.join(__dirname, 'team_tasks.json');
const REWARDS_FILE = path.join(__dirname, 'team_rewards.json');

const NEON_API_URL = process.env.NEON_API_URL || 'https://ep-lively-union-ae21qnok.apirest.c-2.us-east-2.aws.neon.tech/neondb/rest/v1';
const NEON_API_KEY = process.env.NEON_API_KEY;

function neonRequest(method, endpoint, body) {
    return new Promise((resolve, reject) => {
        const u = new URL(NEON_API_URL + endpoint);
        const req = https.request(u, {
            method,
            headers: {
                'Authorization': `Bearer ${NEON_API_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, data: json });
                } catch (e) {
                    resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, data: null });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
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
            if (body.length > 1_000_000) {
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
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Access-Control-Request-Private-Network',
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
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Access-Control-Request-Private-Network',
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
            if (NEON_API_KEY) {
                const resp = await neonRequest('GET', '/team_tasks');
                return sendJson(res, resp.ok ? 200 : 500, { ok: resp.ok, tasks: Array.isArray(resp.data) ? resp.data : [] });
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

    if (req.method === 'POST' && u.pathname === '/api/team_tasks') {
        try {
            const body = await readJson(req);
            if (NEON_API_KEY) {
                if (!body.id) throw new Error('Task ID required');
                const check = await neonRequest('GET', `/team_tasks?id=eq.${body.id}`);
                const exists = check.ok && Array.isArray(check.data) && check.data.length > 0;
                const method = exists ? 'PATCH' : 'POST';
                const endpoint = exists ? `/team_tasks?id=eq.${body.id}` : '/team_tasks';
                const save = await neonRequest(method, endpoint, body);
                return sendJson(res, save.ok ? 200 : 500, { ok: save.ok, task: Array.isArray(save.data) ? save.data[0] : save.data });
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

    if (req.method === 'GET' && u.pathname === '/api/team_rewards') {
        try {
            if (NEON_API_KEY) {
                const resp = await neonRequest('GET', '/team_rewards');
                return sendJson(res, resp.ok ? 200 : 500, { ok: resp.ok, rewards: Array.isArray(resp.data) ? resp.data : [] });
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
            if (NEON_API_KEY) {
                if (!body.id) throw new Error('Reward ID required');
                const check = await neonRequest('GET', `/team_rewards?id=eq.${body.id}`);
                const exists = check.ok && Array.isArray(check.data) && check.data.length > 0;
                const method = exists ? 'PATCH' : 'POST';
                const endpoint = exists ? `/team_rewards?id=eq.${body.id}` : '/team_rewards';
                const save = await neonRequest(method, endpoint, body);
                return sendJson(res, save.ok ? 200 : 500, { ok: save.ok, reward: Array.isArray(save.data) ? save.data[0] : save.data });
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

    // Static File Serving
    let filePath = '.' + u.pathname;
    if (filePath.endsWith('/')) {
        filePath += 'index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
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
                res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });

}).listen(PORT);

console.log(`Server running at http://localhost:${PORT}/`);
