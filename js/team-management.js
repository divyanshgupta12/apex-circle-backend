﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿/* ============================================
   The Apex Circle - Team Management (Admin)
   ============================================ */

const DEFAULT_SMS_API_URL = '/.netlify/functions/sms';
const TASK_REWARD_POINTS = 10;

let adminTasks = [];
let adminSchedules = [];
let adminRewards = [];
let adminTrainingVideos = [];
let adminNotifications = [];
let adminContacts = {}; // Memory-only contacts override

// Helper to get team members safely (Fallback if data.js fails)
function getAllTeamMembers() {
    if (typeof teamMembers !== 'undefined' && Array.isArray(teamMembers) && teamMembers.length > 0) {
        return teamMembers;
    }
    // Fallback data
    return [
        { id: 'tm001', name: 'Mr. Divyansh Gupta', email: 'divyansh.gupta@apexcircle.com', position: 'Team Leader', phone: '', photo: 'assets/images/team-divyansh-gupta.jpeg' },
        { id: 'tm002', name: 'Anurag Sangar', email: 'anurag.sangar@apexcircle.com', position: 'Registration Management', phone: '', photo: 'assets/images/team-anurag-sangar.jpeg' },
        { id: 'tm003', name: 'Miss Palak', email: 'palak@apexcircle.com', position: 'Guest Management', phone: '', photo: 'assets/images/team-palak.jpeg' },
        { id: 'tm004', name: 'Aman Yadav', email: 'aman.yadav@apexcircle.com', position: 'Social Media & PR', phone: '', photo: 'assets/images/team-aman-yadav.jpeg' },
        { id: 'tm005', name: 'Aarti Yadav', email: 'aarti.yadav@apexcircle.com', position: 'Host & Anchor', phone: '', photo: 'assets/images/team-aarti-yadav.jpeg' },
        { id: 'tm006', name: 'Prince Jangra', email: 'prince.jangra@apexcircle.com', position: 'Event Coordinator', phone: '+919992515619', photo: 'assets/images/team-prince-jangra.jpeg' },
        { id: 'tm007', name: 'Naman Singh', email: 'naman.singh@apexcircle.com', position: 'Social Media & PR', phone: '+9178335091207', photo: 'assets/images/team-naman-singh.jpeg' },
        { id: 'tm008', name: 'Drishti Pathak', email: 'drishti.pathak@apexcircle.com', position: 'Creative Team Head', phone: '', photo: 'assets/images/team-drishti-pathak.jpeg' },
        { id: 'tm009', name: 'Deepti', email: 'deepti@apexcircle.com', position: 'Stage Coordinator', phone: '+919958546372', photo: 'assets/images/team-deepti.jpeg' }
    ];
}

// TextBee Credentials (Fallback)
const TEXTBEE_API_KEY = "71fd5d16-5ad4-404f-92fc-a761fcfd80bc";
const TEXTBEE_DEVICE_ID = "6952d9b68a8761ab1a3f0924";
const TEXTBEE_BASE_URL = "https://api.textbee.dev/api/v1/gateway/devices";

function normalizeSmsApiUrl(raw) {
    let val = String(raw || '').trim();
    if (!val) return DEFAULT_SMS_API_URL;
    if (val.startsWith('/')) return val; // Allow relative paths

    // Fix common protocol errors for localhost
    if (val.includes('localhost') || val.includes('127.0.0.1')) {
        val = val.replace(/^https:\/\//, 'http://');
    }

    if (!/^https?:\/\//i.test(val)) val = `http://${val}`;

    try {
        const u = new URL(val);
        const path = String(u.pathname || '').trim();
        if (!path || path === '/') u.pathname = '/api/sms';
        return u.toString();
    } catch {
        return DEFAULT_SMS_API_URL;
    }
}

function getSmsApiUrl() {
    const overrideBase = getRemoteApiBaseOverride();
    if (overrideBase && !isDirectNeon()) {
        const base = String(overrideBase).replace(/\/+$/, '');
        return `${base}/sms`;
    }
    // 1. Production: Always use Netlify Functions relative path
    if (window.location.hostname.endsWith('netlify.app')) {
        return '/.netlify/functions/sms';
    }

    // 2. Localhost Default
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        // If serving from the API server itself, relative path is best
        if (window.location.port === '8000') return '/api/sms';
        // If serving from VS Code Live Server (e.g. 5500), point to the running API server
        return `http://${window.location.hostname}:8000/api/sms`;
    }

    // 3. Fallback
    return DEFAULT_SMS_API_URL;
}

function getSmsServerApiKey() {
    return ''; // No local storage for API keys
}

function getTeamMemberContactsMap() {
    return adminContacts;
}

function setTeamMemberContactsMap(map) {
    adminContacts = map && typeof map === 'object' ? map : {};
}

function normalizePhone(phone) {
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

function getMemberPhone(memberId) {
    const id = String(memberId || '').trim();
    const contacts = getTeamMemberContactsMap();
    const fromMap = contacts[id];
    if (fromMap) return normalizePhone(fromMap);
    const member = teamMembers.find(m => m.id === id);
    return normalizePhone(member && member.phone ? member.phone : '');
}

function syncMemberPhones() {
    const contacts = getTeamMemberContactsMap();
    teamMembers.forEach(m => {
        const id = String(m && m.id ? m.id : '').trim();
        if (!id) return;
        const fromMap = contacts[id];
        if (typeof fromMap === 'string') m.phone = normalizePhone(fromMap);
        else m.phone = normalizePhone(m.phone);
    });
}

function sendSms(to, message) {
    const phone = normalizePhone(to);
    const body = String(message || '').trim();
    if (!phone || !body) return Promise.resolve({ ok: false });
    const smsApiUrl = getSmsApiUrl();
    const smsServerApiKey = getSmsServerApiKey();
    const headers = { 'Content-Type': 'application/json' };
    if (smsServerApiKey) headers['x-api-key'] = smsServerApiKey;

    // Helper for direct TextBee send
    const sendDirect = async () => {
        console.warn('Backend SMS failed, attempting direct TextBee send...');
        
        // Use defaults
        const apiKey = TEXTBEE_API_KEY;
        const deviceId = TEXTBEE_DEVICE_ID;

        const url = `${TEXTBEE_BASE_URL}/${deviceId}/send-sms`;
        try {
            const r = await fetch(url, {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    recipients: [phone],
                    message: body
                })
            });
            if (r.ok) return { ok: true };
            const txt = await r.text();
            return { ok: false, error: `TextBee Direct Error: ${txt}` };
        } catch (e) {
            return { ok: false, error: `TextBee Direct Exception: ${e.message}` };
        }
    };

    return fetch(smsApiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ to: phone, message: body })
    }).then(async (r) => {
        let data = null;
        try {
            data = await r.json();
        } catch {
            data = null;
        }

        // If 503 or specific error about provider, try fallback
        if (r.status === 503 || (data && data.error && data.error.includes('No SMS provider configured'))) {
            return sendDirect();
        }

        if (!r.ok) {
            const err = data && typeof data === 'object' && data.error ? String(data.error) : `HTTP ${r.status}`;
            return { ok: false, error: err };
        }
        return data && typeof data === 'object' ? data : { ok: true };
    }).catch((e) => {
        // Network error to backend? Try direct.
        console.warn('Network error to backend SMS, trying direct.', e);
        return sendDirect();
    });
}

