/* ============================================
   The Apex Circle - Team Dashboard (Remote Only)
   ============================================ */

// Team members data is now loaded from data.js

// Initialize team dashboard
document.addEventListener('DOMContentLoaded', function() {
    const user = getCurrentUser();
    if (!user || user.role !== 'team') {
        // Redirect to login page (using cleaner path)
        window.location.href = 'login';
        return;
    }

    setupMobileSidebarToggle();

    // Debug user data
    console.log('Dashboard User:', user);

    const nameEl = document.getElementById('teamMemberName');
    if (nameEl) {
        if (user.name) {
            nameEl.textContent = user.name;
        } else if (user.username) {
            nameEl.textContent = user.username;
        } else {
            nameEl.textContent = 'Team Member';
        }
    }

    const posEl = document.getElementById('teamMemberPosition');
    if (posEl) {
        posEl.textContent = user.position || 'Team Member';
    }

    const photoEl = document.getElementById('teamMemberPhoto');
    if (photoEl) {
        const src = user.profilePhoto ? String(user.profilePhoto) : '';
        if (src) {
            photoEl.src = src;
            photoEl.style.display = '';
            photoEl.onerror = function () {
                photoEl.style.display = 'none';
            };
        } else {
            photoEl.style.display = 'none';
        }
    }

    initTabs();
    setupTaskProofForm();
    
    syncNow();
    updateLastSyncLabel();

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }

    // Sync every 10 seconds for "live" updates
    setInterval(function () {
        syncNow();
        updateLastSyncLabel();
    }, 10000);
});

// Memory-only storage for current session
let mem_tasks = [];
let mem_rewards = [];
let mem_schedules = [];
let mem_notifications = [];
let mem_notifications_seen = new Set();
let currentProofTaskId = null;

// Helper to get current user safely
function getCurrentUser() {
    if (typeof window.getCurrentUser === 'function') return window.getCurrentUser();
    // Fallback if auth.js not loaded yet or different scope
    try {
        const u = sessionStorage.getItem('apex_user');
        return u ? JSON.parse(u) : null;
    } catch { return null; }
}

