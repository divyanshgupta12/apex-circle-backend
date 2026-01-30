const https = require('https');
const { URLSearchParams } = require('url');

// Configuration Defaults (Fallback if env vars are missing)
const CONFIG = {
    SMS_SERVER_API_KEY: process.env.SMS_SERVER_API_KEY || "apex_local_key",
    TEXTBEE_API_KEY: process.env.TEXTBEE_API_KEY || "71fd5d16-5ad4-404f-92fc-a761fcfd80bc",
    TEXTBEE_DEVICE_ID: process.env.TEXTBEE_DEVICE_ID || "6952d9b68a8761ab1a3f0924",
    SMS_SENDER_NAME: process.env.SMS_SENDER_NAME || "The Apex Circle"
};

// --- Helper Functions ---

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
    const sender = String(CONFIG.SMS_SENDER_NAME || '').trim();
    if (!text || !sender) return text;
    if (text.toLowerCase().startsWith(sender.toLowerCase())) return text;
    return `${sender}: ${text}`;
}

function httpRequest(urlString, { method, headers, body }) {
    return new Promise((resolve, reject) => {
        const u = new URL(urlString);
        const options = {
            hostname: u.hostname,
            port: u.port || 443,
            path: `${u.pathname}${u.search || ''}`,
            method: method || 'GET',
            headers: headers || {}
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve({ statusCode: res.statusCode || 0, body: data }));
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

// --- Provider Logic ---

function getTextBeeSendUrl(deviceId) {
    const base = String(process.env.TEXTBEE_BASE_URL || 'https://api.textbee.dev').trim().replace(/\/+$/, '');
    return `${base}/api/v1/gateway/devices/${encodeURIComponent(String(deviceId || '').trim())}/send-sms`;
}

async function sendViaTextBee({ to, message }) {
    const apiKey = String(CONFIG.TEXTBEE_API_KEY || '').trim();
    const deviceId = String(CONFIG.TEXTBEE_DEVICE_ID || '').trim();

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

// --- Main Handler ---

exports.handler = async function(event, context) {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ ok: false, error: 'Method Not Allowed' })
        };
    }

    // Check API Key
    const headers = event.headers || {};
    // Headers are sometimes lowercase in Netlify
    const clientKey = headers['x-api-key'] || headers['X-Api-Key'];
    
    if (CONFIG.SMS_SERVER_API_KEY && clientKey !== CONFIG.SMS_SERVER_API_KEY) {
        return {
            statusCode: 401,
            body: JSON.stringify({ ok: false, error: 'Unauthorized' })
        };
    }

    // Parse Body
    let payload;
    try {
        payload = JSON.parse(event.body);
    } catch (e) {
        return {
            statusCode: 400,
            body: JSON.stringify({ ok: false, error: 'Invalid JSON' })
        };
    }

    const to = payload.to;
    const message = applySenderNameToMessage(payload.message);

    try {
        // Use TextBee (Default for this project)
        // Add other providers here if needed, mirroring server.js logic
        const result = await sendViaTextBee({ to, message });

        if (result.ok) {
            return {
                statusCode: 200,
                body: JSON.stringify({ ok: true })
            };
        } else {
            return {
                statusCode: 500,
                body: JSON.stringify({ ok: false, error: result.error })
            };
        }
    } catch (e) {
        return {
            statusCode: 502,
            body: JSON.stringify({ ok: false, error: e.message })
        };
    }
};