function pushTeamNotification(payload) {
    const next = payload && typeof payload === 'object' ? payload : {};
    if (!next.id) next.id = `tn_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    if (!next.createdAt) next.createdAt = new Date().toISOString();
    
    saveNotificationRemote(next).then(() => {
        adminNotifications.push(next);
    }).catch(e => console.error('Failed to push notification remote:', e));
}

function notifyTeam(memberId, message, meta) {
    const target = String(memberId || '').trim() || 'all';
    pushTeamNotification({
        memberId: target,
        message: String(message || '').trim(),
        meta: meta && typeof meta === 'object' ? meta : {}
    });

    const messageText = String(message || '').trim();
    if (!messageText) return;

    if (target === 'all') {
        const phones = teamMembers
            .map(m => m && m.id ? String(m.id) : '')
            .filter(Boolean)
            .map(id => getMemberPhone(id))
            .filter(Boolean);
        if (!phones.length) {
            console.warn('No phone numbers set for team members.');
            return;
        }
        const sends = phones.map(phone => sendSms(phone, messageText));
        Promise.allSettled(sends).then(results => {
            const failed = results.filter(r => r.status === 'fulfilled' && (!r.value || !r.value.ok));
            if (failed.length) console.warn('Some SMS sends failed', results);
        });
        return;
    }

    const phone = getMemberPhone(target);
    if (!phone) {
        console.warn('No phone number found for member:', target);
        return;
    }
    sendSms(phone, messageText).then(r => {
        if (!r || !r.ok) console.warn('SMS send failed', r);
    });
}

function setSmsStatus(message) {
    const el = document.getElementById('smsStatus');
    if (el) el.textContent = String(message || '').trim();
}

function syncSmsSettingsUi() {
    const urlEl = document.getElementById('smsApiUrlInput');
    const keyEl = document.getElementById('smsServerApiKeyInput');
    const tbKeyEl = document.getElementById('textBeeApiKeyInput');
    const tbDevEl = document.getElementById('textBeeDeviceIdInput');
    const testToEl = document.getElementById('smsTestTo');
    const testMsgEl = document.getElementById('smsTestMessage');
    
    if (urlEl) urlEl.value = getSmsApiUrl();
    if (keyEl) keyEl.value = getSmsServerApiKey();
    if (tbKeyEl) tbKeyEl.value = '';
    if (tbDevEl) tbDevEl.value = '';
    
    if (testMsgEl && !String(testMsgEl.value || '').trim()) testMsgEl.value = 'Test SMS from The Apex Circle';
    if (testToEl && !String(testToEl.value || '').trim()) testToEl.value = '';
}

function saveSmsSettings() {
    setSmsStatus('Settings not persisted (No Local Storage).');
}

function sendTestSms() {
    const toEl = document.getElementById('smsTestTo');
    const msgEl = document.getElementById('smsTestMessage');
    const to = String(toEl && toEl.value ? toEl.value : '').trim();
    const message = String(msgEl && msgEl.value ? msgEl.value : '').trim() || 'Test SMS from The Apex Circle';
    if (!to) {
        setSmsStatus('Enter a test number.');
        return;
    }
    setSmsStatus('Sending...');
    sendSms(to, message).then((r) => {
        if (r && r.ok) setSmsStatus('Sent.');
        else setSmsStatus(r && r.error ? String(r.error) : 'Send failed.');
    });
}

function sendSmsToAll() {
    const msgEl = document.getElementById('smsBroadcastMessage') || document.getElementById('smsTestMessage');
    const message = String(msgEl && msgEl.value ? msgEl.value : '').trim();
    if (!message) {
        setSmsStatus('Enter a message to send to all.');
        return;
    }

    syncMemberPhones();

    const phones = teamMembers
        .map(m => getMemberPhone(m && m.id ? m.id : ''))
        .filter(Boolean);
    const uniquePhones = Array.from(new Set(phones));

    if (!uniquePhones.length) {
        setSmsStatus('No valid phone numbers found for team members.');
        return;
    }

    setSmsStatus(`Sending to ${uniquePhones.length}...`);
    const sends = uniquePhones.map(phone => sendSms(phone, message));
    Promise.allSettled(sends).then(results => {
        let successCount = 0;
        let failCount = 0;
        const errorCounts = new Map();

        results.forEach(r => {
            if (r.status === 'fulfilled' && r.value && r.value.ok) {
                successCount += 1;
                return;
            }

            failCount += 1;
            const err = r.status === 'fulfilled'
                ? String((r.value && r.value.error) || 'Send failed')
                : String((r.reason && (r.reason.message || r.reason)) || 'Send failed');
            errorCounts.set(err, (errorCounts.get(err) || 0) + 1);
        });

        const topError = Array.from(errorCounts.entries()).sort((a, b) => b[1] - a[1])[0];
        const topErrorText = topError && topError[0] ? String(topError[0]) : '';

        if (!successCount) {
            setSmsStatus(topErrorText || 'Send failed.');
            return;
        }

        if (failCount) {
            setSmsStatus(`Sent ${successCount}/${uniquePhones.length}. ${topErrorText || ''}`.trim());
            return;
        }

        setSmsStatus(`Sent to all ${uniquePhones.length}.`);
    });
}

function getMemberLabel(memberId) {
    const id = String(memberId || '').trim();
    if (!id) return '';
    if (id === 'all') return 'All Team Members';
    const member = teamMembers.find(m => String(m && m.id ? m.id : '').trim() === id);
    if (!member) return id;
    const name = String(member.name || '').trim();
    return name ? `${name} (${id})` : id;
}

function formatTaskSms(task, action) {
    const t = task && typeof task === 'object' ? task : {};
    const lines = [];
    lines.push(`Task ${String(action || '').trim() || 'Update'}`);

    const title = String(t.title || '').trim();
    if (title) lines.push(`Title: ${title}`);

    const id = String(t.id || '').trim();
    if (id) lines.push(`Task ID: ${id}`);

    const assignedTo = getMemberLabel(t.memberId);
    if (assignedTo) lines.push(`Assigned To: ${assignedTo}`);

    const eventName = String(t.eventName || '').trim();
    if (eventName) lines.push(`Event: ${eventName}`);

    const dueDateRaw = String(t.dueDate || '').trim();
    if (dueDateRaw) {
        const dueDateFormatted = formatDate(dueDateRaw);
        lines.push(`Due Date: ${dueDateFormatted || dueDateRaw}`);
    }

    const status = String(t.status || '').trim();
    if (status) lines.push(`Status: ${status}`);

    const description = String(t.description || '').trim();
    if (description) lines.push(`Description: ${description}`);

    return lines.filter(Boolean).join('\n');
}

function formatScheduleSms(schedule, action) {
    const s = schedule && typeof schedule === 'object' ? schedule : {};
    const lines = [];
    lines.push(`Schedule ${String(action || '').trim() || 'Update'}`);

    const eventName = String(s.eventName || '').trim();
    if (eventName) lines.push(`Event: ${eventName}`);

    const id = String(s.id || '').trim();
    if (id) lines.push(`Schedule ID: ${id}`);

    const assignedTo = getMemberLabel(s.memberId);
    if (assignedTo) lines.push(`Assigned To: ${assignedTo}`);

    const dateRaw = String(s.date || '').trim();
    if (dateRaw) {
        const dateFormatted = formatDate(dateRaw);
        lines.push(`Date: ${dateFormatted || dateRaw}`);
    }

    const startTime = String(s.startTime || '').trim();
    const endTime = String(s.endTime || '').trim();
    if (startTime && endTime) lines.push(`Time: ${startTime} - ${endTime}`);
    else if (startTime) lines.push(`Time: ${startTime}`);
    else if (endTime) lines.push(`Time: ${endTime}`);

    const location = String(s.location || '').trim();
    if (location) lines.push(`Location: ${location}`);

    const description = String(s.description || '').trim();
    if (description) lines.push(`Description: ${description}`);

    return lines.filter(Boolean).join('\n');
}

function formatRewardSms(reward, action) {
    const r = reward && typeof reward === 'object' ? reward : {};
    const lines = [];
    lines.push(`Reward ${String(action || '').trim() || 'Update'}`);

    const title = String(r.title || '').trim();
    if (title) lines.push(`Title: ${title}`);

    const id = String(r.id || '').trim();
    if (id) lines.push(`Reward ID: ${id}`);

    const assignedTo = getMemberLabel(r.memberId);
    if (assignedTo) lines.push(`Assigned To: ${assignedTo}`);

    const eventName = String(r.eventName || '').trim();
    if (eventName) lines.push(`Event: ${eventName}`);

    const amount = Number(r.amount);
    if (Number.isFinite(amount)) lines.push(`Amount: ₹${amount}`);

    const dateRaw = String(r.date || '').trim();
    if (dateRaw) {
        const dateFormatted = formatDate(dateRaw);
        lines.push(`Date: ${dateFormatted || dateRaw}`);
    }

    const description = String(r.description || '').trim();
    if (description) lines.push(`Description: ${description}`);

    return lines.filter(Boolean).join('\n');
}

function isTaskCompletedOnTime(dueDate, submittedAtIso) {
    const dueRaw = String(dueDate || '').trim();
    const submittedRaw = String(submittedAtIso || '').trim();
    if (!dueRaw || !submittedRaw) return true;
    const due = new Date(dueRaw + 'T23:59:59');
    const submitted = new Date(submittedRaw);
    const dueTime = due.getTime();
    const submittedTime = submitted.getTime();
    if (!Number.isFinite(dueTime) || !Number.isFinite(submittedTime)) return true;
    return submittedTime <= dueTime;
}

function formatTrainingSms(training, action) {
    const t = training && typeof training === 'object' ? training : {};
    const lines = [];
    lines.push(`Training ${String(action || '').trim() || 'Update'}`);

    const title = String(t.title || '').trim();
    if (title) lines.push(`Title: ${title}`);

    const id = String(t.id || '').trim();
    if (id) lines.push(`Training ID: ${id}`);

    const assignedTo = getMemberLabel(t.memberId);
    if (assignedTo) lines.push(`For: ${assignedTo}`);

    const provider = String(t.provider || '').trim();
    if (provider) lines.push(`Provided By: ${provider}`);

    const url = String(t.url || '').trim();
    if (url) lines.push(`Video: ${url}`);

    const description = String(t.description || '').trim();
    if (description) lines.push(`Description: ${description}`);

    return lines.filter(Boolean).join('\n');
}

// Recovery for legacy tasks (One-way migration to Remote)
async function recoverLegacyTasks() {
    const user = getCurrentUser();
    if (!user || !user.id) {
        alert('Cannot recover: User not identified.');
        return;
    }

    if (!confirm('This will scan your local browser storage for any tasks, schedules, rewards, or videos that are not yet on the server and upload them. Continue?')) {
        return;
    }

    const userId = String(user.id).trim();
    let recoveredCount = 0;
    let errors = 0;

    // Helper to recover a specific type
    const recoverType = async (storageKeyBase, currentRemoteList, saveFn, typeLabel) => {
        // LocalStorage recovery is disabled as per data isolation requirements.
        return 0;
    };

    // 1. Tasks
    const tasks = await recoverType('team_tasks', adminTasks, saveTaskRemote, 'tasks');
    recoveredCount += tasks;

    // 2. Schedules
    const schedules = await recoverType('team_schedule', adminSchedules, saveScheduleRemote, 'schedules');
    recoveredCount += schedules;

    // 3. Rewards
    const rewards = await recoverType('team_rewards', adminRewards, saveRewardRemote, 'rewards');
    recoveredCount += rewards;

    // 4. Training Videos
    const videos = await recoverType('team_training_videos', adminTrainingVideos, saveTrainingRemote, 'videos');
    recoveredCount += videos;

    // 5. Scheduled Tasks (Templates)
    const scheduledTasks = await recoverType('team_scheduled_tasks', adminScheduledTasks, saveScheduledTaskRemote, 'scheduled tasks');
    recoveredCount += scheduledTasks;

    let msg = `Recovery complete.\nUploaded: ${recoveredCount} items.\nErrors: ${errors}`;
    if (recoveredCount > 0) {
        msg += '\n\nPlease refresh the page to see the recovered items.';
        // Optionally reload data
        loadAllTasks();
        loadAllSchedule();
        loadAllRewards();
        loadAllTrainingVideos();
        loadScheduledTasks();
    } else {
        msg += '\n(No new local data found to recover)';
    }
    
    alert(msg);
}

// Initialize team management
document.addEventListener('DOMContentLoaded', function() {
    const user = getCurrentUser();
    if (!user || user.role !== 'admin') {
        // Redirect to login page (using cleaner path)
        window.location.href = 'login.html';
        return;
    }

    syncBackendSettingsUi();

    const neonStatusEl = document.getElementById('neonStatus');
    if (neonStatusEl) {
        updateNeonStatus(neonStatusEl);
    }

    initTabs();
    
    // Load data
    syncMemberPhones();
    syncSmsSettingsUi();
    loadTeamMembers();
    loadAllTasks();
    loadAllSchedule();
    loadAllRewards();
    loadAllTrainingVideos();
    loadScheduledTasks();
    populateMemberSelect('scheduledTaskMember', true);

    // Setup forms
    setupTaskForm();
    setupScheduleForm();
    setupRewardForm();
    setupTrainingForm();
    setupContactForm();

    // Setup logout
    // Logout button handler is already attached in auth.js
    /*
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
    */

    // Auto-sync every 30 seconds for "live" admin view
    setInterval(() => {
        // Refresh all data without blocking
        loadAllTasks();
        if (typeof loadAllSchedule === 'function') loadAllSchedule();
        if (typeof loadAllRewards === 'function') loadAllRewards();
        if (typeof loadScheduledTasks === 'function') loadScheduledTasks();
        
        // Auto-generate tasks from schedules (silently)
        if (typeof autoSyncSchedules === 'function') autoSyncSchedules();
    }, 30000);
});

async function autoSyncSchedules() {
    // Silent version of manualSyncSchedules
    try {
        const schEndpoint = isDirectNeon() ? '/team_scheduled_tasks' : '/scheduled_tasks';
        let schedules = await fetchRemote(schEndpoint);
        
        if (!Array.isArray(schedules) || schedules.length === 0) return;

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

        let generatedCount = 0;

        for (const sch of schedules) {
            if (sch.isActive === false) continue;
            if (sch.lastGenerated === todayStr) continue;

            let shouldGenerate = false;
            let taskTitle = sch.title;
            let taskDesc = sch.description;

            if (sch.recurrence === 'weekly-mon-fri') {
                if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                    shouldGenerate = true;
                    if (sch.dailyVariations && sch.dailyVariations[dayOfWeek]) {
                        taskTitle = sch.dailyVariations[dayOfWeek].title || taskTitle;
                        taskDesc = sch.dailyVariations[dayOfWeek].description || taskDesc;
                    }
                }
            } else if (sch.recurrence === 'daily') {
                shouldGenerate = true;
            } else if (sch.recurrence === 'one-time' && sch.scheduledAt) {
                const scheduledDate = new Date(sch.scheduledAt).toISOString().split('T')[0];
                if (scheduledDate <= todayStr) {
                    shouldGenerate = true;
                }
            }

            if (shouldGenerate) {
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
                        createdAt: new Date().toISOString(),
                        originScheduleId: sch.id,
                        autoExtend: sch.autoExtend || false,
                        rewardAmount: sch.rewardAmount
                    };
                    
                    const taskEndpoint = isDirectNeon() ? '/team_tasks' : '/team_tasks';
                    await saveRemote(taskEndpoint, newTask);
                    generatedCount++;
                }

                sch.lastGenerated = todayStr;
                await saveRemote(schEndpoint, sch);
            }
        }

        if (generatedCount > 0) {
            console.log(`Auto-sync generated ${generatedCount} tasks.`);
            loadAllTasks();
        }

    } catch (e) {
        console.warn('Auto-sync error:', e);
    }
}

// Tab functionality
function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');

            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(tc => tc.classList.remove('active'));

            this.classList.add('active');
            document.getElementById(targetTab + 'Tab').classList.add('active');
        });
    });
}

// Load team members
function loadTeamMembers() {
    const container = document.getElementById('teamMembersList');
    if (!container) return;

    container.innerHTML = teamMembers.map(member => `
        <div class="member-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0 0 var(--spacing-xs) 0; color: #000000;">${member.name}</h3>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 0.875rem;">${member.position}</p>
                    <p style="margin: var(--spacing-xs) 0 0 0; color: var(--text-secondary); font-size: 0.875rem;">ðŸ“§ ${member.email}</p>
                    <p style="margin: var(--spacing-xs) 0 0 0; color: var(--text-secondary); font-size: 0.875rem;">
                        ðŸ“ž ${member.phone ? `<a href="tel:${member.phone}" style="color: inherit; text-decoration: underline;">${member.phone}</a>` : 'Not set'}
                    </p>
                </div>
                <div>
                    <span style="font-size: 0.875rem; color: var(--text-secondary);">ID: ${member.id}</span>
                    <div style="margin-top: var(--spacing-xs); display: flex; justify-content: flex-end;">
                        <button class="btn btn-secondary btn-sm" onclick="showEditContactModal('${member.id}')">Update Contact</button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function showEditContactModal(memberId) {
    const id = String(memberId || '').trim();
    const member = teamMembers.find(m => m.id === id);
    if (!member) return;
    const nameEl = document.getElementById('contactMemberName');
    const phoneEl = document.getElementById('contactPhone');
    const form = document.getElementById('contactForm');
    if (!form || !phoneEl) return;
    form.dataset.memberId = id;
    if (nameEl) nameEl.textContent = `${member.name} (${member.id})`;
    phoneEl.value = member.phone || '';
    const modal = document.getElementById('contactModal');
    if (modal) modal.style.display = 'flex';
}

function setupContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;
    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const memberId = String(form.dataset.memberId || '').trim();
        if (!memberId) return;
        const phoneInput = document.getElementById('contactPhone');
        if (!phoneInput) return;
        const phone = normalizePhone(phoneInput.value);
        if (!phone) return;
        
        try {
            await saveContactRemote({ memberId, phone });
            const map = getTeamMemberContactsMap();
            map[memberId] = phone;
            setTeamMemberContactsMap(map);
            syncMemberPhones();
            loadTeamMembers();
            closeModal('contactModal');
            form.reset();
            delete form.dataset.memberId;
            alert('Contact updated successfully!');
        } catch (err) {
            console.error('Failed to save contact remote:', err);
            alert('Failed to update contact remotely.');
        }
    });
}

