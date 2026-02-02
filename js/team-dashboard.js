/* ============================================
   The Apex Circle - Team Dashboard (Remote Only)
   ============================================ */

// Team members data is now loaded from data.js

// Initialize team dashboard
document.addEventListener('DOMContentLoaded', function() {
    const user = getDashboardUser();
    if (!user || user.role !== 'team') {
        // Redirect to login page (using cleaner path)
        window.location.href = 'login.html';
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
function getDashboardUser() {
    // 1. Try global auth.js function first (if available)
    let user = null;
    if (typeof window.getCurrentUser === 'function') {
        user = window.getCurrentUser();
    } else {
        // 2. Fallback to manual session read
        try {
            const u = sessionStorage.getItem('apex_user');
            user = u ? JSON.parse(u) : null;
        } catch { user = null; }
    }

    // 3. Hydrate with teamMembers data (CRITICAL FIX for missing name/photo)
    const members = (typeof window.teamMembers !== 'undefined' ? window.teamMembers : (typeof teamMembers !== 'undefined' ? teamMembers : []));
    
    if (user && Array.isArray(members)) {
        // Find by ID first, then username/email
        const found = members.find(m => 
            (user.id && m.id === user.id) || 
            (m.username === user.username) || 
            (m.email === user.username) ||
            (m.email === user.email)
        );

        if (found) {
            // Merge found data into user object
            if (!user.id) user.id = found.id;
            if (!user.name) user.name = found.name;
            if (!user.position) user.position = found.position;
            if (!user.profilePhoto) user.profilePhoto = found.profilePhoto;
            if (!user.phone) user.phone = found.phone;
            
            console.log('Hydrated user data from teamMembers:', user);
        }
    }

    // 4. Demo Fallback: If still no ID but is team role, default to 'tm001' for demo
    if (user && !user.id && user.role === 'team') {
         console.warn('User ID still missing. Defaulting to tm001 for demo.');
         user.id = 'tm001';
         
         // Also try to find tm001 details if available
         if (Array.isArray(members)) {
             const demo = members.find(m => m.id === 'tm001');
             if (demo) {
                 user.name = demo.name;
                 user.position = demo.position;
                 user.profilePhoto = demo.profilePhoto;
             }
         }
    }

    return user;
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
    const user = getDashboardUser();
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

    // Auto-detect localhost
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:8002';
    }

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
        // Fix for double /api prefix if base already includes it
        if (ep.startsWith('/api/') && (base.endsWith('/api') || base.endsWith('/api/'))) {
            ep = ep.substring(4);
        }
        
        // Ensure ep starts with / if base doesn't end with it
        if (!ep.startsWith('/') && !base.endsWith('/')) {
            ep = '/' + ep;
        }
        
        // Add timestamp to prevent caching
        const sep = ep.includes('?') ? '&' : '?';
        const url = `${base}${ep}${sep}t=${Date.now()}`;
        
        const headers = {};
        const resp = await fetch(url, { headers });
        if (!resp.ok) {
            console.error(`Fetch ${url} failed with status: ${resp.status}`);
            return null;
        }
        const data = await resp.json();
        
        // Handle various response structures from server.js
        if (data && typeof data === 'object') {
            if (Array.isArray(data)) return data;
            if (data.tasks && Array.isArray(data.tasks)) return data.tasks;
            if (data.rewards && Array.isArray(data.rewards)) return data.rewards;
            if (data.videos && Array.isArray(data.videos)) return data.videos;
            if (data.updates && Array.isArray(data.updates)) return data.updates;
            if (data.notifications && Array.isArray(data.notifications)) return data.notifications;
            if (data.rows && Array.isArray(data.rows)) return data.rows; // DB query fallback
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
        ? `/api/team_tasks?or=(memberId.eq.${encodeURIComponent(id)},memberId.eq.all)`
        : '/api/team_tasks';
        
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
        ? `/api/scheduled_tasks?or=(memberId.eq.${encodeURIComponent(id)},memberId.eq.all)`
        : `/api/scheduled_tasks`;
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
        ? `/api/team_rewards?memberId=eq.${encodeURIComponent(id)}`
        : '/api/team_rewards';
    return fetchRemote(endpoint).then(data => {
        if (!Array.isArray(data)) return [];
        return data.filter(r => String(r && r.memberId) === String(id));
    }).catch(e => {
        console.warn('Fetch rewards failed:', e);
        return [];
    });
}

function saveTaskRemote(task) {
    return saveRemote('/api/team_tasks', task);
}

window.openSyncSettings = function() {
    const modal = document.getElementById('syncSettingsModal');
    if (modal) {
        // Default to Render URL if not set
        const defaultUrl = (window.APEX_CONFIG && window.APEX_CONFIG.API_BASE_URL) 
            ? window.APEX_CONFIG.API_BASE_URL 
            : 'https://apex-circle-backend.onrender.com/api';
            
        document.getElementById('syncApiUrl').value = sessionStorage.getItem('apex_api_base') || defaultUrl;
        document.getElementById('syncApiKey').value = sessionStorage.getItem('apex_neon_key') || '';
        modal.style.display = 'block';
    }
};

window.saveSyncSettings = function() {
    const url = document.getElementById('syncApiUrl').value.trim();
    const key = document.getElementById('syncApiKey').value.trim();
    
    if (url) {
        sessionStorage.setItem('apex_api_base', url);
    } else {
        sessionStorage.removeItem('apex_api_base');
    }
    
    if (key) {
        sessionStorage.setItem('apex_neon_key', key);
    } else {
        sessionStorage.removeItem('apex_neon_key');
    }
    
    alert('Settings saved. Reloading...');
    location.reload();
};

// Notifications
function loadNotifications() {
    const user = getDashboardUser();
    if (!user) return;
    
    fetchRemote('/api/team_notifications').then(list => {
        const all = Array.isArray(list) ? list : [];
        // Filter by user or 'all'
        const myNotifs = all.filter(n => !n.memberId || n.memberId === 'all' || String(n.memberId) === String(user.id));
        renderNotifications(document.getElementById('teamNotifications'), myNotifs);
    }).catch(e => {
        console.warn('Failed to load notifications:', e);
        renderNotifications(document.getElementById('teamNotifications'), []);
    });
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

// Expose functions for UI buttons
window.switchTab = function(targetTab) {
    console.log('Switching to tab:', targetTab);
    
    // 1. Deactivate all tabs
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.remove('active');
        if (t.getAttribute('data-tab') === targetTab) {
            t.classList.add('active');
        }
    });
    
    // 2. Hide all contents
    document.querySelectorAll('.tab-content').forEach(tc => {
        tc.classList.remove('active');
        tc.style.display = 'none';
    });

    // 3. Show target content
    const targetEl = document.getElementById(targetTab + 'Tab');
    if (targetEl) {
        targetEl.classList.add('active');
        targetEl.style.display = 'block';
    } else {
        console.error('Target tab content not found:', targetTab + 'Tab');
    }
};

function initTabs() {
    // Set initial state based on active tab in HTML
    const activeTab = document.querySelector('.tab.active');
    if (activeTab) {
        const tabName = activeTab.getAttribute('data-tab');
        window.switchTab(tabName);
    }
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
            ? `/api/scheduled_tasks?or=(memberId.eq.${encodeURIComponent(userId)},memberId.eq.all)`
            : '/api/scheduled_tasks';
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

// Sample fallback tasks for demo purposes when backend is empty/unreachable
const FALLBACK_TASKS = [
    {
        id: 'task_demo_1',
        title: 'Review Team Performance',
        description: 'Analyze weekly performance metrics and prepare a summary report for the management team.',
        memberId: 'tm001',
        eventName: 'Weekly Review',
        dueDate: new Date().toISOString().split('T')[0],
        status: 'pending',
        priority: 'high',
        createdAt: new Date().toISOString()
    },
    {
        id: 'task_demo_2',
        title: 'Event Coordination Meeting',
        description: 'Coordinate with the logistics team regarding the upcoming "Tech Innovation Summit".',
        memberId: 'tm001',
        eventName: 'Tech Innovation Summit',
        dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        status: 'pending',
        priority: 'medium',
        createdAt: new Date().toISOString()
    },
    {
        id: 'task_demo_3',
        title: 'Update Social Media Calendar',
        description: 'Plan and schedule posts for the next two weeks.',
        memberId: 'tm004', // Different user to test filtering
        eventName: 'Social Media',
        dueDate: new Date().toISOString().split('T')[0],
        status: 'pending',
        priority: 'medium',
        createdAt: new Date().toISOString()
    }
];

// Load Tasks
function loadTasks() {
    const user = getDashboardUser();
    if (!user || !user.id) return;

    fetchMemberTasks(user.id).then(async tasks => {
        // REMOVED Fallback Demo Data - Only show real tasks as requested
        if (!tasks || tasks.length === 0) {
            console.log('No remote tasks found.');
            tasks = [];
        }

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
        // On error, show empty state instead of fake data
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
    
    // Update HTML elements (IDs from index.html)
    const elTotal = document.getElementById('totalTasks');
    // HTML doesn't have dedicated counters for completed/pending in the header, 
    // but we can update them if they existed or if we want to add them later.
    const elCompleted = document.getElementById('statCompletedTasks');
    const elPending = document.getElementById('statPendingTasks');

    if (elTotal) elTotal.textContent = total;
    if (elCompleted) elCompleted.textContent = completed;
    if (elPending) elPending.textContent = pending;
}

// Task Proof Logic
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

function setupTaskProofForm() {
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
    const user = getDashboardUser();
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
    const user = getDashboardUser();
    if (!user || !user.id) return;

    fetchMemberRewards(user.id).then(rewards => {
        mem_rewards = rewards;
        renderRewards(rewards);
    });
}

function renderRewards(rewards) {
    const containerToday = document.getElementById('rewardsListToday');
    const containerPrevious = document.getElementById('rewardsListPrevious');
    const containerGeneric = document.getElementById('rewardsList'); // Fallback

    if (!containerToday && !containerPrevious && !containerGeneric) return;

    if (!rewards.length) {
        const msg = '<p class="text-muted text-center">No rewards yet.</p>';
        if (containerToday) containerToday.innerHTML = msg;
        if (containerPrevious) containerPrevious.innerHTML = '';
        if (containerGeneric) containerGeneric.innerHTML = msg;
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const today = rewards.filter(r => (r.date || r.createdAt || '').startsWith(todayStr));
    const previous = rewards.filter(r => !(r.date || r.createdAt || '').startsWith(todayStr));

    const renderItem = (r) => `
        <div class="task-card" style="margin-bottom: var(--spacing-sm); display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-weight: 600;">${r.reason || r.title || 'Reward'}</div>
                <div style="font-size: 0.85rem; color: gray;">${formatDate(r.date || r.createdAt)}</div>
                ${r.taskId ? `<div style="font-size: 0.75rem; color: var(--primary-color);">Task ID: ${r.taskId}</div>` : ''}
            </div>
            <div style="font-weight: bold; color: var(--success-color); font-size: 1.1rem;">
                +${r.amount || 0} pts
            </div>
        </div>
    `;

    if (containerToday) {
        containerToday.innerHTML = today.length ? today.map(renderItem).join('') : '<p class="text-muted text-center">No rewards today.</p>';
    }
    if (containerPrevious) {
        containerPrevious.innerHTML = previous.map(renderItem).join('');
    }
    if (containerGeneric && !containerToday && !containerPrevious) {
        containerGeneric.innerHTML = rewards.map(renderItem).join('');
    }

    // Update Header Stats if elements exist
    updateRewardStats(rewards);
}

function updateRewardStats(rewards) {
    const totalPoints = rewards.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    const elPoints = document.getElementById('totalPoints');
    const elRewards = document.getElementById('totalRewards');

    if (elPoints) elPoints.textContent = totalPoints.toLocaleString();
    if (elRewards) elRewards.textContent = '₹' + totalPoints.toLocaleString();
}

// Load Training Videos
async function loadTraining() {
    const user = getDashboardUser();
    const userId = user && user.id ? String(user.id) : '';

    try {
        const endpoint = userId 
            ? `/api/team_training_videos?or=(memberId.eq.${encodeURIComponent(userId)},memberId.eq.all)`
            : '/api/team_training_videos';
        
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
async function loadUpdates() {
    try {
        const updates = await fetchRemote('/api/team_updates');
        renderTeamEvents(Array.isArray(updates) ? updates : []);
    } catch (e) {
        console.warn('Failed to load updates:', e);
        renderTeamEvents([]);
    }
}

function renderTeamEvents(events) {
    const table = document.getElementById('teamEventsTable');
    if (!table) return;
    const tbody = table.querySelector('tbody') || table;
    
    if (!events.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center p-3 text-muted">No events found.</td></tr>';
        return;
    }

    tbody.innerHTML = events.map(e => `
        <tr>
            <td>${formatDate(e.date)}</td>
            <td style="font-weight: 500;">${e.title || 'Event'}</td>
            <td>${e.description || ''}</td>
            <td><span class="badge badge-primary" style="text-transform: capitalize;">${e.type || 'General'}</span></td>
        </tr>
    `).join('');
}

// Load Leaderboard
function loadLeaderboard() {
    fetchRemote('/api/team_rewards').then(rewards => {
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

// Expose functions for UI buttons
window.refreshLeaderboard = loadLeaderboard;
window.refreshTasks = loadTasks;
window.refreshSchedule = loadSchedule;
window.refreshRewards = loadRewards;
window.refreshTraining = loadTraining;
window.refreshUpdates = loadUpdates;
window.syncNow = syncNow;