function updateLastSyncLabel() {
    const el = document.getElementById('lastSyncLabel');
    if (!el) return;
    const now = new Date();
    el.textContent = 'Last sync: ' + now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function syncNow() {
    const user = getCurrentUser();
    if (!user || user.role !== 'team') return;
    loadTasks();
    loadSchedule();
    loadRewards();
    loadTraining();
    loadUpdates();
    loadNotifications();
    loadLeaderboard();
}

// Remote API Helpers
function getApiBase() {
    if (window.APEX_CONFIG && window.APEX_CONFIG.getApiUrl) {
        return window.APEX_CONFIG.getApiUrl();
    }
    // Check for override in session storage
    const override = sessionStorage.getItem('apex_api_base');
    if (override) return override;

    return '/.netlify/functions';
}

function getNeonApiKey() {
    return sessionStorage.getItem('apex_neon_key') || '';
}

async function fetchRemote(endpoint) {
    const base = getApiBase();
    if (!base) return null;

    try {
        let ep = endpoint;
        // Fix for potentially different endpoint naming conventions if needed
        if (ep.startsWith('/team_scheduled_tasks')) {
            // Mapping check if backend uses different table name
        }
        
        // Add timestamp to prevent caching
        const sep = ep.includes('?') ? '&' : '?';
        const url = `${base}${ep}${sep}t=${Date.now()}`;
        
        const headers = {};
        const apiKey = getNeonApiKey();
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const resp = await fetch(url, { headers });
        if (!resp.ok) return null;
        const data = await resp.json();
        
        // Handle various response structures
        if (data && typeof data === 'object') {
            if (Array.isArray(data)) return data;
            if (data.tasks && Array.isArray(data.tasks)) return data.tasks;
            if (data.rewards && Array.isArray(data.rewards)) return data.rewards;
            if (data.ok && Array.isArray(data.tasks)) return data.tasks; // Handle {ok:true, tasks:[]} format
        }
        return [];
    } catch (e) {
        console.error(`Fetch ${endpoint} error:`, e);
        return null;
    }
}

async function saveRemote(endpoint, data) {
    const base = getApiBase();
    if (!base) return false;

    try {
        const headers = { 'Content-Type': 'application/json' };
        const apiKey = getNeonApiKey();
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
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

function fetchMemberTasks(memberId) {
    const id = String(memberId || '').trim();
    const endpoint = id 
        ? `/team_tasks?or=(memberId.eq.${encodeURIComponent(id)},memberId.eq.all)`
        : '/team_tasks';
        
    return fetchRemote(endpoint).then(tasks => {
        if (!Array.isArray(tasks)) return [];
        // Filter strictly client-side too for safety
        return tasks.filter(t => t && (String(t.memberId) === String(id) || String(t.memberId) === 'all'));
    }).catch(e => {
        console.warn('Fetch tasks failed:', e);
        return [];
    });
}

function fetchMemberSchedule(memberId) {
    const id = String(memberId || '').trim();
    const endpoint = id
        ? `/team_schedule?or=(memberId.eq.${encodeURIComponent(id)},memberId.eq.all)`
        : '/team_schedule';
    return fetchRemote(endpoint).then(data => {
        if (!Array.isArray(data)) return [];
        return data.filter(s => String(s.memberId) === String(id) || String(s.memberId) === 'all');
    }).catch(e => {
        console.warn('Fetch schedule failed:', e);
        return [];
    });
}

function fetchMemberRewards(memberId) {
    const id = String(memberId || '').trim();
    const endpoint = id
        ? `/team_rewards?memberId=eq.${encodeURIComponent(id)}`
        : '/team_rewards';
    return fetchRemote(endpoint).then(data => {
        if (!Array.isArray(data)) return [];
        return data.filter(r => String(r && r.memberId) === String(id));
    }).catch(e => {
        console.warn('Fetch rewards failed:', e);
        return [];
    });
}

function saveTaskRemote(task) {
    return saveRemote('/team_tasks', task);
}

window.openSyncSettings = function() {
    alert('Sync settings are now managed centrally.');
};

window.saveSyncSettings = function() {
    alert('Sync settings are now managed centrally.');
};

// Notifications (Memory Only)
function loadNotifications() {
    const user = getCurrentUser();
    if (!user) return;
    // We could fetch notifications from server if there was an endpoint
    // For now, if no endpoint exists, we just clear/hide them or use memory list if pushed
    // Assuming no persistence requested for notifications unless server supports it
    renderNotifications(document.getElementById('teamNotifications'), Array.from(mem_notifications));
}

function renderNotifications(container, list) {
    if (!container) return;
    if (!list || list.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }
    // Simple render (same as before but simplified)
    container.style.display = '';
    const latest = list.slice(0, 5);
    container.innerHTML = `
        <div class="content-card" style="border-left: 4px solid var(--primary-color);">
            <div class="content-card-header">
                <h2 class="content-card-title">Updates</h2>
                <button class="btn btn-primary btn-sm" onclick="clearNotifications()">Clear</button>
            </div>
            <div style="display: grid; gap: var(--spacing-sm); margin-top: var(--spacing-md);">
                ${latest.map(n => `
                    <div style="padding: var(--spacing-sm); border: 1px solid var(--border-color); border-radius: 8px;">
                        <div>${String(n.message || '')}</div>
                        <div style="font-size: 0.8em; color: gray;">${n.createdAt ? formatDate(n.createdAt) : ''}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

window.clearNotifications = function() {
    mem_notifications = [];
    loadNotifications();
};

function setupMobileSidebarToggle() {
    const sidebar = document.querySelector('.sidebar');
    const header = document.querySelector('.dashboard-header');
    if (!sidebar || !header) return;

    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }

    const setOpen = (open) => {
        sidebar.classList.toggle('active', Boolean(open));
        overlay.classList.toggle('active', Boolean(open));
        document.body.classList.toggle('sidebar-open', Boolean(open));
    };

    let toggleBtn = header.querySelector('.mobile-menu-toggle');
    if (!toggleBtn) {
        toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'mobile-menu-toggle';
        toggleBtn.textContent = '☰';
        header.insertBefore(toggleBtn, header.firstChild);
    }

    if (!toggleBtn.dataset.bound) {
        toggleBtn.dataset.bound = '1';
        toggleBtn.addEventListener('click', () => setOpen(!sidebar.classList.contains('active')));
    }

    if (!overlay.dataset.bound) {
        overlay.dataset.bound = '1';
        overlay.addEventListener('click', () => setOpen(false));
    }

    document.querySelectorAll('.sidebar-menu a').forEach(a => {
        if (a.dataset.mobileBound) return;
        a.dataset.mobileBound = '1';
        a.addEventListener('click', () => setOpen(false));
    });
}

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

// Auto-Eliminate Check
async function checkAndEliminateTasks(tasks) {
    if (!Array.isArray(tasks)) return tasks;
    const now = new Date();
    
    for (const task of tasks) {
         if (task.status === 'completed' || task.status === 'eliminated') continue;
         
         if ((task.extensionCount || 0) >= 3) {
             if (task.dueDate) {
                 const timeStr = task.endTime || '23:59';
                 const deadline = new Date(`${task.dueDate}T${timeStr}:00`);
                 
                 if (!isNaN(deadline.getTime()) && now > deadline) {
                     task.status = 'eliminated';
                     task.updatedAt = new Date().toISOString();
                     task.description = (task.description || '') + `\n[System]: Eliminated (Max extensions).`;
                     
                     // Fire and forget save
                     saveTaskRemote(task).catch(console.warn);
                 }
             }
         }
    }
    return tasks;
}

// Generate Scheduled Tasks
async function checkAndGenerateScheduledTasks(user, currentTasks) {
    const userId = user && user.id ? String(user.id) : '';
    let schedules = [];
    
    // Fetch schedules remotely
    try {
        const endpoint = userId 
            ? `/team_scheduled_tasks?or=(memberId.eq.${encodeURIComponent(userId)},memberId.eq.all)`
            : '/team_scheduled_tasks';
        const remote = await fetchRemote(endpoint);
        if (Array.isArray(remote)) schedules = remote;
    } catch (e) {
        console.warn('Failed to load scheduled tasks for generation:', e);
        return [];
    }

    if (!schedules.length) return [];

    const now = new Date();
    if (now.getHours() < 9) return []; // Wait until 9 AM

    const todayStr = now.toISOString().split('T')[0];
    const dayOfWeek = now.getDay(); 
    const newTasks = [];

    for (const sch of schedules) {
        if (sch.isActive === false) continue;
        const target = String(sch.memberId || '');
        if (target !== 'all' && target !== userId) continue;

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
            if (scheduledDate <= todayStr && sch.status === 'pending') {
                shouldGenerate = true;
            }
        }

        if (!shouldGenerate) continue;

        // Check duplicates in current tasks (which are already fetched from server)
        const alreadyExists = currentTasks.some(t => {
            if (t.originScheduleId !== sch.id) return false;
            const taskDate = t.createdAt ? t.createdAt.split('T')[0] : '';
            return taskDate === todayStr;
        });

        if (alreadyExists) continue;

        const newTask = {
            id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            title: taskTitle,
            description: taskDesc,
            memberId: userId, 
            eventName: sch.eventName,
            dueDate: sch.recurrence === 'one-time' && sch.dueDate ? sch.dueDate : todayStr,
            status: 'pending',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
            originScheduleId: sch.id,
            autoExtend: sch.autoExtend || false,
            rewardAmount: sch.rewardAmount
        };

        await saveTaskRemote(newTask);
        newTasks.push(newTask);
    }

    return newTasks;
}

// Load Tasks
function loadTasks() {
    const user = getCurrentUser();
    if (!user || !user.id) return;

    fetchMemberTasks(user.id).then(async tasks => {
        mem_tasks = tasks; // Update memory
        
        const generated = await checkAndGenerateScheduledTasks(user, mem_tasks);
        if (generated.length > 0) {
            mem_tasks = [...mem_tasks, ...generated];
        }

        const processed = await checkAndEliminateTasks(mem_tasks);
        mem_tasks = processed;
        
        renderTasks(processed);
        updateTaskStats(processed);
    }).catch((e) => {
        console.error("Error loading tasks:", e);
        renderTasks([]);
        updateTaskStats([]);
    });
}

function renderTasks(tasks) {
    const containerToday = document.getElementById('tasksListToday');
    const containerPrevious = document.getElementById('tasksListPrevious');
    const containerLegacy = document.getElementById('tasksList');

    if (!containerToday && !containerPrevious && containerLegacy) {
        if (tasks.length === 0) {
            containerLegacy.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: var(--spacing-lg);">No tasks assigned yet.</p>';
            return;
        }
    }
    
    const renderCard = (task) => {
        const status = String(task.status || 'pending');
        const rewardStatus = String(task.rewardStatus || '');
        const proofUploaded = !!task.proofImage;
        const extensionLabel = getTaskExtensionLabel(task);
        const dueLabel = task.dueDate ? `Due: ${formatDate(task.dueDate)}${extensionLabel}` : '';
        
        let actionBtn = '';
        if (status === 'pending') {
            actionBtn = `<button class="btn btn-primary btn-sm" onclick="openProofModal('${task.id}')">Submit Proof</button>`;
        } else if (status === 'completed') {
            if (rewardStatus === 'approved') {
                actionBtn = `<span class="badge badge-success">Approved</span>`;
            } else if (rewardStatus === 'rejected') {
                actionBtn = `<span class="badge badge-danger">Rejected</span>`;
            } else {
                actionBtn = `<span class="badge badge-warning">Pending Approval</span>`;
            }
        } else if (status === 'eliminated') {
             actionBtn = `<span class="badge badge-danger">Eliminated</span>`;
        }

        return `
            <div class="task-card" style="margin-bottom: var(--spacing-md);">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: var(--spacing-sm);">
                    <h3 style="margin: 0; color: #000000;">${task.title || 'Task'}</h3>
                    ${actionBtn}
                </div>
                <div style="color: var(--text-primary); margin-bottom: var(--spacing-sm);">${task.description || ''}</div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-secondary);">
                    <span>${task.eventName || ''}</span>
                    <span>${dueLabel}</span>
                </div>
            </div>
        `;
    };

    const todayStr = new Date().toISOString().split('T')[0];
    const todayTasks = tasks.filter(t => (t.dueDate === todayStr || !t.dueDate) && t.status !== 'eliminated');
    const prevTasks = tasks.filter(t => t.dueDate !== todayStr || t.status === 'eliminated');

    if (containerToday) {
        containerToday.innerHTML = todayTasks.length ? todayTasks.map(renderCard).join('') : '<p class="text-muted text-center">No tasks for today.</p>';
    }
    if (containerPrevious) {
        containerPrevious.innerHTML = prevTasks.length ? prevTasks.map(renderCard).join('') : '<p class="text-muted text-center">No previous tasks.</p>';
    }
    if (containerLegacy && !containerToday) {
        containerLegacy.innerHTML = tasks.length ? tasks.map(renderCard).join('') : '<p class="text-muted text-center">No tasks.</p>';
    }
}

function updateTaskStats(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    
    const elTotal = document.getElementById('statTotalTasks');
    const elCompleted = document.getElementById('statCompletedTasks');
    const elPending = document.getElementById('statPendingTasks');

    if (elTotal) elTotal.textContent = total;
    if (elCompleted) elCompleted.textContent = completed;
    if (elPending) elPending.textContent = pending;
}

// Task Proof Logic
function setupTaskProofForm() {
    window.openProofModal = function(taskId) {
        currentProofTaskId = taskId;
        const task = mem_tasks.find(t => t.id === taskId);
        if (task) {
            const titleEl = document.getElementById('taskProofTaskTitle');
            if (titleEl) titleEl.textContent = task.title;
        }
        const modal = document.getElementById('taskProofModal');
        if (modal) modal.style.display = 'block';
    };

    const closeBtns = document.querySelectorAll('.modal-close');
    closeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });

    // Image Preview
    const fileInput = document.getElementById('taskProofFile');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            const preview = document.getElementById('taskProofPreview');
            if (preview && this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.innerHTML = `<img src="${e.target.result}" style="max-width: 100%; max-height: 200px; border-radius: 4px; margin-top: 10px;">`;
                }
                reader.readAsDataURL(this.files[0]);
            }
        });
    }

    const form = document.getElementById('taskProofForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            if (!currentProofTaskId) return;

            const fileInput = document.getElementById('taskProofFile');
            if (!fileInput.files.length) {
                alert('Please select an image.');
                return;
            }

            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.onload = function() {
                const task = mem_tasks.find(t => t.id === currentProofTaskId);
                if (!task) {
                    alert('Task not found.');
                    return;
                }

                const nowIso = new Date().toISOString();
                task.status = 'completed';
                task.proofImage = reader.result; // Base64
                task.proofImageName = file.name;
                task.proofSubmittedAt = nowIso;
                task.updatedAt = nowIso;
                task.completedOnTime = isTaskCompletedOnTime(task.dueDate, nowIso);
                if (!task.rewardStatus) task.rewardStatus = 'pending';

                // Save Remote
                saveTaskRemote(task).then(ok => {
                    if (ok) {
                        alert('Proof submitted successfully!');
                        const modal = document.getElementById('taskProofModal');
                        if (modal) modal.style.display = 'none';
                        currentProofTaskId = null;
                        loadTasks(); // Reload to update UI
                    } else {
                        alert('Failed to save proof. Please try again.');
                    }
                });
            };
            reader.readAsDataURL(file);
        });
    }
}