function applyTaskExtensions(tasks) {
    const list = Array.isArray(tasks) ? tasks.slice() : [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const changed = [];
    const result = list.map(t => {
        if (!t || !t.dueDate) return t;
        const status = String(t.status || 'pending');
        if (status === 'completed') return t;
        const extCountRaw = Number(t.extensionCount || 0);
        const extCount = Number.isFinite(extCountRaw) ? extCountRaw : 0;
        if (extCount >= 3) return t;
        const due = new Date(t.dueDate);
        if (isNaN(due.getTime())) return t;
        const dueDate = new Date(due.getFullYear(), due.getMonth(), due.getDate());
        if (dueDate >= today) return t;
        const updatedDue = new Date(today.getTime());
        const next = {
            ...t,
            dueDate: updatedDue.toISOString().slice(0, 10),
            extensionCount: extCount + 1,
            updatedAt: new Date().toISOString()
        };
        changed.push(next);
        return next;
    });
    return { list: result, changed };
}

// Load all tasks
function loadAllTasks() {
    // Direct remote fetch only - NO localStorage
    fetchTasksRemote().then(remote => {
        let tasks = Array.isArray(remote) ? remote : [];
        adminTasks = tasks;
        
        // Auto-extend overdue tasks
        const todayStr = new Date().toISOString().split('T')[0];
        let hasExtensions = false;
        
        tasks.forEach(task => {
            if (task.status !== 'completed' && task.status !== 'eliminated' && task.autoExtend) {
                const dueRaw = task.dueDate ? String(task.dueDate).split('T')[0] : null;
                if (dueRaw && dueRaw < todayStr) {
                    console.log(`Auto-extending task: ${task.title} (${task.id}) from ${dueRaw} to ${todayStr}`);
                    task.dueDate = todayStr;
                    hasExtensions = true;
                    // Save extension remotely
                    saveTaskRemote(task).catch(e => console.error('Failed to save extended task remote', e));
                }
            }
        });

        // No localStorage.setItem here
        renderTasksTable(tasks);
    }).catch((e) => {
        console.warn('Remote fetch failed:', e);
        renderTasksTable([]); // Show empty if failed
    });
}

function getRemoteApiBaseOverride() {
    return sessionStorage.getItem('apex_api_base') || null;
}

function getNeonApiKey() {
    return sessionStorage.getItem('apex_neon_key') || '';
}

function syncBackendSettingsUi() {
    const urlInput = document.getElementById('remoteApiUrlInput');
    const keyInput = document.getElementById('neonApiKeyInput');
    const statusEl = document.getElementById('backendStatus');
    const base = getRemoteApiBaseOverride();
    const key = getNeonApiKey();

    if (urlInput) urlInput.value = base || '';
    if (keyInput) keyInput.value = key || '';

    if (statusEl) {
        if (base || key) {
            statusEl.textContent = 'Settings active (Session Only).';
            statusEl.style.color = 'var(--primary-color)';
        } else {
            statusEl.textContent = 'Using default config.';
            statusEl.style.color = 'var(--text-secondary)';
        }
    }
}

function saveBackendSettings() {
    const urlInput = document.getElementById('remoteApiUrlInput');
    const keyInput = document.getElementById('neonApiKeyInput');
    const statusEl = document.getElementById('backendStatus');
    
    const url = String(urlInput ? urlInput.value : '').trim();
    const key = String(keyInput ? keyInput.value : '').trim();

    if (url) sessionStorage.setItem('apex_api_base', url);
    else sessionStorage.removeItem('apex_api_base');

    if (key) sessionStorage.setItem('apex_neon_key', key);
    else sessionStorage.removeItem('apex_neon_key');

    syncBackendSettingsUi();
    
    // Trigger a status update check
    const neonStatusEl = document.getElementById('neonConnectionStatus');
    if (neonStatusEl) {
        neonStatusEl.textContent = 'Checking...';
        updateNeonStatus(neonStatusEl);
    }

    if (statusEl) {
        statusEl.textContent = 'Settings saved to Session Storage.';
        setTimeout(() => syncBackendSettingsUi(), 2000);
    }
}

function getApiBase() {
    if (window.APEX_CONFIG && window.APEX_CONFIG.getApiUrl) {
        return window.APEX_CONFIG.getApiUrl();
    }
    const host = window.location.hostname;

    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) {
        const override = getRemoteApiBaseOverride();
        if (override) return override;
        const port = window.location.port;
        if (port === '8002') return '/api';
        return `http://${host}:8002/api`;
    }

    const override = getRemoteApiBaseOverride();
    if (override) return override;

    return '/.netlify/functions';
}

function isDirectNeon() {
    const url = getRemoteApiBaseOverride();
    return !!(url && url.includes('neon.tech'));
}

async function fetchRemote(endpoint) {
    const base = getApiBase();
    if (!base) return [];
    
    // Direct Neon Logic
    if (isDirectNeon()) {
        const apiKey = getNeonApiKey();
        try {
            const headers = {
                Accept: 'application/json'
            };
            if (apiKey) {
                headers.Authorization = `Bearer ${apiKey}`;
            }
            const resp = await fetch(`${base}${endpoint}`, {
                headers
            });
            if (!resp.ok) return [];
            const data = await resp.json();
            return Array.isArray(data) ? data : [];
        } catch (e) {
            console.error(`Direct Fetch ${endpoint} error:`, e);
            return [];
        }
    }

    try {
        let ep = endpoint;
        if (ep.startsWith('/team_scheduled_tasks')) {
            ep = ep.replace('/team_scheduled_tasks', '/scheduled_tasks');
        }
        const url = `${base}${ep}${ep.includes('?') ? '&' : '?'}t=${Date.now()}`;
        
        const headers = {};
        const apiKey = getNeonApiKey();
        if (apiKey) {
            headers.Authorization = `Bearer ${apiKey}`;
        }

        const resp = await fetch(url, { headers });
        if (!resp.ok) return [];
        const data = await resp.json();
        if (data.ok && Array.isArray(data.tasks)) return data.tasks;
        if (data.ok && Array.isArray(data.rewards)) return data.rewards;
        if (Array.isArray(data)) return data; 
        return [];
    } catch (e) {
        console.error(`Fetch ${endpoint} error:`, e);
        return [];
    }
}

async function saveRemote(endpoint, data) {
    const base = getApiBase();
    if (!base) return false;

    // Direct Neon Logic (Upsert)
    if (isDirectNeon()) {
        const apiKey = getNeonApiKey();
        const id = data.id;
        if (!id) return false;

        try {
            // Check existence
            const checkUrl = `${base}${endpoint}?id=eq.${encodeURIComponent(id)}`;
            const checkHeaders = {};
            if (apiKey) {
                checkHeaders.Authorization = `Bearer ${apiKey}`;
            }
            const checkResp = await fetch(checkUrl, { headers: checkHeaders });
            const existing = await checkResp.json();
            
            let method = 'POST';
            let url = `${base}${endpoint}`;
            
            if (Array.isArray(existing) && existing.length > 0) {
                method = 'PATCH';
                url = `${base}${endpoint}?id=eq.${encodeURIComponent(id)}`;
            }

            const saveHeaders = {
                'Content-Type': 'application/json',
                Prefer: 'return=representation'
            };
            if (apiKey) {
                saveHeaders.Authorization = `Bearer ${apiKey}`;
            }
            const saveResp = await fetch(url, {
                method: method,
                headers: saveHeaders,
                body: JSON.stringify(data)
            });
            
            return saveResp.ok;
        } catch (e) {
            console.error(`Direct Save ${endpoint} error:`, e);
            return false;
        }
    }

    try {
        const headers = { 'Content-Type': 'application/json' };
        const apiKey = getNeonApiKey();
        if (apiKey) {
            headers.Authorization = `Bearer ${apiKey}`;
        }

        const resp = await fetch(`${base}${endpoint}`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(data)
        });
        return resp.ok;
    } catch (e) {
        console.error(`Save ${endpoint} error:`, e);
        return false;
    }
}

function fetchTasksRemote() {
    return fetchRemote('/team_tasks');
}

function fetchScheduleRemote() {
    return fetchRemote('/team_schedule');
}

function saveTaskRemote(task) {
    return saveRemote('/team_tasks', task);
}

function fetchRewardsRemote() {
    return fetchRemote('/team_rewards');
}

function saveRewardRemote(reward) {
    return saveRemote('/team_rewards', reward);
}

function fetchTrainingRemote() {
    return fetchRemote('/team_training_videos');
}

function saveTrainingRemote(video) {
    return saveRemote('/team_training_videos', video);
}

function fetchContactsRemote() {
    return fetchRemote('/team_contacts');
}

function saveContactRemote(contact) {
    return saveRemote('/team_contacts', contact);
}

function fetchNotificationsRemote() {
    return fetchRemote('/team_notifications');
}

function saveNotificationRemote(notification) {
    return saveRemote('/team_notifications', notification);
}


function deleteTrainingRemote(videoId) {
    const id = String(videoId || '').trim();
    if (!id) return Promise.resolve(false);
    const encoded = encodeURIComponent(id);
    return deleteRemote(`/team_training_videos?id=${encoded}`);
}

async function deleteRemote(endpoint) {
    const base = getApiBase();
    if (!base) return false;
    
    // Direct Neon Logic
    if (isDirectNeon()) {
        const apiKey = getNeonApiKey();
        let url = `${base}${endpoint}`;
        
        // Adapt Query Params for PostgREST
        if (endpoint.includes('?taskId=')) {
            url = url.replace('?taskId=', '?taskId=eq.');
        } else if (endpoint.includes('?id=')) {
            url = url.replace('?id=', '?id=eq.');
        } else if (endpoint.includes('?all=true')) {
            // Use a condition that matches all records (e.g. id is not null)
            url = url.replace('?all=true', '?id=not.is.null');
        }

        try {
            const headers = {};
            if (apiKey) {
                headers.Authorization = `Bearer ${apiKey}`;
            }
            const resp = await fetch(url, {
                method: 'DELETE',
                headers
            });
            return resp.ok;
        } catch (e) {
            console.error(`Direct Delete ${endpoint} error:`, e);
            return false;
        }
    }

    try {
        // Primary attempt: proper DELETE
        const headers = {};
        const apiKey = getNeonApiKey();
        if (apiKey) {
            headers.Authorization = `Bearer ${apiKey}`;
        }

        const resp = await fetch(`${base}${endpoint}`, { method: 'DELETE', headers });
        if (resp.ok) return true;
        // Fallback: POST to /team_tasks/delete when deleting a single task
        if (endpoint.startsWith('/team_tasks?id=')) {
            const id = decodeURIComponent(endpoint.split('=')[1] || '');
            
            const postHeaders = { 'Content-Type': 'application/json' };
            if (apiKey) {
                postHeaders.Authorization = `Bearer ${apiKey}`;
            }

            const r2 = await fetch(`${base}/team_tasks/delete`, {
                method: 'POST',
                headers: postHeaders,
                body: JSON.stringify({ id })
            });
            return r2.ok;
        }
        return false;
    } catch (e) {
        // Network/CORS fallback
        if (endpoint.startsWith('/team_tasks?id=')) {
            try {
                const id = decodeURIComponent(endpoint.split('=')[1] || '');
                const apiKey = getNeonApiKey();
                const postHeaders = { 'Content-Type': 'application/json' };
                if (apiKey) {
                    postHeaders.Authorization = `Bearer ${apiKey}`;
                }

                const r2 = await fetch(`${base}/team_tasks/delete`, {
                    method: 'POST',
                    headers: postHeaders,
                    body: JSON.stringify({ id })
                });
                return r2.ok;
            } catch (e2) {
                console.error(`Delete fallback ${endpoint} error:`, e2);
            }
        }
        console.error(`Delete ${endpoint} error:`, e);
        return false;
    }
}

function deleteRewardRemoteByTask(taskId) {
    const id = String(taskId || '').trim();
    if (!id) return Promise.resolve(false);
    const encoded = encodeURIComponent(id);
    return deleteRemote(`/team_rewards?taskId=${encoded}`);
}

function deleteAllRewardsRemote() {
    return deleteRemote('/team_rewards?all=true');
}

async function updateNeonStatus(el) {
    if (!el) return;
    const base = getApiBase();
    if (!base) {
        el.textContent = 'Neon: Local only (no remote base URL)';
        el.style.color = 'var(--text-secondary)';
        return;
    }
    
    try {
        const start = Date.now();
        let resp;
        let mode = 'remote backend';
        
        // Add 15s timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
            if (isDirectNeon()) {
                mode = 'Direct Connection';
                const apiKey = getNeonApiKey();
                const headers = {};
                if (apiKey) {
                    headers.Authorization = `Bearer ${apiKey}`;
                }
                resp = await fetch(`${base}/team_tasks`, { 
                    headers,
                    signal: controller.signal
                });
            } else {
                resp = await fetch(`${base}/team_tasks`, {
                    signal: controller.signal
                });
                if (base === '/.netlify/functions') {
                    mode = 'Netlify + Neon';
                } else if (base.indexOf('localhost') !== -1 || base === '/api') {
                    mode = 'Local server';
                }
            }
        } finally {
            clearTimeout(timeoutId);
        }

        const duration = Date.now() - start;
        if (!resp.ok) {
            const errText = await resp.text().catch(() => '');
            console.error('Neon Check Error:', resp.status, errText);
            const snippet = String(errText || '').replace(/\s+/g, ' ').trim().slice(0, 120);
            if (snippet) {
                el.textContent = `Neon: Error ${resp.status} - ${snippet}`;
            } else {
                el.textContent = `Neon: Error (${resp.status})`;
            }
            el.style.color = '#B00020';
            return;
        }

        const ms = duration;
        el.textContent = `Neon: Connected (${mode}, ${ms} ms)`;
        el.style.color = 'var(--primary-color)';
    } catch (e) {
        console.error('Neon Check Exception:', e);
        if (e.name === 'AbortError') {
             el.textContent = 'Neon: Connection Timeout';
        } else {
             el.textContent = 'Neon: Offline (using local storage only)';
        }
        el.style.color = '#B00020';
    }
}