// Load Schedule
function loadSchedule() {
    const user = getCurrentUser();
    if (!user || !user.id) return;

    fetchMemberSchedule(user.id).then(schedule => {
        mem_schedules = schedule;
        renderSchedule(schedule);
    });
}

function renderSchedule(schedule) {
    const container = document.getElementById('scheduleList');
    if (!container) return;
    
    if (!schedule.length) {
        container.innerHTML = '<p class="text-muted text-center">No schedule items.</p>';
        return;
    }

    const sorted = [...schedule].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    container.innerHTML = sorted.map(s => `
        <div class="task-card" style="margin-bottom: var(--spacing-sm);">
            <div style="font-weight: 600;">${s.title || 'Event'}</div>
            <div style="font-size: 0.9em; color: var(--text-secondary);">
                ${formatDate(s.date)} at ${s.time || 'TBD'}
            </div>
            ${s.description ? `<div style="margin-top: 5px;">${s.description}</div>` : ''}
        </div>
    `).join('');
}

// Load Rewards
function loadRewards() {
    const user = getCurrentUser();
    if (!user || !user.id) return;

    fetchMemberRewards(user.id).then(rewards => {
        mem_rewards = rewards;
        renderRewards(rewards);
    });
}

function renderRewards(rewards) {
    const container = document.getElementById('rewardsList');
    if (!container) return;

    if (!rewards.length) {
        container.innerHTML = '<p class="text-muted text-center">No rewards yet.</p>';
        return;
    }

    const sorted = [...rewards].sort((a, b) => new Date(b.date) - new Date(a.date));
    container.innerHTML = sorted.map(r => `
        <div class="task-card" style="margin-bottom: var(--spacing-sm); display: flex; justify-content: space-between;">
            <div>
                <div style="font-weight: 600;">${r.title || 'Reward'}</div>
                <div style="font-size: 0.85rem; color: gray;">${formatDate(r.date)}</div>
            </div>
            <div style="font-weight: bold; color: var(--success-color);">
                +${r.amount || 0} pts
            </div>
        </div>
    `).join('');
}

// Load Training Videos
async function loadTraining() {
    const user = getCurrentUser();
    const userId = user && user.id ? String(user.id) : '';

    try {
        const endpoint = userId 
            ? `/team_training_videos?or=(memberId.eq.${encodeURIComponent(userId)},memberId.eq.all)`
            : '/team_training_videos';
        
        const remoteVideos = await fetchRemote(endpoint);
        const videos = Array.isArray(remoteVideos) ? remoteVideos : [];
        
        // Filter
        const assigned = videos.filter(v => {
            const target = String(v && v.memberId ? v.memberId : 'all').trim() || 'all';
            return target === 'all' || (userId && target === userId);
        });
        
        renderTrainingVideos(assigned);
    } catch (e) {
        console.warn('Failed to load training videos:', e);
        renderTrainingVideos([]);
    }
}

function renderTrainingVideos(videos) {
    const container = document.getElementById('trainingList');
    if (!container) return;

    if (!videos.length) {
        container.innerHTML = '<p class="text-muted text-center">No training videos.</p>';
        return;
    }

    container.innerHTML = videos.map(v => {
        const url = v.url || '';
        const embed = getVideoEmbed(url);
        const safeUrl = url.replace(/"/g, '&quot;');
        
        let media = '';
        if (embed) {
            media = `<iframe src="${embed}" style="width:100%; aspect-ratio:16/9; border:0; border-radius:8px;" allowfullscreen></iframe>`;
        } else if (url) {
            media = `<a href="${safeUrl}" target="_blank">Watch Video</a>`;
        }

        return `
            <div class="task-card" style="margin-bottom: var(--spacing-md);">
                <h3 style="margin: 0;">${v.title || 'Video'}</h3>
                ${v.description ? `<p>${v.description}</p>` : ''}
                ${media}
            </div>
        `;
    }).join('');
}

function getVideoEmbed(url) {
    if (!url) return null;
    try {
        const u = new URL(url);
        if (u.hostname.includes('youtube.com') || u.hostname === 'youtu.be') {
            let id = u.searchParams.get('v');
            if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
            if (id) return `https://www.youtube.com/embed/${id}`;
        }
    } catch {}
    return null;
}

// Load Updates (Events)
function loadUpdates() {
    // Assuming events are stored in 'apex_client_events' remotely if possible, 
    // or just skipping if no endpoint. For now, empty or memory only.
    // If the user has a remote table for events, we should fetch it.
    // Based on previous code, it used getEmailMap('apex_client_events').
    // We will try to fetch '/user_events' or similar if available, or just skip.
    // Given the instructions, we should not use localStorage.
    renderTeamEvents([]); 
}

function renderTeamEvents(events) {
    const table = document.getElementById('teamEventsTable');
    if (!table) return;
    const tbody = table.querySelector('tbody') || table;
    
    if (!events.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center p-3 text-muted">No events found.</td></tr>';
        return;
    }
    // Render logic if needed...
}

// Load Leaderboard
function loadLeaderboard() {
    fetchRemote('/team_rewards').then(rewards => {
        const all = Array.isArray(rewards) ? rewards : [];
        renderLeaderboard(all);
    }).catch(() => renderLeaderboard([]));
}

function renderLeaderboard(rewards) {
    const container = document.getElementById('leaderboardList');
    if (!container) return;

    // We need team member list to calculate scores.
    // Assuming 'teamMembers' global is available from data.js or we need to fetch it.
    // If teamMembers is not defined, we can't render properly.
    if (typeof teamMembers === 'undefined') return;

    const scores = {};
    teamMembers.forEach(m => {
        scores[m.id] = { member: m, points: 0 };
    });

    rewards.forEach(r => {
        const mid = String(r.memberId || '');
        if (scores[mid]) scores[mid].points += parseFloat(r.amount || 0);
    });

    const ranked = Object.values(scores).sort((a, b) => b.points - a.points);
    
    container.innerHTML = `
        <table class="leaderboard-table" style="width:100%">
            <thead>
                <tr>
                    <th style="text-align:center">Rank</th>
                    <th>Member</th>
                    <th style="text-align:right">Points</th>
                </tr>
            </thead>
            <tbody>
                ${ranked.map((item, idx) => `
                    <tr>
                        <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
                        <td>
                            <div style="font-weight:600">${item.member.name}</div>
                            <div style="font-size:0.8em; color:gray">${item.member.position}</div>
                        </td>
                        <td style="text-align:right; font-weight:bold">${item.points.toLocaleString()}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Helpers
function formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric'
    });
}

function isTaskCompletedOnTime(due, submitted) {
    if (!due || !submitted) return true;
    return new Date(submitted) <= new Date(due + 'T23:59:59');
}

function getTaskExtensionLabel(task) {
    const count = Number(task.extensionCount || 0);
    return count > 0 ? ` (Ext: ${count})` : '';
}