function renderTasksTable(tasks) {
    const tbodyToday = document.querySelector('#tasksTableToday tbody');
    const tbodyPrevious = document.querySelector('#tasksTablePrevious tbody');
    const tbodyLegacy = document.querySelector('#tasksTable tbody');

    // Helper to render rows
    const renderRows = (taskList) => {
        if (taskList.length === 0) {
            return '<tr><td colspan="7" style="text-align: center; padding: var(--spacing-lg); color: var(--text-secondary);">No tasks in this section.</td></tr>';
        }
        return taskList.map(task => {
            let memberName = 'Unknown';
            if (task.memberId === 'all') {
                memberName = 'All Team Members';
            } else {
                const member = teamMembers.find(m => m.id === task.memberId);
                memberName = member ? member.name : 'Unknown';
            }
            
            const status = String(task.status || '').trim();
            const rewardStatus = String(task.rewardStatus || '').trim();
            const hasProof = !!task.proofImage;
            let rewardLabel = '-';
            if (status === 'completed' && hasProof) {
                if (rewardStatus === 'approved') rewardLabel = 'Approved';
                else if (rewardStatus === 'rejected') rewardLabel = 'Rejected';
                else rewardLabel = 'Pending approval';
            }
            return `
                <tr>
                    <td><strong>${task.title}</strong><br><small style="color: var(--text-secondary);">${task.description.substring(0, 50)}...</small></td>
                    <td>${member ? member.name : 'Unknown'}</td>
                    <td>${task.eventName}</td>
                    <td>${formatDate(task.dueDate)}</td>
                    <td><span class="badge status-${task.status}">${task.status.replace('-', ' ').toUpperCase()}</span></td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="editTask('${task.id}')">Edit</button>
                        <button class="btn btn-secondary btn-sm" onclick="extendTask('${task.id}')">Extend</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteTask('${task.id}')">Delete</button>
                        ${status !== 'eliminated' && status !== 'completed' ? `<button class="btn btn-warning btn-sm" onclick="eliminateTask('${task.id}')" style="color: #fff; background-color: #fd7e14; border-color: #fd7e14;">Eliminate</button>` : ''}
                        ${hasProof ? `<button class="btn btn-secondary btn-sm" onclick="showTaskProof('${task.id}')">View Proof</button>` : ''}
                        ${hasProof && status === 'completed' && rewardStatus !== 'approved' ? `
                            <button class="btn btn-primary btn-sm" onclick="approveTaskReward('${task.id}')">Approve</button>
                            <button class="btn btn-danger btn-sm" onclick="rejectTaskReward('${task.id}')">Reject</button>
                        ` : ''}
                    </td>
                    <td>${rewardLabel}</td>
                </tr>
            `;
        }).join('');
    };

    if (tbodyToday && tbodyPrevious) {
        tbodyToday.innerHTML = '';
        tbodyPrevious.innerHTML = '';

        if (tasks.length === 0) {
            tbodyToday.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: var(--spacing-lg); color: var(--text-secondary);">No tasks assigned yet.</td></tr>';
            tbodyPrevious.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: var(--spacing-lg); color: var(--text-secondary);">No previous tasks.</td></tr>';
            return;
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const todayTasks = [];
        const previousTasks = [];

        tasks.forEach(task => {
            const dueRaw = task.dueDate ? String(task.dueDate).split('T')[0] : null;
            if (!dueRaw || dueRaw >= todayStr) {
                todayTasks.push(task);
            } else {
                previousTasks.push(task);
            }
        });

        tbodyToday.innerHTML = renderRows(todayTasks);
        tbodyPrevious.innerHTML = renderRows(previousTasks);

    } else if (tbodyLegacy) {
        if (tasks.length === 0) {
            tbodyLegacy.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: var(--spacing-lg); color: var(--text-secondary);">No tasks assigned yet.</td></tr>';
            return;
        }
        tbodyLegacy.innerHTML = renderRows(tasks);
    }
}

let currentProofTaskIdForAdmin = null;

function showTaskProof(taskId) {
    const id = String(taskId || '').trim();
    if (!id) return;
    // Use adminTasks global instead of localStorage
    const tasks = adminTasks || [];
    const task = tasks.find(t => String(t && t.id) === id);
    const modal = document.getElementById('taskProofViewModal');
    if (!modal) return;
    const titleEl = document.getElementById('taskProofViewTaskTitle');
    const imgEl = document.getElementById('taskProofViewImage');
    const placeholderEl = document.getElementById('taskProofViewPlaceholder');
    if (titleEl) titleEl.textContent = task && task.title ? task.title : '';
    if (task && task.proofImage) {
        if (imgEl) {
            imgEl.src = task.proofImage;
            imgEl.style.display = '';
        }
        if (placeholderEl) placeholderEl.style.display = 'none';
    } else {
        if (imgEl) imgEl.style.display = 'none';
        if (placeholderEl) placeholderEl.style.display = '';
    }
    currentProofTaskIdForAdmin = id;
    modal.style.display = 'flex';
}

function handleApproveCurrentTaskProof() {
    if (!currentProofTaskIdForAdmin) return;
    approveTaskReward(currentProofTaskIdForAdmin);
}

function handleRejectCurrentTaskProof() {
    if (!currentProofTaskIdForAdmin) return;
    rejectTaskReward(currentProofTaskIdForAdmin);
}

function approveTaskReward(taskId) {
    const id = String(taskId || '').trim();
    if (!id) return;
    const tasks = adminTasks || [];
    const idx = tasks.findIndex(t => String(t && t.id) === id);
    if (idx === -1) {
        alert('Task not found. Please refresh and try again.');
        return;
    }
    const task = { ...tasks[idx] }; // copy
    if (!task.proofImage) {
        alert('No proof image uploaded for this task.');
        return;
    }
    const completedOnTime = isTaskCompletedOnTime(task.dueDate, task.proofSubmittedAt || task.updatedAt || task.createdAt);
    if (!completedOnTime) {
        task.rewardStatus = 'late';
        task.completedOnTime = false;
        task.rewardApprovedAt = null;
        
        saveTaskRemote(task).then(() => {
            const modalLate = document.getElementById('taskProofViewModal');
            if (modalLate) modalLate.style.display = 'none';
            currentProofTaskIdForAdmin = null;
            loadAllTasks();
            loadAllRewards();
            alert('Task was completed after the due date. No reward will be granted.');
        });
        return;
    }
    
    const nowIso = new Date().toISOString();
    task.rewardStatus = 'approved';
    task.completedOnTime = true;
    task.rewardApprovedAt = nowIso;

    saveTaskRemote(task).then(() => {
        const rewards = adminRewards || [];
        const existing = rewards.find(r => String(r && r.taskId) === id);
        const points = TASK_REWARD_POINTS;
        
        let rewardAction;
        
        if (!existing) {
            const reward = {
                id: 'reward_' + Date.now(),
                title: 'Task Reward: ' + (task.title || ''),
                memberId: task.memberId,
                eventName: task.eventName,
                amount: points,
                points: points,
                date: nowIso,
                description: 'Reward for completing task: ' + (task.title || ''),
                taskId: id,
                createdAt: nowIso
            };
            rewardAction = saveRewardRemote(reward).then(() => {
                notifyTeam(task.memberId, formatRewardSms(reward, 'Created'), { kind: 'reward', action: 'created', id: reward.id });
            });
        } else {
            const updatedReward = { ...existing };
            updatedReward.amount = Number.isFinite(updatedReward.amount) ? updatedReward.amount : points;
            if (!updatedReward.points) updatedReward.points = points;
            updatedReward.updatedAt = nowIso;
            rewardAction = saveRewardRemote(updatedReward);
        }

        rewardAction.then(() => {
            const modal = document.getElementById('taskProofViewModal');
            if (modal) modal.style.display = 'none';
            currentProofTaskIdForAdmin = null;
            loadAllTasks();
            loadAllRewards();
            alert('Task approved and reward granted.');
        });
    }).catch(e => {
        console.error('Approve task failed:', e);
        alert('Failed to approve task.');
    });
}

function rejectTaskReward(taskId) {
    const id = String(taskId || '').trim();
    if (!id) return;
    const tasks = adminTasks || [];
    const idx = tasks.findIndex(t => String(t && t.id) === id);
    if (idx === -1) {
        alert('Task not found. Please refresh and try again.');
        return;
    }
    const nowIso = new Date().toISOString();
    const task = {
        ...tasks[idx],
        rewardStatus: 'rejected',
        rewardRejectedAt: nowIso
    };
    
    saveTaskRemote(task).then(() => {
        return deleteRewardRemoteByTask(id);
    }).then(() => {
        const modal = document.getElementById('taskProofViewModal');
        if (modal) modal.style.display = 'none';
        currentProofTaskIdForAdmin = null;
        loadAllTasks();
        loadAllRewards();
        alert('Task reward rejected.');
    }).catch(e => {
        console.error('Reject task failed:', e);
        alert('Failed to reject task.');
    });
}

// Load all schedule
function loadAllSchedule() {
    fetchScheduleRemote().then(remote => {
        let schedule = Array.isArray(remote) ? remote : [];
        adminSchedules = schedule;
        renderScheduleTable(schedule);
    }).catch(e => {
        console.warn('Remote schedule fetch failed:', e);
        renderScheduleTable([]);
    });
}

function renderScheduleTable(schedule) {
    const tbody = document.querySelector('#scheduleTable tbody');
    if (!tbody) return;

    const sortedSchedule = schedule.sort((a, b) => new Date(a.date) - new Date(b.date));

    if (sortedSchedule.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: var(--spacing-lg); color: var(--text-secondary);">No schedules created yet.</td></tr>';
        return;
    }

    tbody.innerHTML = sortedSchedule.map(item => {
        const member = teamMembers.find(m => m.id === item.memberId);
        return `
            <tr>
                <td><strong>${item.eventName}</strong></td>
                <td>${member ? member.name : 'Unknown'}</td>
                <td>${formatDate(item.date)}</td>
                <td>${item.startTime} - ${item.endTime}</td>
                <td>${item.location}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="editSchedule('${item.id}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSchedule('${item.id}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Load all rewards
function loadAllRewards() {
    fetchRewardsRemote().then(remote => {
        let rewards = Array.isArray(remote) ? remote : [];
        adminRewards = rewards;
        renderRewardsTable(rewards);
    }).catch(e => {
        console.warn('Remote rewards fetch failed:', e);
        renderRewardsTable([]);
    });
}

function resetRewardBalancesForNewEvent() {
    const confirmReset = window.confirm('This will clear all reward balances and points for every team member for the new event. Continue?');
    if (!confirmReset) return;
    
    deleteAllRewardsRemote().then(() => {
        loadAllRewards();
        notifyTeam('all', 'Reward balances have been reset for the new event.', { kind: 'reward', action: 'reset' });
        alert('All reward balances have been reset for the new event.');
    }).catch(e => {
        console.error('Reset rewards failed:', e);
        alert('Failed to reset rewards remote.');
    });
}

function renderRewardsTable(rewards) {
    const tbodyToday = document.querySelector('#rewardsTableToday tbody');
    const tbodyPrevious = document.querySelector('#rewardsTablePrevious tbody');
    const tbodyLegacy = document.querySelector('#rewardsTable tbody');

    // Helper to render rows
    const renderRows = (rewardList) => {
        if (rewardList.length === 0) {
            return '<tr><td colspan="6" style="text-align: center; padding: var(--spacing-lg); color: var(--text-secondary);">No rewards in this section.</td></tr>';
        }
        // Sort by date descending within the section
        const sorted = rewardList.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return sorted.map(reward => {
            const member = teamMembers.find(m => m.id === reward.memberId);
            return `
                <tr>
                    <td><strong>${reward.title}</strong></td>
                    <td>${member ? member.name : 'Unknown'}</td>
                    <td>${reward.eventName}</td>
                    <td><strong style="color: #FFD700;">₹${reward.amount || 0}</strong></td>
                    <td>${formatDate(reward.date)}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="editReward('${reward.id}')">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteReward('${reward.id}')">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    };

    if (tbodyToday && tbodyPrevious) {
        tbodyToday.innerHTML = '';
        tbodyPrevious.innerHTML = '';

        if (rewards.length === 0) {
            tbodyToday.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: var(--spacing-lg); color: var(--text-secondary);">No rewards assigned yet.</td></tr>';
            tbodyPrevious.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: var(--spacing-lg); color: var(--text-secondary);">No previous rewards.</td></tr>';
            return;
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const todayRewards = [];
        const previousRewards = [];

        rewards.forEach(reward => {
            const rewardDate = reward.date ? String(reward.date).split('T')[0] : null;
            if (!rewardDate || rewardDate >= todayStr) {
                todayRewards.push(reward);
            } else {
                previousRewards.push(reward);
            }
        });

        tbodyToday.innerHTML = renderRows(todayRewards);
        tbodyPrevious.innerHTML = renderRows(previousRewards);

    } else if (tbodyLegacy) {
        if (rewards.length === 0) {
            tbodyLegacy.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: var(--spacing-lg); color: var(--text-secondary);">No rewards assigned yet.</td></tr>';
            return;
        }
        tbodyLegacy.innerHTML = renderRows(rewards);
    }
}

async function loadAllTrainingVideos() {
    try {
        const remoteVideos = await fetchRemote('/team_training_videos');
        const videos = Array.isArray(remoteVideos) ? remoteVideos : [];
        adminTrainingVideos = videos;
        renderTrainingTable(videos);
    } catch (e) {
        console.error('Failed to load training videos:', e);
        renderTrainingTable([]);
    }
}

function getMemberDisplay(memberId) {
    const id = String(memberId || '').trim();
    if (!id || id === 'all') return 'All Team Members';
    const member = teamMembers.find(m => m.id === id);
    return member ? `${member.name} (${member.id})` : `Unknown (${id})`;
}

function renderTrainingTable(videos) {
    const tbody = document.querySelector('#trainingTable tbody');
    if (!tbody) return;

    const list = Array.isArray(videos) ? videos.slice() : [];
    list.sort((a, b) => String(b && (b.createdAt || '')).localeCompare(String(a && (a.createdAt || ''))));

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: var(--spacing-lg); color: var(--text-secondary);">No training videos added yet.</td></tr>';
        return;
    }

    tbody.innerHTML = list.map(v => {
        const url = String((v && v.url) || '').trim();
        const safeUrl = url ? url.replace(/"/g, '&quot;') : '';
        const title = String((v && v.title) || '').trim();
        const provider = String((v && v.provider) || '').trim();
        const assignedTo = getMemberDisplay(v && v.memberId);
        const desc = String((v && v.description) || '').trim();
        const shortDesc = desc.length > 60 ? (desc.substring(0, 60) + '...') : desc;
        return `
            <tr>
                <td><strong>${title || 'Untitled'}</strong><br><small style="color: var(--text-secondary);">${shortDesc}</small></td>
                <td>${provider || '-'}</td>
                <td>${assignedTo}</td>
                <td>${url ? `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Open</a>` : '-'}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="editTrainingVideo('${String(v.id || '')}')">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteTrainingVideo('${String(v.id || '')}')">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Modal functions
function showAddTaskModal() {
    populateMemberSelect('taskMember', true);
    document.getElementById('taskForm').reset();
    delete document.getElementById('taskForm').dataset.editId;
    setTaskModalLabels(false);
    document.getElementById('taskModal').style.display = 'flex';
}

function showAddScheduleModal() {
    populateMemberSelect('scheduleMember', true);
    document.getElementById('scheduleForm').reset();
    delete document.getElementById('scheduleForm').dataset.editId;
    setScheduleModalLabels(false);
    document.getElementById('scheduleModal').style.display = 'flex';
}

function showAddRewardModal() {
    populateMemberSelect('rewardMember');
    document.getElementById('rewardForm').reset();
    delete document.getElementById('rewardForm').dataset.editId;
    setRewardModalLabels(false);
    document.getElementById('rewardModal').style.display = 'flex';
}

function showAddTrainingModal() {
    populateTrainingMemberSelect();
    const form = document.getElementById('trainingForm');
    if (form) {
        form.reset();
        delete form.dataset.editId;
        setTrainingModalLabels(false);
    }
    const modal = document.getElementById('trainingModal');
    if (modal) modal.style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function populateMemberSelect(selectId, includeAll = false) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const members = getAllTeamMembers();
    
    let options = [];
    if (includeAll) {
        options.push('<option value="all">All Team Members</option>');
    }
    
    options = options.concat(members.map(m => `<option value="${m.id}">${m.name} - ${m.position}</option>`));
    
    const placeholder = '<option value="">Select Team Member</option>';
    select.innerHTML = placeholder + options.join('');
}

function populateTrainingMemberSelect() {
    const select = document.getElementById('trainingMember');
    if (!select) return;
    const members = getAllTeamMembers();
    select.innerHTML = [
        '<option value="all">All Team Members</option>',
        ...members.map(m => `<option value="${m.id}">${m.name} - ${m.position} (${m.id})</option>`)
    ].join('');
}

// Setup forms
function setupTaskForm() {
    const form = document.getElementById('taskForm');
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const editId = form.dataset.editId;
        const nowIso = new Date().toISOString();

        const title = document.getElementById('taskTitle').value;
        const memberId = document.getElementById('taskMember').value;
        const eventName = document.getElementById('taskEvent').value;
        const description = document.getElementById('taskDescription').value;
        const dueDate = document.getElementById('taskDueDate').value;
        const status = document.getElementById('taskStatus').value;

        const next = {
            title,
            memberId,
            eventName,
            description,
            dueDate,
            status
        };

        // HANDLE "ALL TEAM MEMBERS" (EXPLOSION)
        if (memberId === 'all') {
            const confirmAll = confirm('You are assigning this task to ALL team members. This will create individual tasks for each member. Continue?');
            if (!confirmAll) return;

            // If editing, delete the original first (if it existed)
            if (editId) {
                try {
                    const encoded = encodeURIComponent(editId);
                    await deleteRemote(`/team_tasks?id=${encoded}`);
                    if (typeof deleteRewardRemoteByTask === 'function') {
                        await deleteRewardRemoteByTask(editId);
                    }
                } catch (e) {
                    console.error('Error deleting original task during conversion:', e);
                }
            }

            const members = getAllTeamMembers();
            let createdCount = 0;

            for (const member of members) {
                const task = {
                    id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    ...next,
                    memberId: member.id,
                    createdAt: nowIso
                };
                
                await saveTaskRemote(task);
                // Optional: Notify individually (might be spammy if too many, but safe for small teams)
                // notifyTeam(member.id, formatTaskSms(task, 'Created'), { kind: 'task', action: 'created', id: task.id });
                createdCount++;
            }

            // Notify via "all" channel if needed, or just alert
            notifyTeam('all', `New Team Task: ${title}`, { kind: 'task', action: 'created_batch', count: createdCount });
            
            alert(`Successfully assigned task to ${createdCount} members.`);
            closeModal('taskModal');
            loadAllTasks();
            form.reset();
            delete form.dataset.editId;
            setTaskModalLabels(false);
            return;
        }

        // INDIVIDUAL ASSIGNMENT (Existing Logic)
        if (editId) {
            const taskToUpdate = adminTasks.find(t => t.id === editId);
            if (taskToUpdate) {
                const updatedTask = {
                    ...taskToUpdate,
                    ...next,
                    updatedAt: nowIso
                };
                await saveTaskRemote(updatedTask);
                notifyTeam(next.memberId, formatTaskSms(updatedTask, 'Updated'), { kind: 'task', action: 'updated', id: editId });
                alert('Task updated successfully!');
            } else {
                alert('Task not found. Please refresh.');
            }
        } else {
            const task = {
                id: 'task_' + Date.now(),
                ...next,
                createdAt: nowIso
            };
            await saveTaskRemote(task);
            notifyTeam(next.memberId, formatTaskSms(task, 'Created'), { kind: 'task', action: 'created', id: task.id });
            alert('Task assigned successfully!');
        }

        closeModal('taskModal');
        loadAllTasks();
        form.reset();
        delete form.dataset.editId;
        setTaskModalLabels(false);
    });
}

function setupScheduleForm() {
    const form = document.getElementById('scheduleForm');
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const editId = form.dataset.editId;
        const nowIso = new Date().toISOString();

        const next = {
            eventName: document.getElementById('scheduleEvent').value,
            memberId: document.getElementById('scheduleMember').value,
            date: document.getElementById('scheduleDate').value,
            startTime: document.getElementById('scheduleStartTime').value,
            endTime: document.getElementById('scheduleEndTime').value,
            location: document.getElementById('scheduleLocation').value,
            description: document.getElementById('scheduleDescription').value || ''
        };

        if (editId) {
            const scheduleToUpdate = adminSchedules.find(s => s.id === editId);
            if (scheduleToUpdate) {
                const updatedSchedule = {
                    ...scheduleToUpdate,
                    ...next,
                    updatedAt: nowIso
                };
                await saveScheduleRemote(updatedSchedule);
                notifyTeam(next.memberId, formatScheduleSms(updatedSchedule, 'Updated'), { kind: 'schedule', action: 'updated', id: editId });
                alert('Schedule updated successfully!');
            } else {
                alert('Schedule not found. Please refresh.');
            }
        } else {
            const schedule = {
                id: 'schedule_' + Date.now(),
                ...next,
                createdAt: nowIso
            };
            await saveScheduleRemote(schedule);
            notifyTeam(next.memberId, formatScheduleSms(schedule, 'Created'), { kind: 'schedule', action: 'created', id: schedule.id });
            alert('Schedule added successfully!');
        }

        closeModal('scheduleModal');
        loadAllSchedule();
        form.reset();
        delete form.dataset.editId;
        setScheduleModalLabels(false);
    });
}

function setupRewardForm() {
    const form = document.getElementById('rewardForm');
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        const editId = form.dataset.editId;
        const nowIso = new Date().toISOString();

        const title = document.getElementById('rewardTitle').value;
        const memberId = document.getElementById('rewardMember').value;
        const eventName = document.getElementById('rewardEvent').value;
        const amount = parseFloat(document.getElementById('rewardAmount').value);
        const date = document.getElementById('rewardDate').value;
        const description = document.getElementById('rewardDescription').value || '';

        const next = {
            title,
            memberId,
            eventName,
            amount,
            date,
            description
        };

        // HANDLE "ALL TEAM MEMBERS" (EXPLOSION)
        if (memberId === 'all') {
            const confirmAll = confirm('You are assigning this reward to ALL team members. This will create individual reward records for each member. Continue?');
            if (!confirmAll) return;

            // If editing, delete the original first
            if (editId) {
                try {
                    await deleteRemote(`/team_rewards?id=${encodeURIComponent(editId)}`);
                } catch (e) {
                    console.error('Error deleting original reward during conversion:', e);
                }
            }

            const members = getAllTeamMembers();
            let createdCount = 0;

            for (const member of members) {
                const reward = {
                    id: 'reward_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    ...next,
                    memberId: member.id,
                    createdAt: nowIso
                };
                
                await saveRewardRemote(reward);
                createdCount++;
            }

            notifyTeam('all', `New Reward: ${title}`, { kind: 'reward', action: 'created_batch', count: createdCount });
            
            alert(`Successfully assigned reward to ${createdCount} members.`);
            closeModal('rewardModal');
            loadAllRewards();
            form.reset();
            delete form.dataset.editId;
            setRewardModalLabels(false);
            return;
        }

        // INDIVIDUAL ASSIGNMENT (Existing Logic)
        if (editId) {
            const rewardToUpdate = adminRewards.find(r => r.id === editId);
            if (rewardToUpdate) {
                const updatedReward = {
                    ...rewardToUpdate,
                    ...next,
                    updatedAt: nowIso
                };
                await saveRewardRemote(updatedReward);
                notifyTeam(next.memberId, formatRewardSms(updatedReward, 'Updated'), { kind: 'reward', action: 'updated', id: editId });
                alert('Reward updated successfully!');
            } else {
                alert('Reward not found. Please refresh.');
            }
        } else {
            const reward = {
                id: 'reward_' + Date.now(),
                ...next,
                createdAt: nowIso
            };
            await saveRewardRemote(reward);
            notifyTeam(next.memberId, formatRewardSms(reward, 'Created'), { kind: 'reward', action: 'created', id: reward.id });
            alert('Reward assigned successfully!');
        }

        closeModal('rewardModal');
        loadAllRewards();
        form.reset();
        delete form.dataset.editId;
        setRewardModalLabels(false);
    });
}

function setupTrainingForm() {
    const form = document.getElementById('trainingForm');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const editId = form.dataset.editId;
        const nowIso = new Date().toISOString();

        const title = String(document.getElementById('trainingTitle').value || '').trim();
        const provider = String(document.getElementById('trainingProvider').value || '').trim();
        const memberId = String(document.getElementById('trainingMember').value || '').trim() || 'all';
        const url = String(document.getElementById('trainingUrl').value || '').trim();
        const description = String(document.getElementById('trainingDescription').value || '').trim();

        if (!title || !provider || !url) {
            alert('Title, Provided By, and Video URL are required.');
            return;
        }

        const next = { title, provider, memberId, url, description };

        if (editId) {
            const videoToUpdate = adminTrainingVideos.find(v => String(v.id) === String(editId));
            if (videoToUpdate) {
                const updatedVideo = { ...videoToUpdate, ...next, updatedAt: nowIso };
                await saveTrainingRemote(updatedVideo);
                notifyTeam(memberId, formatTrainingSms(updatedVideo, 'Updated'), { kind: 'training', action: 'updated', id: editId });
                alert('Training video updated successfully!');
            } else {
                alert('Training video not found. Please refresh.');
            }
        } else {
            const newVideo = {
                id: 'training_' + Date.now(),
                ...next,
                createdAt: nowIso
            };
            await saveTrainingRemote(newVideo);
            notifyTeam(memberId, formatTrainingSms(newVideo, 'Created'), { kind: 'training', action: 'created', id: newVideo.id });
            alert('Training video added successfully!');
        }

        closeModal('trainingModal');
        loadAllTrainingVideos();
        form.reset();
        delete form.dataset.editId;
        setTrainingModalLabels(false);
    });
}

// Delete functions
async function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    // Find task for notification
    const tasks = adminTasks || [];
    const removed = tasks.find(t => t.id === taskId);
    
    try {
        if (removed) {
             notifyTeam(removed.memberId, formatTaskSms(removed, 'Deleted'), { kind: 'task', action: 'deleted', id: taskId });
        }
        const encoded = encodeURIComponent(taskId);
        await deleteRemote(`/team_tasks?id=${encoded}`);
        await deleteRewardRemoteByTask(taskId);
    } catch (e) {
        console.error('Failed to delete task remote:', e);
    }
    
    await new Promise(r => setTimeout(r, 200));
    loadAllTasks();
}

function deleteSchedule(scheduleId) {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    
    const schedules = adminSchedules || [];
    const removed = schedules.find(s => s.id === scheduleId);
    
    deleteRemote(`/team_schedule?id=${encodeURIComponent(scheduleId)}`).then(() => {
        if (removed) notifyTeam(removed.memberId, formatScheduleSms(removed, 'Deleted'), { kind: 'schedule', action: 'deleted', id: scheduleId });
        loadAllSchedule();
    }).catch(e => {
         console.error('Failed to delete schedule remote:', e);
    });
}

function deleteReward(rewardId) {
    if (!confirm('Are you sure you want to delete this reward? This is usually only needed to fix mistakes.')) return;

    const rewards = adminRewards || [];
    const removed = rewards.find(r => r.id === rewardId);
    
    deleteRemote(`/team_rewards?id=${encodeURIComponent(rewardId)}`).then(() => {
        if (removed) notifyTeam(removed.memberId, formatRewardSms(removed, 'Deleted'), { kind: 'reward', action: 'deleted', id: rewardId });
        loadAllRewards();
    }).catch(e => {
        console.error('Failed to delete reward remote:', e);
    });
}

async function deleteTrainingVideo(trainingId) {
    if (!confirm('Are you sure you want to delete this training video?')) return;
    const videos = adminTrainingVideos || [];
    const removed = videos.find(v => String(v && v.id) === String(trainingId));
    
    try {
        await deleteTrainingRemote(trainingId);
        if (removed) {
            notifyTeam(removed.memberId || 'all', formatTrainingSms(removed, 'Deleted'), { kind: 'training', action: 'deleted', id: trainingId });
        }
    } catch (e) {
        console.error('Failed to delete training video remote:', e);
    }
    loadAllTrainingVideos();
}

// Edit functions (placeholder - can be expanded)
function editTask(taskId) {
    const tasks = adminTasks || [];
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
        alert('Task not found. Please refresh and try again.');
        return;
    }

    populateMemberSelect('taskMember');

    const form = document.getElementById('taskForm');
    form.dataset.editId = taskId;

    document.getElementById('taskTitle').value = task.title || '';
    document.getElementById('taskMember').value = task.memberId || '';
    document.getElementById('taskEvent').value = task.eventName || '';
    document.getElementById('taskDescription').value = task.description || '';
    document.getElementById('taskDueDate').value = task.dueDate || '';
    document.getElementById('taskStatus').value = task.status || 'pending';

    setTaskModalLabels(true);
    document.getElementById('taskModal').style.display = 'flex';
}

function extendTask(taskId) {
    const tasks = adminTasks || [];
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
        alert('Task not found. Please refresh and try again.');
        return;
    }

    const currentCount = Number(task.extensionCount || 0);
    if (currentCount >= 3) {
        alert('This task has already been extended 3 times (limit reached).');
        return;
    }

    const currentDue = task.dueDate;
    let defaultNext = new Date();
    if (currentDue) {
        const d = new Date(currentDue);
        d.setDate(d.getDate() + 1);
        defaultNext = d;
    } else {
        defaultNext.setDate(defaultNext.getDate() + 1);
    }
    
    const defaultNextStr = defaultNext.toISOString().split('T')[0];
    const newDate = prompt(`Enter new due date (YYYY-MM-DD).\nExtension ${currentCount + 1}/3`, defaultNextStr);
    
    if (newDate) {
        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
            alert('Invalid date format. Please use YYYY-MM-DD.');
            return;
        }

        task.dueDate = newDate;
        task.extensionCount = currentCount + 1;
        task.updatedAt = new Date().toISOString();
        
        saveTaskRemote(task).then(() => {
             notifyTeam(task.memberId, `Task "${task.title}" extended to ${newDate} (${task.extensionCount}/3)`, { kind: 'task', action: 'updated', id: task.id });
             loadAllTasks();
             alert(`Task extended successfully (${task.extensionCount}/3).`);
        }).catch(e => {
            console.error('Failed to notify/save remote:', e);
            alert('Failed to extend task remote.');
        });
    }
}

function editSchedule(scheduleId) {
    const schedules = adminSchedules || [];
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) {
        alert('Schedule not found. Please refresh and try again.');
        return;
    }

    populateMemberSelect('scheduleMember', true);

    const form = document.getElementById('scheduleForm');
    form.dataset.editId = scheduleId;

    document.getElementById('scheduleEvent').value = schedule.eventName || '';
    document.getElementById('scheduleMember').value = schedule.memberId || '';
    document.getElementById('scheduleDate').value = schedule.date || '';
    document.getElementById('scheduleStartTime').value = schedule.startTime || '';
    document.getElementById('scheduleEndTime').value = schedule.endTime || '';
    document.getElementById('scheduleLocation').value = schedule.location || '';
    document.getElementById('scheduleDescription').value = schedule.description || '';

    setScheduleModalLabels(true);
    document.getElementById('scheduleModal').style.display = 'flex';
}

function editReward(rewardId) {
    const rewards = adminRewards || [];
    const reward = rewards.find(r => r.id === rewardId);
    if (!reward) {
        alert('Reward not found. Please refresh and try again.');
        return;
    }

    populateMemberSelect('rewardMember');

    const form = document.getElementById('rewardForm');
    form.dataset.editId = rewardId;

    document.getElementById('rewardTitle').value = reward.title || '';
    document.getElementById('rewardMember').value = reward.memberId || '';
    document.getElementById('rewardEvent').value = reward.eventName || '';
    document.getElementById('rewardAmount').value = typeof reward.amount === 'number' ? reward.amount : (reward.amount || 0);
    document.getElementById('rewardDate').value = reward.date || '';
    document.getElementById('rewardDescription').value = reward.description || '';

    setRewardModalLabels(true);
    document.getElementById('rewardModal').style.display = 'flex';
}

function editTrainingVideo(trainingId) {
    // Use adminTrainingVideos global instead of localStorage
    const videos = adminTrainingVideos || [];
    const video = videos.find(v => String(v && v.id) === String(trainingId));
    if (!video) {
        alert('Training video not found. Please refresh and try again.');
        return;
    }

    populateTrainingMemberSelect();

    const form = document.getElementById('trainingForm');
    if (!form) return;
    form.dataset.editId = String(trainingId);

    document.getElementById('trainingTitle').value = String(video.title || '');
    document.getElementById('trainingProvider').value = String(video.provider || '');
    document.getElementById('trainingMember').value = String(video.memberId || 'all');
    document.getElementById('trainingUrl').value = String(video.url || '');
    document.getElementById('trainingDescription').value = String(video.description || '');

    setTrainingModalLabels(true);
    const modal = document.getElementById('trainingModal');
    if (modal) modal.style.display = 'flex';
}

function setTaskModalLabels(isEditing) {
    const modal = document.getElementById('taskModal');
    if (!modal) return;
    const header = modal.querySelector('.modal-header h2');
    const submitBtn = modal.querySelector('button[type="submit"]');
    if (header) header.textContent = isEditing ? 'Edit Task' : 'Assign Task';
    if (submitBtn) submitBtn.textContent = isEditing ? 'Save Changes' : 'Assign Task';
}

function setScheduleModalLabels(isEditing) {
    const modal = document.getElementById('scheduleModal');
    if (!modal) return;
    const header = modal.querySelector('.modal-header h2');
    const submitBtn = modal.querySelector('button[type="submit"]');
    if (header) header.textContent = isEditing ? 'Edit Event Schedule' : 'Add Event Schedule';
    if (submitBtn) submitBtn.textContent = isEditing ? 'Save Changes' : 'Add Schedule';
}

function setRewardModalLabels(isEditing) {
    const modal = document.getElementById('rewardModal');
    if (!modal) return;
    const header = modal.querySelector('.modal-header h2');
    const submitBtn = modal.querySelector('button[type="submit"]');
    if (header) header.textContent = isEditing ? 'Edit Reward' : 'Assign Reward';
    if (submitBtn) submitBtn.textContent = isEditing ? 'Save Changes' : 'Assign Reward';
}

function setTrainingModalLabels(isEditing) {
    const modal = document.getElementById('trainingModal');
    if (!modal) return;
    const header = modal.querySelector('.modal-header h2');
    const submitBtn = modal.querySelector('button[type="submit"]');
    if (header) header.textContent = isEditing ? 'Edit Training Video' : 'Add Training Video';
    if (submitBtn) submitBtn.textContent = isEditing ? 'Save Changes' : 'Save Video';
}

// Refresh functions
function refreshTasks() {
    loadAllTasks();
}

function refreshSchedule() {
    loadAllSchedule();
}

function refreshRewards() {
    loadAllRewards();
}

function refreshTraining() {
    loadAllTrainingVideos();
}

// Format date helper
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Eliminate Task Function
async function eliminateTask(taskId) {
    if (!confirm('Are you sure you want to mark this task as ELIMINATED (Failed)?\nThis will stop extensions and mark it as failed.')) return;

    const task = adminTasks.find(t => t.id === taskId);
    if (task) {
        task.status = 'eliminated';
        task.updatedAt = new Date().toISOString();
        const now = new Date();
        task.description = (task.description || '') + `\n[Admin ${now.toLocaleTimeString()}]: Manually eliminated.`;
        
        try {
            await saveTaskRemote(task);
            notifyTeam(task.memberId, `Task "${task.title}" has been eliminated (Failed).`, { kind: 'task', action: 'updated', id: task.id });
        } catch (e) {
            console.error('Failed to sync elimination:', e);
            alert('Failed to update task remotely.');
            return;
        }
        
        loadAllTasks();
        alert('Task eliminated.');
    }
}

async function cleanupDuplicateSchedules() {
    if (!confirm('This will detect and remove duplicate SCHEDULES (same Title, Member, and Recurrence).\nAre you sure?')) return;
    
    try {
        const endpoint = isDirectNeon() ? '/team_scheduled_tasks' : '/scheduled_tasks';
        const schedules = await fetchRemote(endpoint);
        if (!Array.isArray(schedules)) {
            alert('No schedules found.');
            return;
        }

        const seen = new Map();
        const toDelete = [];
        
        // Sort: Prioritize keeping schedules that have run recently
        schedules.sort((a, b) => {
            const lastA = a.lastGenerated ? new Date(a.lastGenerated) : new Date(0);
            const lastB = b.lastGenerated ? new Date(b.lastGenerated) : new Date(0);
            if (lastA > lastB) return -1; 
            if (lastB > lastA) return 1;
            
            const createdA = new Date(a.createdAt || 0);
            const createdB = new Date(b.createdAt || 0);
            return createdA - createdB;
        });

        schedules.forEach(sch => {
            const key = `${sch.title}_${sch.memberId}_${sch.recurrence}`;
            if (seen.has(key)) {
                toDelete.push(sch);
            } else {
                seen.set(key, sch);
            }
        });

        if (toDelete.length === 0) {
            alert('No duplicate schedules found.');
            return;
        }

        if (!confirm(`Found ${toDelete.length} duplicate schedules. Delete them?`)) return;

        let count = 0;
        for (const sch of toDelete) {
            try {
                const delEndpoint = isDirectNeon() ? `/team_scheduled_tasks?id=${sch.id}` : `/scheduled_tasks?id=${sch.id}`;
                await deleteRemote(delEndpoint);
                count++;
            } catch (e) {
                console.error(e);
            }
        }
        
        if (typeof loadScheduledTasks === 'function') {
            loadScheduledTasks();
        }
        alert(`Deleted ${count} duplicate schedules.`);

    } catch (e) {
        console.error(e);
        alert('Error cleaning schedules.');
    }
}

async function cleanupDuplicates() {
    if (!confirm('This will detect and remove duplicate TASKS (same Title, Member, and Date).\nAre you sure?')) return;

    try {
        const tasks = await fetchTasksRemote();
        if (!Array.isArray(tasks)) {
             alert('No tasks found.');
             return;
        }

        const seen = new Map();
        const toDelete = [];

        // Sort tasks to prioritize keeping those with originScheduleId or older creation
        tasks.sort((a, b) => {
            // Priority 1: Has originScheduleId (keep generated ones with links)
            if (a.originScheduleId && !b.originScheduleId) return -1;
            if (!a.originScheduleId && b.originScheduleId) return 1;
            // Priority 2: Older creation date (keep original)
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateA - dateB;
        });

        tasks.forEach(task => {
            // Key: Title + MemberID + DueDate (or CreatedDate if DueDate missing)
            const date = task.dueDate ? task.dueDate : (task.createdAt ? task.createdAt.split('T')[0] : '');
            const mId = task.memberId || 'unknown';
            const key = `${(task.title || '').trim()}_${mId}_${date}`;

            if (seen.has(key)) {
                // Found a duplicate
                toDelete.push(task);
            } else {
                seen.set(key, task);
            }
        });

        if (toDelete.length === 0) {
            alert('No duplicates found.');
            return;
        }

        if (!confirm(`Found ${toDelete.length} duplicates. Delete them?`)) return;

        let deletedCount = 0;
        for (const task of toDelete) {
             try {
                 const endpoint = isDirectNeon() ? `/team_tasks?id=${task.id}` : `/team_tasks?id=${task.id}`;
                 await deleteRemote(endpoint);
                 deletedCount++;
             } catch(e) {
                 console.error('Failed to delete duplicate:', e);
             }
        }
        
        loadAllTasks();
        alert(`Deleted ${deletedCount} duplicates.`);

    } catch(e) {
        console.error(e);
        alert('Error during cleanup.');
    }
}



// --- Scheduled Tasks Management ---

async function loadScheduledTasks() {
    const tbody = document.querySelector('#scheduledTasksTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading...</td></tr>';

    try {
        const endpoint = isDirectNeon() ? '/team_scheduled_tasks' : '/scheduled_tasks';
        let schedules = await fetchRemote(endpoint);
        
        if (!Array.isArray(schedules) || schedules.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 15px; color: #666;">No scheduled tasks found.</td></tr>';
            return;
        }

        schedules.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        
        const members = getAllTeamMembers();
        tbody.innerHTML = schedules.map(sch => {
            const member = members.find(m => m.id === sch.memberId) || { name: sch.memberId === 'all' ? 'All Members' : 'Unknown' };
            const statusClass = sch.isActive === false ? 'status-eliminated' : 'status-completed';
            const statusText = sch.isActive === false ? 'Inactive' : 'Active';
            
            // Format schedule time/recurrence
            let timeInfo = sch.recurrence || 'One-time';
            if (sch.startTime) timeInfo += ` at ${sch.startTime}`;

            return `
                <tr>
                    <td>
                        <strong>${sch.title}</strong>
                        ${sch.dailyVariations ? '<br><span class="badge" style="font-size:0.7em; background:#6f42c1;">Daily Variations</span>' : ''}
                    </td>
                    <td>${member.name}</td>
                    <td>${timeInfo}</td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="editScheduledTask('${sch.id}')">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteScheduledTask('${sch.id}')">Delete</button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        console.error('Error loading schedules:', e);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: red;">Error loading schedules.</td></tr>';
    }
}

function showAddScheduledTaskForm() {
    const container = document.getElementById('scheduledTaskFormContainer');
    const form = document.getElementById('scheduledTaskForm');
    if (container) {
        container.style.display = 'block';
        if (form) form.reset();
        document.getElementById('scheduledTaskId').value = '';
        const titleEl = document.getElementById('scheduledTaskFormTitle');
        if (titleEl) titleEl.textContent = 'Schedule New Task';
        
        // Default to Weekly
        const weeklyCb = document.getElementById('scheduledTaskWeekly');
        if (weeklyCb) {
            weeklyCb.checked = true;
            toggleWeeklyOptions(true);
        }
    }
}

function hideScheduledTaskForm() {
    const container = document.getElementById('scheduledTaskFormContainer');
    if (container) container.style.display = 'none';
}

function toggleWeeklyOptions(show) {
    const options = document.getElementById('weeklyTaskOptions');
    const dateGroup = document.getElementById('scheduledAtGroup');
    if (options) options.style.display = show ? 'block' : 'none';
    if (dateGroup) dateGroup.style.display = show ? 'none' : 'block';
}

async function editScheduledTask(id) {
    try {
        const endpoint = isDirectNeon() ? '/team_scheduled_tasks' : '/scheduled_tasks';
        let schedules = await fetchRemote(endpoint);

        const sch = schedules.find(s => s.id === id);
        
        if (!sch) return;
        
        showAddScheduledTaskForm();
        const titleEl = document.getElementById('scheduledTaskFormTitle');
        if (titleEl) titleEl.textContent = 'Edit Scheduled Task';
        
        document.getElementById('scheduledTaskId').value = sch.id;
        document.getElementById('scheduledTaskTitle').value = sch.title;
        document.getElementById('scheduledTaskMember').value = sch.memberId;
        document.getElementById('scheduledTaskDesc').value = sch.description || '';
        document.getElementById('scheduledTaskEvent').value = sch.eventName || '';
        document.getElementById('scheduledTaskReward').value = sch.rewardAmount || 0;
        
        const isWeekly = sch.recurrence === 'weekly-mon-fri';
        document.getElementById('scheduledTaskWeekly').checked = isWeekly;
        toggleWeeklyOptions(isWeekly);
        
        if (isWeekly) {
            document.getElementById('scheduledTaskStartTime').value = sch.startTime || '09:00';
            document.getElementById('scheduledTaskEndTime').value = sch.endTime || '18:00';
            document.getElementById('scheduledTaskAutoExtend').checked = sch.autoExtend !== false;
            
            if (sch.dailyVariations) {
                document.getElementById('scheduledTaskDailyVariations').checked = true;
                document.getElementById('dailyVariationsContainer').style.display = 'block';
                
                Object.entries(sch.dailyVariations).forEach(([day, data]) => {
                    const titleInput = document.querySelector(`.daily-title[data-day="${day}"]`);
                    const descInput = document.querySelector(`.daily-desc[data-day="${day}"]`);
                    if (titleInput) titleInput.value = data.title || '';
                    if (descInput) descInput.value = data.description || '';
                });
            }
        } else {
            if (sch.scheduledAt) {
                 document.getElementById('scheduledTaskTime').value = sch.scheduledAt;
            }
            if (sch.dueDate) {
                document.getElementById('scheduledTaskDueDate').value = sch.dueDate;
            }
        }
        
    } catch (e) {
        console.error('Error editing schedule:', e);
        alert('Failed to load schedule details.');
    }
}

async function handleScheduledTaskSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('scheduledTaskId').value;
    const title = document.getElementById('scheduledTaskTitle').value;
    const memberId = document.getElementById('scheduledTaskMember').value;
    const isWeekly = document.getElementById('scheduledTaskWeekly').checked;
    
    if (!title || !memberId) {
        alert('Please fill in required fields.');
        return;
    }

    const schedule = {
        id: id || `sch_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title,
        memberId,
        recurrence: isWeekly ? 'weekly-mon-fri' : 'one-time',
        createdAt: new Date().toISOString(),
        isActive: true,
        description: document.getElementById('scheduledTaskDesc').value,
        eventName: document.getElementById('scheduledTaskEvent').value || 'Scheduled Task',
        rewardAmount: document.getElementById('scheduledTaskReward').value
    };

    if (isWeekly) {
        schedule.startTime = document.getElementById('scheduledTaskStartTime').value;
        schedule.endTime = document.getElementById('scheduledTaskEndTime').value;
        schedule.autoExtend = document.getElementById('scheduledTaskAutoExtend').checked;
        
        if (document.getElementById('scheduledTaskDailyVariations').checked) {
            schedule.dailyVariations = {};
            document.querySelectorAll('.day-input').forEach(div => {
                const titleInput = div.querySelector('.daily-title');
                const descInput = div.querySelector('.daily-desc');
                const day = titleInput.dataset.day;
                if (titleInput.value.trim()) {
                    schedule.dailyVariations[day] = {
                        title: titleInput.value.trim(),
                        description: descInput.value.trim()
                    };
                }
            });
        }
    } else {
        const scheduledTime = document.getElementById('scheduledTaskTime').value;
        const dueDate = document.getElementById('scheduledTaskDueDate').value;
        if (scheduledTime) {
            schedule.scheduledAt = scheduledTime;
        }
        if (dueDate) {
            schedule.dueDate = dueDate;
        }
    }

    try {
        const endpoint = isDirectNeon() ? '/team_scheduled_tasks' : '/scheduled_tasks';
        await saveRemote(endpoint, schedule);
        alert('Schedule saved successfully!');
        hideScheduledTaskForm();
        loadScheduledTasks();
    } catch (e) {
        console.error('Error saving schedule:', e);
        alert('Failed to save schedule.');
    }
}

async function deleteScheduledTask(id) {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    try {
        const endpoint = isDirectNeon() ? `/team_scheduled_tasks?id=${id}` : `/scheduled_tasks?id=${id}`;
        await deleteRemote(endpoint);
        loadScheduledTasks();
    } catch (e) {
        console.error('Error deleting schedule:', e);
        alert('Failed to delete schedule.');
    }
}

async function manualSyncSchedules() {
    if (!confirm('This will check all schedules and generate tasks for today if needed.\nContinue?')) return;
    
    const btn = document.getElementById('syncTasksBtn');
    const originalText = btn ? btn.textContent : '';
    if (btn) btn.textContent = 'Syncing...';

    try {
        const schEndpoint = isDirectNeon() ? '/team_scheduled_tasks' : '/scheduled_tasks';
        let schedules = await fetchRemote(schEndpoint);
        
        if (!Array.isArray(schedules) || schedules.length === 0) {
            console.log('No schedules found to sync.');
            alert('No active schedules found.');
            if (btn) btn.textContent = originalText;
            return;
        }

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

        let generatedCount = 0;

        for (const sch of schedules) {
            if (sch.isActive === false) continue;
            
            // Check if already generated today
            if (sch.lastGenerated === todayStr) continue;

            let shouldGenerate = false;
            let taskTitle = sch.title;
            let taskDesc = sch.description;

            if (sch.recurrence === 'weekly-mon-fri') {
                if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                    shouldGenerate = true;
                    // Handle Daily Variations
                    if (sch.dailyVariations && sch.dailyVariations[dayOfWeek]) {
                        taskTitle = sch.dailyVariations[dayOfWeek].title || taskTitle;
                        taskDesc = sch.dailyVariations[dayOfWeek].description || taskDesc;
                    }
                }
            } else if (sch.recurrence === 'daily') {
                shouldGenerate = true;
            } else if (sch.recurrence === 'one-time' && sch.scheduledAt) {
                const scheduledDate = new Date(sch.scheduledAt).toISOString().split('T')[0];
                if (scheduledDate <= todayStr) {
                    shouldGenerate = true;
                }
            }

            if (shouldGenerate) {
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
                        createdAt: new Date().toISOString(),
                        originScheduleId: sch.id,
                        autoExtend: sch.autoExtend || false,
                        rewardAmount: sch.rewardAmount
                    };
                    
                    // Save to remote only
                    const taskEndpoint = isDirectNeon() ? '/team_tasks' : '/team_tasks';
                    await saveRemote(taskEndpoint, newTask);
                    generatedCount++;
                }

                // Update Schedule lastGenerated
                sch.lastGenerated = todayStr;
                
                await saveRemote(schEndpoint, sch);
            }
        }

        alert(`Sync complete. Generated ${generatedCount} new tasks.`);
        loadAllTasks();

    } catch (e) {
        console.error('Sync error:', e);
        alert('Error syncing schedules.');
    } finally {
        if (btn) btn.textContent = originalText;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const weeklyCb = document.getElementById('scheduledTaskWeekly');
    if (weeklyCb) {
        weeklyCb.addEventListener('change', (e) => toggleWeeklyOptions(e.target.checked));
    }
    
    const dailyVarCb = document.getElementById('scheduledTaskDailyVariations');
    if (dailyVarCb) {
        dailyVarCb.addEventListener('change', (e) => {
            const container = document.getElementById('dailyVariationsContainer');
            if (container) container.style.display = e.target.checked ? 'block' : 'none';
        });
    }

    const form = document.getElementById('scheduledTaskForm');
    if (form) {
        form.addEventListener('submit', handleScheduledTaskSubmit);
    }
    
    // Initial load of scheduled tasks
    if (typeof loadScheduledTasks === 'function') {
        // Delay slightly to ensure auth is ready if needed
        setTimeout(loadScheduledTasks, 1000);
    }
});



// initDailyVariations removed to use HTML structure

