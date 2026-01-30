/* ============================================
   The Apex Circle - Dashboard JavaScript
   Dashboard Logic & Data Display
   ============================================ */

function safeParseJSON(value) {
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch (e) {
        return null;
    }
}

function formatCurrency(amount, currency = 'INR') {
    const value = typeof amount === 'number' ? amount : (parseFloat(amount || '0') || 0);
    try {
        const locale = currency === 'INR' ? 'en-IN' : 'en-US';
        return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
    } catch (e) {
        return `${currency} ${formatNumber(value)}`;
    }
}

function formatNumber(num) {
    const n = typeof num === 'number' ? num : (parseFloat(num || '0') || 0);
    try {
        return new Intl.NumberFormat('en-IN').format(n);
    } catch (e) {
        return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

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
        toggleBtn.setAttribute('aria-label', 'Open menu');
        toggleBtn.textContent = '☰';
        header.insertBefore(toggleBtn, header.firstChild);
    }

    if (!toggleBtn.dataset.bound) {
        toggleBtn.dataset.bound = '1';
        toggleBtn.addEventListener('click', function () {
            const isOpen = sidebar.classList.contains('active');
            setOpen(!isOpen);
        });
    }

    if (!overlay.dataset.bound) {
        overlay.dataset.bound = '1';
        overlay.addEventListener('click', function () {
            setOpen(false);
        });
    }

    document.querySelectorAll('.sidebar-menu a').forEach(a => {
        if (a.dataset.mobileBound) return;
        a.dataset.mobileBound = '1';
        a.addEventListener('click', function () {
            setOpen(false);
        });
    });

    const mq = window.matchMedia('(max-width: 992px)');
    if (!mq.matches) setOpen(false);
    const onChange = () => {
        if (!mq.matches) setOpen(false);
    };
    if (!mq.__apexBound) {
        mq.__apexBound = true;
        if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
        else if (typeof mq.addListener === 'function') mq.addListener(onChange);
    }
}

function splitFullName(fullName) {
    const cleaned = (fullName || '').trim().replace(/\s+/g, ' ');
    if (!cleaned) return { firstName: '', lastName: '' };
    const parts = cleaned.split(' ');
    const firstName = parts.shift() || '';
    const lastName = parts.join(' ');
    return { firstName, lastName };
}

function getDerivedProfileFromUser(user) {
    const { firstName, lastName } = splitFullName((user && user.name) || '');
    return {
        firstName,
        lastName,
        email: (user && user.username) || '',
        phone: '',
        company: (user && user.company) || '',
        picture: (user && (user.picture || user.profilePhoto)) || ''
    };
}

function getProfilesMap() {
    const parsed = safeParseJSON(sessionStorage.getItem(getUserStorageKey('apex_profiles')));
    return parsed && typeof parsed === 'object' ? parsed : {};
}

function setProfilesMap(map) {
    sessionStorage.setItem(getUserStorageKey('apex_profiles'), JSON.stringify(map && typeof map === 'object' ? map : {}));
}

function getStoredProfile(user) {
    const emailRaw = user && user.username ? String(user.username) : '';
    const email = emailRaw.trim().toLowerCase();
    if (email) {
        const map = getProfilesMap();
        const saved = map[email];
        if (saved && typeof saved === 'object') return saved;
    }

    const profile = safeParseJSON(sessionStorage.getItem(getUserStorageKey('apex_profile')));
    if (!profile) return null;
    if (email && profile.email && String(profile.email).trim().toLowerCase() !== email) return null;
    return profile;
}

function setStoredProfile(profile, user) {
    const next = profile && typeof profile === 'object' ? profile : null;
    if (!next) return;

    const nextEmailRaw = next.email ? String(next.email) : '';
    const nextEmail = nextEmailRaw.trim().toLowerCase();
    const userEmailRaw = user && user.username ? String(user.username) : '';
    const userEmail = userEmailRaw.trim().toLowerCase();

    if (userEmail && nextEmail && userEmail !== nextEmail) {
        const map = getProfilesMap();
        if (Object.prototype.hasOwnProperty.call(map, userEmail)) delete map[userEmail];
        map[nextEmail] = next;
        setProfilesMap(map);
    } else if (nextEmail || userEmail) {
        const key = nextEmail || userEmail;
        const map = getProfilesMap();
        map[key] = next;
        setProfilesMap(map);
    }

    sessionStorage.setItem(getUserStorageKey('apex_profile'), JSON.stringify(next));
}

function initProfileForm() {
    const form = document.getElementById('personalInfoForm');
    const firstNameEl = document.getElementById('firstName');
    const lastNameEl = document.getElementById('lastName');
    const emailEl = document.getElementById('email');
    const phoneEl = document.getElementById('phone');
    const companyEl = document.getElementById('company');

    if (!firstNameEl || !lastNameEl || !emailEl || !phoneEl || !companyEl) return;

    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const stored = getStoredProfile(user);
    const derived = getDerivedProfileFromUser(user);
    const profile = { ...derived, ...(stored || {}) };

    if (!firstNameEl.value) firstNameEl.value = profile.firstName || '';
    if (!lastNameEl.value) lastNameEl.value = profile.lastName || '';
    if (!emailEl.value) emailEl.value = profile.email || derived.email || '';
    if (!phoneEl.value) phoneEl.value = profile.phone || '';
    if (!companyEl.value) companyEl.value = profile.company || derived.company || '';

    if (!phoneEl.getAttribute('placeholder')) {
        phoneEl.setAttribute('placeholder', '+91 98765 43210');
    }

    if (!form) return;

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const updated = {
            firstName: (firstNameEl.value || '').trim(),
            lastName: (lastNameEl.value || '').trim(),
            email: (emailEl.value || '').trim(),
            phone: (phoneEl.value || '').trim(),
            company: (companyEl.value || '').trim(),
            picture: profile.picture || ''
        };
        setStoredProfile(updated, user);

        if (user) {
            const nextUser = { ...user };
            const nextName = `${updated.firstName} ${updated.lastName}`.trim();
            if (nextName) nextUser.name = nextName;
            if (updated.company) nextUser.company = updated.company;
            if (updated.email) nextUser.username = updated.email;
            sessionStorage.setItem('apex_user', JSON.stringify(nextUser));
        }

        const userNameEls = document.querySelectorAll('.user-name, .sidebar-user-name');
        userNameEls.forEach(el => {
            if (!el) return;
            const text = `${updated.firstName} ${updated.lastName}`.trim();
            if (text) el.textContent = text;
        });
        const roleEls = document.querySelectorAll('.user-role, .sidebar-user-role');
        roleEls.forEach(el => {
            if (el && updated.company) el.textContent = updated.company;
        });

        alert('Profile updated successfully!');
    });
}

function injectBuyPlanButton() {
    const path = (window.location.pathname || '').toLowerCase();
    if (!path.includes('/user/')) return;
    if (path.endsWith('/plans.html') || path.endsWith('/login.html')) return;

    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user || (user.role !== 'client' && user.role !== 'user')) return;

    const existing = document.getElementById('buyPlanBtn');
    if (existing) return;

    const header = document.querySelector('.dashboard-header');
    if (!header) return;

    let actions = header.querySelector('.dashboard-actions');
    if (!actions) {
        actions = document.createElement('div');
        actions.className = 'dashboard-actions';
        header.appendChild(actions);
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'buyPlanBtn';
    btn.className = 'btn btn-secondary';
    btn.textContent = 'Buy Plan';
    btn.addEventListener('click', function () {
        window.location.href = 'plans.html';
    });

    actions.appendChild(btn);
}

const KEY_CLIENT_EVENTS = 'apex_client_events';
const KEY_CLIENT_GUESTS = 'apex_client_guests';
const KEY_CLIENT_SPONSORSHIPS = 'apex_client_sponsorships';
const KEY_CLIENT_CAMPAIGNS = 'apex_client_campaigns';
const KEY_CLIENT_PLANS = 'apex_client_plans';
const KEY_PLAN_CHECKLISTS = 'apex_plan_checklists';
const KEY_CUSTOM_USERS = 'apex_custom_users';
const KEY_DASH_ADMIN_SETTINGS = 'apex_admin_settings';
const KEY_NOTIFICATION_LOG = 'apex_notification_log';

function isAdminPage() {
    const path = (window.location.pathname || '').toLowerCase();
    return path.includes('/admin/') || path.includes('admin');
}

function normalizeEmail(email) {
    return (email || '').trim().toLowerCase();
}

function getUserEmail(user) {
    return normalizeEmail(user && user.username);
}

function getEmailMap(key) {
    const parsed = safeParseJSON(sessionStorage.getItem(key));
    return parsed && typeof parsed === 'object' ? parsed : {};
}

function setEmailMap(key, map) {
    sessionStorage.setItem(key, JSON.stringify(map || {}));
}

function getNotificationLog() {
    const parsed = safeParseJSON(sessionStorage.getItem(KEY_NOTIFICATION_LOG));
    return Array.isArray(parsed) ? parsed : [];
}

function setNotificationLog(list) {
    sessionStorage.setItem(KEY_NOTIFICATION_LOG, JSON.stringify(Array.isArray(list) ? list : []));
}

function appendNotification(entry) {
    const list = getNotificationLog();
    const next = {
        id: 'notif_' + Date.now(),
        createdAt: new Date().toISOString(),
        ...(entry && typeof entry === 'object' ? entry : {})
    };
    list.unshift(next);
    setNotificationLog(list.slice(0, 200));
    return next;
}

function maybeNotify(kind, data) {
    const settings = getAdminSettings();
    const notify = settings && settings.notifications ? settings.notifications : {};
    const general = settings && settings.general ? settings.general : {};

    const enabled = kind === 'new_event'
        ? Boolean(notify.newEventsEmail)
        : kind === 'user_registration'
            ? Boolean(notify.registrationsEmail)
            : kind === 'sponsorship_update'
                ? Boolean(notify.sponsorshipUpdatesEmail)
                : kind === 'urgent_sms'
                    ? Boolean(notify.urgentSms)
                    : false;

    if (!enabled) return null;

    return appendNotification({
        kind,
        to: (general.companyEmail || '').toString(),
        data: data == null ? null : data
    });
}

function getAdminSettings() {
    const parsed = safeParseJSON(sessionStorage.getItem(KEY_DASH_ADMIN_SETTINGS));
    const stored = parsed && typeof parsed === 'object' ? parsed : {};
    const general = stored.general && typeof stored.general === 'object' ? stored.general : {};
    const notifications = stored.notifications && typeof stored.notifications === 'object' ? stored.notifications : {};
    const security = stored.security && typeof stored.security === 'object' ? stored.security : {};

    return {
        general: {
            companyName: (general.companyName || 'The Apex Circle').toString(),
            companyEmail: (general.companyEmail || 'theapexcirclestarexuniversity@gmail.com').toString(),
            companyPhone: (general.companyPhone || '').toString()
        },
        notifications: {
            newEventsEmail: Boolean(notifications.newEventsEmail == null ? true : notifications.newEventsEmail),
            registrationsEmail: Boolean(notifications.registrationsEmail == null ? true : notifications.registrationsEmail),
            sponsorshipUpdatesEmail: Boolean(notifications.sponsorshipUpdatesEmail == null ? true : notifications.sponsorshipUpdatesEmail),
            urgentSms: Boolean(notifications.urgentSms == null ? false : notifications.urgentSms)
        },
        security: {
            sessionTimeoutMinutes: Number.isFinite(Number(security.sessionTimeoutMinutes))
                ? Math.max(5, Math.min(120, Number(security.sessionTimeoutMinutes)))
                : 30,
            requireAdmin2fa: Boolean(security.requireAdmin2fa == null ? false : security.requireAdmin2fa),
            passwordComplexity: Boolean(security.passwordComplexity == null ? false : security.passwordComplexity)
        }
    };
}

function setAdminSettings(next) {
    const current = getAdminSettings();
    const merged = {
        general: { ...current.general, ...(next && next.general ? next.general : {}) },
        notifications: { ...current.notifications, ...(next && next.notifications ? next.notifications : {}) },
        security: { ...current.security, ...(next && next.security ? next.security : {}) }
    };
    sessionStorage.setItem(KEY_DASH_ADMIN_SETTINGS, JSON.stringify(merged));
    return merged;
}

function isComplexPassword(password) {
    const pw = String(password || '');
    if (pw.length < 8) return false;
    if (!/[a-z]/.test(pw)) return false;
    if (!/[A-Z]/.test(pw)) return false;
    if (!/[0-9]/.test(pw)) return false;
    if (!/[^A-Za-z0-9]/.test(pw)) return false;
    return true;
}

function applyAdminSettingsToPage() {
    const settings = getAdminSettings();
    if (!settings || !settings.general || !settings.general.companyName) return;

    const title = document.title || '';
    if (title && !title.includes(settings.general.companyName)) {
        if (title.includes('The Apex Circle')) {
            document.title = title.split('The Apex Circle').join(settings.general.companyName);
        }
    }
}

function getCustomUsersMap() {
    const parsed = safeParseJSON(sessionStorage.getItem(KEY_CUSTOM_USERS));
    return parsed && typeof parsed === 'object' ? parsed : {};
}

function setCustomUsersMap(map) {
    sessionStorage.setItem(KEY_CUSTOM_USERS, JSON.stringify(map || {}));
}

function renameEmailInEmailMap(key, fromEmail, toEmail) {
    const from = normalizeEmail(fromEmail);
    const to = normalizeEmail(toEmail);
    if (!from || !to || from === to) return;
    const map = getEmailMap(key);
    const fromList = Array.isArray(map[from]) ? map[from] : null;
    if (!fromList) return;
    const toList = Array.isArray(map[to]) ? map[to] : [];
    const moved = fromList.map(item => ({ ...item, clientEmail: to }));
    map[to] = [...toList, ...moved];
    delete map[from];
    setEmailMap(key, map);
}

function renameEmailInPlainMap(key, fromEmail, toEmail) {
    const from = normalizeEmail(fromEmail);
    const to = normalizeEmail(toEmail);
    if (!from || !to || from === to) return;
    const parsed = safeParseJSON(sessionStorage.getItem(key));
    const map = parsed && typeof parsed === 'object' ? parsed : {};
    const value = map[from];
    if (typeof value === 'undefined') return;
    map[to] = value;
    delete map[from];
    sessionStorage.setItem(key, JSON.stringify(map));
}

function deleteClientDataForEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return;

    [KEY_CLIENT_EVENTS, KEY_CLIENT_GUESTS, KEY_CLIENT_SPONSORSHIPS, KEY_CLIENT_CAMPAIGNS].forEach(key => {
        const map = getEmailMap(key);
        if (Object.prototype.hasOwnProperty.call(map, normalizedEmail)) {
            delete map[normalizedEmail];
            setEmailMap(key, map);
        }
    });

    [KEY_CLIENT_PLANS, KEY_PLAN_CHECKLISTS].forEach(key => {
        const parsed = safeParseJSON(sessionStorage.getItem(key));
        const map = parsed && typeof parsed === 'object' ? parsed : {};
        if (Object.prototype.hasOwnProperty.call(map, normalizedEmail)) {
            delete map[normalizedEmail];
            sessionStorage.setItem(key, JSON.stringify(map));
        }
    });
}

function ensureDefaultClientSeed() {
    if (!isAdminPage()) return;
    if (!sessionStorage.getItem(KEY_CLIENT_EVENTS)) sessionStorage.setItem(KEY_CLIENT_EVENTS, JSON.stringify({}));
    if (!sessionStorage.getItem(KEY_CLIENT_GUESTS)) sessionStorage.setItem(KEY_CLIENT_GUESTS, JSON.stringify({}));
    if (!sessionStorage.getItem(KEY_CLIENT_SPONSORSHIPS)) sessionStorage.setItem(KEY_CLIENT_SPONSORSHIPS, JSON.stringify({}));
    if (!sessionStorage.getItem(KEY_CLIENT_CAMPAIGNS)) sessionStorage.setItem(KEY_CLIENT_CAMPAIGNS, JSON.stringify({}));
}

function ensureClientSeed(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return;

    const eventsMap = getEmailMap(KEY_CLIENT_EVENTS);
    if (!Array.isArray(eventsMap[normalizedEmail])) {
        eventsMap[normalizedEmail] = [];
        setEmailMap(KEY_CLIENT_EVENTS, eventsMap);
    }

    const guestsMap = getEmailMap(KEY_CLIENT_GUESTS);
    if (!Array.isArray(guestsMap[normalizedEmail])) {
        guestsMap[normalizedEmail] = [];
        setEmailMap(KEY_CLIENT_GUESTS, guestsMap);
    }

    const sponsorsMap = getEmailMap(KEY_CLIENT_SPONSORSHIPS);
    if (!Array.isArray(sponsorsMap[normalizedEmail])) {
        sponsorsMap[normalizedEmail] = [];
        setEmailMap(KEY_CLIENT_SPONSORSHIPS, sponsorsMap);
    }

    const campaignsMap = getEmailMap(KEY_CLIENT_CAMPAIGNS);
    if (!Array.isArray(campaignsMap[normalizedEmail])) {
        campaignsMap[normalizedEmail] = [];
        setEmailMap(KEY_CLIENT_CAMPAIGNS, campaignsMap);
    }
}

// Remote API Helpers
async function fetchRemote(endpoint) {
    if (!window.APEX_CONFIG || !window.APEX_CONFIG.getApiUrl) return null;
    const base = window.APEX_CONFIG.getApiUrl();
    try {
        // Handle both leading slash and no slash
        const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
        const resp = await fetch(`${base}${path}`);
        if (!resp.ok) return null;
        return await resp.json();
    } catch (e) {
        console.error('Fetch error:', e);
        return null;
    }
}

async function saveRemote(endpoint, data) {
    if (!window.APEX_CONFIG || !window.APEX_CONFIG.getApiUrl) return false;
    const base = window.APEX_CONFIG.getApiUrl();
    try {
        const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
        const resp = await fetch(`${base}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return resp.ok;
    } catch (e) {
        console.error('Save error:', e);
        return false;
    }
}

function getListForEmail(key, email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return [];
    const map = getEmailMap(key);
    const list = map[normalizedEmail];
    return Array.isArray(list) ? list : [];
}

function setListForEmail(key, email, list) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return;
    const map = getEmailMap(key);
    map[normalizedEmail] = Array.isArray(list) ? list : [];
    setEmailMap(key, map);
}

function getAllItemsFromEmailMap(key) {
    const map = getEmailMap(key);
    const items = [];
    Object.keys(map).forEach(email => {
        const list = map[email];
        if (!Array.isArray(list)) return;
        list.forEach(item => {
            items.push({
                ...item,
                clientEmail: item && item.clientEmail ? normalizeEmail(item.clientEmail) : normalizeEmail(email)
            });
        });
    });
    return items;
}

function resolveEmailForItemId(key, id, providedEmail) {
    const direct = normalizeEmail(providedEmail || '');
    if (direct) return direct;
    const all = getAllItemsFromEmailMap(key);
    const found = all.find(item => item && String(item.id) === String(id));
    return normalizeEmail((found && found.clientEmail) || '');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'flex';
}

function getPlanLimit(plan) {
    const p = String(plan || '').toUpperCase().trim();
    if (p === 'A') return 100;
    if (p === 'B') return 250;
    if (p === 'C') return 500;
    return 0;
}

function getClientPlanMap() {
    const parsed = safeParseJSON(sessionStorage.getItem(KEY_CLIENT_PLANS));
    return parsed && typeof parsed === 'object' ? parsed : {};
}

function getClientPlanForEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return null;
    const map = getClientPlanMap();
    const item = map[normalizedEmail];
    if (item && typeof item === 'object') return item;
    const legacy = safeParseJSON(sessionStorage.getItem('apex_selected_plan'));
    if (legacy && normalizeEmail(legacy.userId) === normalizedEmail) return legacy;
    return null;
}

function getPlanChecklistMap() {
    const parsed = safeParseJSON(sessionStorage.getItem(KEY_PLAN_CHECKLISTS));
    return parsed && typeof parsed === 'object' ? parsed : {};
}

function setPlanChecklistMap(map) {
    sessionStorage.setItem(KEY_PLAN_CHECKLISTS, JSON.stringify(map || {}));
}

function buildDefaultChecklist(plan) {
    const p = String(plan || '').toUpperCase().trim();
    const common = [
        { id: 'kickoff', label: 'Kickoff call scheduled', done: false },
        { id: 'requirements', label: 'Requirements finalized', done: false },
        { id: 'venue', label: 'Venue confirmed', done: false },
        { id: 'guestlist', label: 'Guest list prepared', done: false },
        { id: 'invites', label: 'Invites sent', done: false },
        { id: 'vendors', label: 'Vendors confirmed', done: false },
        { id: 'runshow', label: 'Run of show approved', done: false },
        { id: 'report', label: 'Post-event report delivered', done: false }
    ];

    if (p === 'A') return common.slice(0, 6);
    if (p === 'B') return common.slice(0, 7);
    if (p === 'C') return common;
    return common.slice(0, 5);
}

function getOrCreateChecklistForEmail(email, plan) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return null;
    const map = getPlanChecklistMap();
    const existing = map[normalizedEmail];
    const planCode = String(plan || '').toUpperCase().trim();
    if (existing && typeof existing === 'object' && Array.isArray(existing.items)) {
        const existingPlan = String(existing.plan || '').toUpperCase().trim();
        if (existingPlan && planCode && existingPlan !== planCode) {
            const newItems = buildDefaultChecklist(planCode);
            // Preserve completed status for items that exist in the new plan
            if (Array.isArray(existing.items)) {
                newItems.forEach(newItem => {
                    const oldItem = existing.items.find(i => i.id === newItem.id);
                    if (oldItem && oldItem.done) {
                        newItem.done = true;
                    }
                });
            }
            map[normalizedEmail] = { plan: planCode, items: newItems };
            setPlanChecklistMap(map);
            return map[normalizedEmail];
        }
        return existing;
    }
    map[normalizedEmail] = { plan: planCode || '', items: buildDefaultChecklist(planCode) };
    setPlanChecklistMap(map);
    return map[normalizedEmail];
}

function renderPlanChecklist() {
    const container = document.getElementById('planChecklist');
    if (!container) return;

    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const email = getUserEmail(user);
    if (!email) {
        container.innerHTML = '';
        return;
    }

    const planData = getClientPlanForEmail(email);
    const plan = (planData && planData.plan) || (user && user.selectedPlan) || '';
    if (!plan) {
        container.innerHTML = `
            <div style="color: var(--text-secondary); padding: 0.5rem 0;">
                No plan activated yet. Please purchase a plan to start the checklist.
            </div>
        `;
        const progressEl = document.getElementById('planChecklistProgress');
        if (progressEl) progressEl.textContent = '';
        return;
    }

    const checklist = getOrCreateChecklistForEmail(email, plan);
    const items = Array.isArray(checklist && checklist.items) ? checklist.items : [];
    const completed = items.filter(i => i.done).length;
    const total = items.length || 1;
    const percent = Math.round((completed / total) * 100);

    const progressEl = document.getElementById('planChecklistProgress');
    if (progressEl) progressEl.textContent = `${percent}%`;

    container.innerHTML = `
        <div style="display: grid; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="flex: 1; height: 10px; background: var(--bg-light); border-radius: 999px; overflow: hidden;">
                    <div style="height: 10px; width: ${percent}%; background: var(--primary-color);"></div>
                </div>
                <div style="min-width: 72px; text-align: right; color: var(--text-secondary); font-size: 0.875rem;">
                    ${completed}/${items.length}
                </div>
            </div>
            <div style="display: grid; gap: 0.5rem;">
                ${items.map(item => `
                    <label style="display: flex; gap: 0.6rem; align-items: flex-start;">
                        <input type="checkbox" data-checklist-id="${item.id}" ${item.done ? 'checked' : ''} style="margin-top: 0.25rem;">
                        <span style="color: ${item.done ? 'var(--text-secondary)' : 'var(--text-primary)'}; text-decoration: ${item.done ? 'line-through' : 'none'};">
                            ${item.label}
                        </span>
                    </label>
                `).join('')}
            </div>
        </div>
    `;

    container.querySelectorAll('input[type="checkbox"][data-checklist-id]').forEach(cb => {
        cb.addEventListener('change', function () {
            const id = this.getAttribute('data-checklist-id');
            const map = getPlanChecklistMap();
            const entry = map[email];
            if (!entry || !Array.isArray(entry.items)) return;
            const item = entry.items.find(i => i.id === id);
            if (!item) return;
            item.done = Boolean(this.checked);
            map[email] = entry;
            setPlanChecklistMap(map);
            renderPlanChecklist();
        });
    });
}

// Load dashboard data
function loadDashboardData() {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const admin = isAdminPage();

    if (admin) {
        ensureDefaultClientSeed();
        const events = getAllItemsFromEmailMap(KEY_CLIENT_EVENTS);
        const guests = getAllItemsFromEmailMap(KEY_CLIENT_GUESTS);
        const sponsorships = getAllItemsFromEmailMap(KEY_CLIENT_SPONSORSHIPS);

        const totalEventRevenue = events.reduce((sum, e) => sum + (parseFloat(e.revenue || '0') || 0), 0);
        const totalGuests = guests.length;
        const activeEvents = events.filter(e => String(e.status || '').toLowerCase() === 'active').length;
        const pendingApprovals = sponsorships.filter(s => String(s.status || '').toLowerCase() === 'pending').length;

        const customUsers = getCustomUsersMap();
        const seen = new Set();
        const users = Object.keys(customUsers).map(key => {
            const raw = customUsers[key] && typeof customUsers[key] === 'object' ? customUsers[key] : {};
            const email = normalizeEmail(raw.username || key);
            if (!email || seen.has(email)) return null;
            seen.add(email);
            const planData = getClientPlanForEmail(email);
            return {
                id: email,
                name: (raw.name || '').trim() || email,
                email,
                company: raw.company || '',
                role: raw.role || 'client',
                status: raw.status || 'active',
                joinDate: raw.joinDate || raw.createdAt || '',
                eventsCount: events.filter(e => normalizeEmail(e.clientEmail) === email).length,
                plan: (planData && planData.plan) || ''
            };
        }).filter(Boolean).sort((a, b) => String(a.email).localeCompare(String(b.email)));

        return {
            ...adminDashboardData,
            stats: {
                ...((adminDashboardData && adminDashboardData.stats) ? adminDashboardData.stats : {}),
                totalEvents: events.length,
                totalUsers: users.length,
                totalGuests,
                totalRevenue: totalEventRevenue,
                activeEvents,
                pendingApprovals
            },
            events,
            users,
            guests,
            sponsorships
        };
    }

    const email = getUserEmail(user);
    ensureClientSeed(email);
    const events = getListForEmail(KEY_CLIENT_EVENTS, email);
    const guests = getListForEmail(KEY_CLIENT_GUESTS, email);
    const sponsorships = getListForEmail(KEY_CLIENT_SPONSORSHIPS, email);
    const sponsorshipTotalsByEvent = {};
    sponsorships.forEach(s => {
        const ev = String((s && s.event) || '').trim();
        if (!ev) return;
        if (String((s && s.status) || '').toLowerCase() !== 'confirmed') return;
        sponsorshipTotalsByEvent[ev] = (sponsorshipTotalsByEvent[ev] || 0) + (parseFloat((s && s.amount) || '0') || 0);
    });
    const guestCountsByEvent = {};
    guests.forEach(g => {
        const ev = String((g && g.event) || '').trim();
        if (!ev) return;
        guestCountsByEvent[ev] = (guestCountsByEvent[ev] || 0) + 1;
    });
    const enrichedEvents = events.map(e => {
        const evName = String((e && e.name) || '').trim();
        if (!evName) return e;
        const sponsorshipTotal = sponsorshipTotalsByEvent[evName];
        const guestsCount = guestCountsByEvent[evName];
        return {
            ...e,
            guests: typeof guestsCount === 'number' ? guestsCount : (parseFloat((e && e.guests) || '0') || 0),
            sponsorship: typeof sponsorshipTotal === 'number' ? sponsorshipTotal : (parseFloat((e && e.sponsorship) || '0') || 0)
        };
    });
    const registrationCount = events.reduce((sum, e) => sum + (parseFloat(e.registrations || '0') || 0), 0);
    const sponsorshipValue = sponsorships
        .filter(s => String(s.status || '').toLowerCase() === 'confirmed')
        .reduce((sum, s) => sum + (parseFloat(s.amount || '0') || 0), 0);
    return {
        ...userDashboardData,
        stats: {
            ...((userDashboardData && userDashboardData.stats) ? userDashboardData.stats : {}),
            totalEvents: events.length,
            registrationCount,
            guestsManaged: guests.length,
            sponsorshipValue
        },
        events: enrichedEvents,
        guests,
        sponsorships
    };
}

// Render stats cards
function renderStatsCards(data) {
    const statsGrid = document.getElementById('statsGrid');
    if (!statsGrid) return;
    const isAdmin = isAdminPage();
    const stats = data.stats;
    const statsConfig = [
        {
            title: 'Total Events',
            value: stats.totalEvents || stats.totalEvents,
            icon: '📅',
            change: '+12%',
            positive: true
        },
        {
            title: isAdmin ? 'Total Users' : 'Registration Count',
            value: isAdmin ? (stats.totalUsers || 0) : (stats.registrationCount || 0),
            icon: isAdmin ? '👥' : '📝',
            change: isAdmin ? '+8%' : '+24%',
            positive: true
        },
        {
            title: isAdmin ? 'Total Revenue' : 'Guests Managed',
            value: isAdmin 
                ? formatCurrency(stats.totalRevenue || 0)
                : formatNumber(stats.guestsManaged || 0),
            icon: isAdmin ? '💰' : '🎫',
            change: isAdmin ? '+18%' : '+15%',
            positive: true
        },
        {
            title: isAdmin ? 'Active Events' : 'Sponsorship Value',
            value: isAdmin 
                ? (stats.activeEvents || 0)
                : formatCurrency(stats.sponsorshipValue || 0),
            icon: isAdmin ? '✅' : '🤝',
            change: isAdmin ? '+5' : '+32%',
            positive: true
        }
    ];
    
    if (isAdmin && stats.pendingApprovals) {
        statsConfig.push({
            title: 'Pending Approvals',
            value: stats.pendingApprovals,
            icon: '⏳',
            change: '3 new',
            positive: false
        });
    }
    
    statsGrid.innerHTML = statsConfig.map(stat => `
        <div class="stat-card">
            <div class="stat-card-header">
                <p class="stat-card-title">${stat.title}</p>
                <span class="stat-card-icon">${stat.icon}</span>
            </div>
            <h3 class="stat-card-value">${stat.value}</h3>
            <p class="stat-card-change ${stat.positive ? 'positive' : ''}">
                ${stat.change} from last month
            </p>
        </div>
    `).join('');
}

// Render events table
function renderEventsTable(data) {
    const eventsTable = document.getElementById('eventsTable');
    if (!eventsTable) return;
    
    const events = data.events || [];
    const isAdmin = isAdminPage();
    
    const tbody = eventsTable.querySelector('tbody') || eventsTable;
    
    if (tbody.tagName === 'TBODY') {
        tbody.innerHTML = events.map(event => `
            <tr>
                <td>${event.name}</td>
                ${isAdmin ? `<td>${event.clientEmail || event.client || 'N/A'}</td>` : ''}
                <td>${formatDate(event.date)}</td>
                <td><span class="badge badge-${getStatusBadgeClass(event.status)}">${event.status}</span></td>
                <td>${formatNumber(event.registrations || 0)}</td>
                ${isAdmin ? `<td>${formatCurrency(event.revenue || 0)}</td>` : `<td>${formatNumber(event.guests || 0)}</td>`}
                ${isAdmin ? '' : `<td>${formatCurrency(event.sponsorship || 0)}</td>`}
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="viewEvent('${String(event.id)}')">View</button>
                        ${isAdmin ? `<button class="btn btn-sm btn-secondary" onclick="editEvent('${String(event.id)}', '${event.clientEmail || ''}')">Edit</button>` : ''}
                        ${isAdmin ? `<button class="btn btn-sm btn-danger" onclick="deleteEvent('${String(event.id)}', '${event.clientEmail || ''}')">Delete</button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

// Render guests table
function renderGuestsTable(data) {
    const guestsTable = document.getElementById('guestsTable');
    if (!guestsTable) return;
    
    let guests = data.guests || [];
    const isAdmin = isAdminPage();
    const tbody = guestsTable.querySelector('tbody') || guestsTable;

    const params = new URLSearchParams(window.location.search || '');
    const filterEventId = params.get('eventId');
    const filterEventName = params.get('eventName');
    const filterClientEmail = params.get('clientEmail');

    if (filterClientEmail && isAdmin) {
        guests = guests.filter(g => normalizeEmail(g.clientEmail) === normalizeEmail(filterClientEmail));
    }

    let resolvedEventLabel = '';
    if (filterEventId) {
        const allEvents = data.events || [];
        const ev = allEvents.find(e => String(e.id) === String(filterEventId));
        if (ev && ev.name) {
            resolvedEventLabel = String(ev.name || '').trim();
            guests = guests.filter(g => String(g.event || '').trim() === resolvedEventLabel);
        }
    } else if (filterEventName) {
        resolvedEventLabel = String(filterEventName || '').trim();
        guests = guests.filter(g => String(g.event || '').trim() === resolvedEventLabel);
    }

    const guestsCard = guestsTable.closest('.content-card');
    const header = guestsCard ? guestsCard.querySelector('.content-card-header') : null;
    if (header) {
        const existing = header.querySelector('[data-guest-filter]');
        if (existing) existing.remove();
        if (filterEventId || filterEventName) {
            const label = document.createElement('div');
            label.setAttribute('data-guest-filter', '1');
            label.style.marginTop = '0.5rem';
            label.style.color = 'var(--text-secondary)';
            const eventLabel = resolvedEventLabel || (filterEventId ? `Event #${filterEventId}` : '');
            const backHref = isAdmin ? 'events.html' : 'events.html';
            label.innerHTML = `Showing guests for: <strong>${eventLabel}</strong> • <a href="${backHref}" style="color: var(--primary-color); text-decoration: none;">Back</a> • <a href="guests.html" style="color: var(--primary-color); text-decoration: none;">Clear</a>`;
            header.appendChild(label);
        }
    }
    
    if (tbody.tagName === 'TBODY') {
        tbody.innerHTML = guests.map(guest => `
            <tr>
                ${isAdmin ? `<td>${guest.clientEmail || ''}</td>` : ''}
                <td>${guest.name}</td>
                <td>${guest.email}</td>
                <td>${guest.event}</td>
                <td><span class="badge badge-${getStatusBadgeClass(guest.status)}">${guest.status}</span></td>
                <td><span class="badge badge-info">${guest.type}</span></td>
                ${isAdmin ? `<td>${guest.checkIn || 'Not checked in'}</td>` : ''}
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="viewGuest('${String(guest.id)}', '${guest.clientEmail || ''}')">View</button>
                        ${isAdmin ? `<button class="btn btn-sm btn-secondary" onclick="editGuest('${String(guest.id)}', '${guest.clientEmail || ''}')">Edit</button>` : ''}
                        ${isAdmin ? `<button class="btn btn-sm btn-danger" onclick="deleteGuest('${String(guest.id)}', '${guest.clientEmail || ''}')">Delete</button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

// Render users table (Admin only)
function renderUsersTable(data) {
    const usersTable = document.getElementById('usersTable');
    if (!usersTable) return;
    
    const users = data.users || [];
    const tbody = usersTable.querySelector('tbody') || usersTable;
    
    if (tbody.tagName === 'TBODY') {
        tbody.innerHTML = users.map(user => `
            <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${user.company || 'N/A'}</td>
                <td>${user.role}</td>
                <td><span class="badge badge-${getStatusBadgeClass(user.status)}">${user.status}</span></td>
                <td>${user.eventsCount}</td>
                <td>${formatDate(user.joinDate)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="viewUser('${String(user.email || '')}')">View</button>
                        <button class="btn btn-sm btn-secondary" onclick="editUser('${String(user.email || '')}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteUser('${String(user.email || '')}')">Delete</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

// Render sponsorships table
function renderSponsorshipsTable(data) {
    const sponsorshipsTable = document.getElementById('sponsorshipsTable');
    if (!sponsorshipsTable) return;
    
    const sponsorships = data.sponsorships || [];
    const tbody = sponsorshipsTable.querySelector('tbody') || sponsorshipsTable;
    const isAdmin = isAdminPage();
    
    if (tbody.tagName === 'TBODY') {
        tbody.innerHTML = sponsorships.map(sponsor => `
            <tr>
                ${isAdmin ? `<td>${sponsor.clientEmail || ''}</td>` : ''}
                <td>${sponsor.event}</td>
                <td>${sponsor.sponsor}</td>
                <td>${formatCurrency(sponsor.amount)}</td>
                <td><span class="badge badge-${getStatusBadgeClass(sponsor.status)}">${sponsor.status}</span></td>
                <td><span class="badge badge-info">${sponsor.tier}</span></td>
                ${isAdmin ? `<td>${sponsor.contact || ''}</td>` : ''}
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-primary" onclick="viewSponsorship('${String(sponsor.id)}', '${sponsor.clientEmail || ''}')">View</button>
                        ${isAdmin ? `<button class="btn btn-sm btn-secondary" onclick="editSponsorship('${String(sponsor.id)}', '${sponsor.clientEmail || ''}')">Edit</button>` : ''}
                        ${isAdmin ? `<button class="btn btn-sm btn-danger" onclick="deleteSponsorship('${String(sponsor.id)}', '${sponsor.clientEmail || ''}')">Delete</button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

function getClientCampaigns(user) {
    const email = normalizeEmail(user && user.username);
    if (!email) return [];

    const byUser = safeParseJSON(sessionStorage.getItem('apex_client_campaigns'));
    const campaigns = byUser && typeof byUser === 'object' ? byUser[email] : null;
    return Array.isArray(campaigns) ? campaigns : [];
}

function renderMarketingTableForClient() {
    const marketingTable = document.getElementById('marketingTable');
    if (!marketingTable) return;

    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const tbody = marketingTable.querySelector('tbody') || marketingTable;

    if (!user) return;

    const campaigns = getClientCampaigns(user);
    if (tbody.tagName !== 'TBODY') return;

    if (!campaigns.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 1.25rem;">
                    No campaigns created for your account yet.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = campaigns.map((campaign, idx) => `
        <tr>
            <td>${campaign.event || '-'}</td>
            <td>${campaign.platform || '-'}</td>
            <td><span class="badge badge-${getStatusBadgeClass((campaign.status || 'pending').toString())}">${campaign.status || 'pending'}</span></td>
            <td>${typeof campaign.reach === 'number' ? formatNumber(campaign.reach) : (campaign.reach || '-')}</td>
            <td>${typeof campaign.engagement === 'number' ? formatNumber(campaign.engagement) : (campaign.engagement || '-')}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewCampaignDetails('${String(campaign.id || idx)}')">View Details</button>
            </td>
        </tr>
    `).join('');
}

function ensureDetailsModal() {
    let modal = document.getElementById('detailsModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'detailsModal';
    modal.className = 'modal';
    modal.style.display = 'none';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 560px;">
            <div class="modal-header">
                <h2 id="detailsModalTitle">Details</h2>
                <span class="modal-close" data-details-close>&times;</span>
            </div>
            <div id="detailsModalBody" style="display: grid; gap: 0.5rem; padding: 1rem 0;"></div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-details-ok>Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const closeEls = modal.querySelectorAll('[data-details-close], [data-details-ok]');
    closeEls.forEach(el => el.addEventListener('click', function () { closeModal('detailsModal'); }));
    modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal('detailsModal');
    });

    return modal;
}

function setDetailsModalContent(title, rows) {
    ensureDetailsModal();
    const titleEl = document.getElementById('detailsModalTitle');
    const bodyEl = document.getElementById('detailsModalBody');
    if (titleEl) titleEl.textContent = String(title || 'Details');
    if (!bodyEl) return;

    const safeRows = Array.isArray(rows) ? rows : [];
    bodyEl.innerHTML = safeRows.map(r => {
        const obj = r && typeof r === 'object' ? r : {};
        const label = obj.label || '';
        const value = obj.value == null ? '' : obj.value;
        return `
        <div style="display: flex; justify-content: space-between; gap: 1rem;">
            <div style="color: var(--text-secondary);">${String(label || '')}</div>
            <div style="color: var(--text-primary); font-weight: 600; text-align: right; word-break: break-word;">${String(value)}</div>
        </div>
    `;
    }).join('');
}

function viewCampaignDetails(idOrIndex) {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (!user) return;
    const campaigns = getClientCampaigns(user);
    const key = String(idOrIndex);
    let campaign = campaigns.find(c => c && String(c.id) === key);
    if (!campaign) {
        const idx = Number.parseInt(key, 10);
        if (Number.isInteger(idx) && idx >= 0 && idx < campaigns.length) campaign = campaigns[idx];
    }
    if (!campaign) {
        alert('Campaign not found. Please refresh and try again.');
        return;
    }

    setDetailsModalContent('Campaign Details', [
        { label: 'Event', value: campaign.event || '-' },
        { label: 'Platform', value: campaign.platform || '-' },
        { label: 'Status', value: campaign.status || 'pending' },
        { label: 'Reach', value: typeof campaign.reach === 'number' ? formatNumber(campaign.reach) : (campaign.reach || '-') },
        { label: 'Engagement', value: typeof campaign.engagement === 'number' ? formatNumber(campaign.engagement) : (campaign.engagement || '-') }
    ]);
    openModal('detailsModal');
}

function renderCampaignsTableForAdmin() {
    const table = document.getElementById('adminCampaignsTable');
    if (!table) return;

    const tbody = table.querySelector('tbody') || table;
    if (tbody.tagName !== 'TBODY') return;

    const campaigns = getAllItemsFromEmailMap(KEY_CLIENT_CAMPAIGNS);
    if (!campaigns.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 1.25rem;">
                    No campaigns created yet.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = campaigns.map(c => `
        <tr>
            <td>${c.clientEmail || ''}</td>
            <td>${c.event || '-'}</td>
            <td>${c.platform || '-'}</td>
            <td><span class="badge badge-${getStatusBadgeClass((c.status || 'pending').toString())}">${c.status || 'pending'}</span></td>
            <td>${typeof c.reach === 'number' ? formatNumber(c.reach) : (c.reach || '-')}</td>
            <td>${typeof c.engagement === 'number' ? formatNumber(c.engagement) : (c.engagement || '-')}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-secondary" onclick="editCampaign('${String(c.id)}', '${c.clientEmail || ''}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCampaign('${String(c.id)}', '${c.clientEmail || ''}')">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Get status badge class
function getStatusBadgeClass(status) {
    const statusMap = {
        'active': 'success',
        'confirmed': 'success',
        'completed': 'success',
        'inactive': 'danger',
        'planning': 'warning',
        'scheduled': 'warning',
        'pending': 'warning',
        'draft': 'info',
        'cancelled': 'danger'
    };
    const key = String(status || '').toLowerCase();
    return statusMap[key] || 'info';
}

// Event handlers (placeholder functions)
function viewEvent(id) {
    const data = loadDashboardData();
    const events = data.events || [];
    const ev = events.find(e => String(e.id) === String(id));
    if (!ev) {
        alert('Event not found. Please refresh and try again.');
        return;
    }
    const isAdmin = isAdminPage();
    const params = new URLSearchParams();
    params.set('eventId', String(id));
    if (isAdmin && ev.clientEmail) params.set('clientEmail', normalizeEmail(ev.clientEmail));
    const base = isAdmin ? 'guests.html' : 'guests.html';
    window.location.href = `${base}?${params.toString()}`;
}

function editEvent(id) {
    if (!isAdminPage()) {
        alert('Only admin can edit events.');
        return;
    }
    showEditEventModal(id, arguments[1]);
}

function deleteEvent(id) {
    if (!isAdminPage()) return;
    const email = resolveEmailForItemId(KEY_CLIENT_EVENTS, id, arguments[1]);
    if (!email) {
        alert('Client email is missing. Please refresh and try again.');
        return;
    }
    if (!confirm('Are you sure you want to delete this event?')) return;
    const list = getListForEmail(KEY_CLIENT_EVENTS, email);
    setListForEmail(KEY_CLIENT_EVENTS, email, list.filter(e => String(e.id) !== String(id)));
    renderEventsTable(loadDashboardData());
}

function viewGuest(id) {
    const isAdmin = isAdminPage();
    if (isAdmin) {
        let email = normalizeEmail(arguments[1] || '');
        if (!email) {
            const all = getAllItemsFromEmailMap(KEY_CLIENT_GUESTS);
            const found = all.find(g => String(g.id) === String(id));
            email = normalizeEmail((found && found.clientEmail) || '');
        }
        if (!email) {
            alert('Client email is missing. Please refresh and try again.');
            return;
        }
        showEditGuestModal(id, email, true);
        return;
    }

    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const email = getUserEmail(user);
    const list = getListForEmail(KEY_CLIENT_GUESTS, email);
    const guest = list.find(g => String(g.id) === String(id));
    if (!guest) {
        alert('Guest not found. Please refresh and try again.');
        return;
    }
    alert(
        `Guest: ${guest.name || ''}\n` +
        `Email: ${guest.email || ''}\n` +
        `Event: ${guest.event || ''}\n` +
        `Status: ${guest.status || ''}\n` +
        `Type: ${guest.type || ''}\n` +
        `Check-In: ${guest.checkIn || 'Not checked in'}`
    );
}

function editGuest(id) {
    if (!isAdminPage()) {
        alert('Only admin can edit guests.');
        return;
    }
    showEditGuestModal(id, arguments[1], false);
}

function deleteGuest(id) {
    if (!isAdminPage()) return;
    const email = normalizeEmail(arguments[1] || '');
    if (!email) {
        alert('Client email is missing. Please refresh and try again.');
        return;
    }
    if (!confirm('Are you sure you want to delete this guest?')) return;
    const list = getListForEmail(KEY_CLIENT_GUESTS, email);
    setListForEmail(KEY_CLIENT_GUESTS, email, list.filter(g => String(g.id) !== String(id)));
    renderGuestsTable(loadDashboardData());
}

function viewUser(id) {
    const email = normalizeEmail(id);
    if (!email) return;
    if (window.location.pathname.endsWith('/users.html') && document.getElementById('userModal')) {
        showEditUserModal(email, true);
        return;
    }
    window.location.href = `users.html?email=${encodeURIComponent(email)}&mode=view`;
}

function editUser(id) {
    const email = normalizeEmail(id);
    if (!email) return;
    if (window.location.pathname.endsWith('/users.html') && document.getElementById('userModal')) {
        showEditUserModal(email, false);
        return;
    }
    window.location.href = `users.html?email=${encodeURIComponent(email)}&mode=edit`;
}

function deleteUser(id) {
    if (!isAdminPage()) return;
    const email = normalizeEmail(id);
    if (!email) return;
    if (!confirm('Are you sure you want to delete this user? This will remove all related client data.')) return;

    const usersMap = getCustomUsersMap();
    if (Object.prototype.hasOwnProperty.call(usersMap, email)) {
        delete usersMap[email];
        setCustomUsersMap(usersMap);
    }

    deleteClientDataForEmail(email);

    const data = loadDashboardData();
    renderStatsCards(data);
    renderUsersTable(data);
    renderEventsTable(data);
    renderGuestsTable(data);
    renderSponsorshipsTable(data);
}

function viewSponsorship(id) {
    const isAdmin = isAdminPage();
    if (isAdmin) {
        let email = normalizeEmail(arguments[1] || '');
        if (!email) {
            const all = getAllItemsFromEmailMap(KEY_CLIENT_SPONSORSHIPS);
            const found = all.find(s => String(s.id) === String(id));
            email = normalizeEmail((found && found.clientEmail) || '');
        }
        if (!email) {
            alert('Client email is missing. Please refresh and try again.');
            return;
        }
        showEditSponsorshipModal(id, email, true);
        return;
    }

    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const email = getUserEmail(user);
    const list = getListForEmail(KEY_CLIENT_SPONSORSHIPS, email);
    const sponsor = list.find(s => String(s.id) === String(id));
    if (!sponsor) {
        alert('Sponsorship not found. Please refresh and try again.');
        return;
    }
    alert(
        `Sponsor: ${sponsor.sponsor || ''}\n` +
        `Event: ${sponsor.event || ''}\n` +
        `Amount: ${formatCurrency(sponsor.amount || 0)}\n` +
        `Status: ${sponsor.status || ''}\n` +
        `Tier: ${sponsor.tier || ''}\n` +
        `Contact: ${sponsor.contact || ''}`
    );
}

function showAddUserModal() {
    if (!isAdminPage()) return;
    const modal = document.getElementById('userModal');
    const form = document.getElementById('userForm');
    if (!modal || !form) return;

    form.reset();
    delete form.dataset.editEmail;
    delete form.dataset.mode;

    const passwordEl = document.getElementById('userPassword');
    if (passwordEl) {
        passwordEl.required = true;
        passwordEl.disabled = false;
        passwordEl.value = '';
    }

    ['userName', 'userEmail', 'userCompany', 'userRole', 'userStatus', 'userPlan'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = false;
    });

    const header = modal.querySelector('.modal-header h2');
    const submitBtn = modal.querySelector('button[type="submit"]');
    if (header) header.textContent = 'Add User';
    if (submitBtn) submitBtn.textContent = 'Create User';
    openModal('userModal');
}

function showEditUserModal(email, readOnly) {
    if (!isAdminPage()) return;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return;
    const usersMap = getCustomUsersMap();
    const existing = usersMap[normalizedEmail];
    if (!existing) {
        alert('User not found. Please refresh and try again.');
        return;
    }

    const modal = document.getElementById('userModal');
    const form = document.getElementById('userForm');
    if (!modal || !form) return;

    form.dataset.editEmail = normalizedEmail;
    form.dataset.mode = readOnly ? 'view' : 'edit';

    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    const companyEl = document.getElementById('userCompany');
    const roleEl = document.getElementById('userRole');
    const statusEl = document.getElementById('userStatus');
    const planEl = document.getElementById('userPlan');
    const passwordEl = document.getElementById('userPassword');

    if (nameEl) nameEl.value = existing.name || '';
    if (emailEl) emailEl.value = existing.username || normalizedEmail;
    if (companyEl) companyEl.value = existing.company || '';
    if (roleEl) roleEl.value = existing.role || 'client';
    if (statusEl) statusEl.value = existing.status || 'active';

    const planData = getClientPlanForEmail(normalizedEmail);
    if (planEl) planEl.value = (planData && planData.plan) || '';

    if (passwordEl) {
        passwordEl.value = '';
        passwordEl.required = false;
        passwordEl.disabled = Boolean(readOnly);
    }

    const disabled = Boolean(readOnly);
    [nameEl, emailEl, companyEl, roleEl, statusEl, planEl].forEach(el => {
        if (el) el.disabled = disabled;
    });

    const header = modal.querySelector('.modal-header h2');
    const submitBtn = modal.querySelector('button[type="submit"]');
    if (header) header.textContent = readOnly ? 'View User' : 'Edit User';
    if (submitBtn) submitBtn.textContent = readOnly ? 'Close' : 'Save Changes';
    openModal('userModal');
}

function setupUsersPageActions() {
    if (!isAdminPage()) return;

    const addBtn = document.getElementById('addUserBtn');
    if (addBtn) {
        addBtn.addEventListener('click', function () {
            showAddUserModal();
        });
    }

    const params = new URLSearchParams(window.location.search || '');
    const email = normalizeEmail(params.get('email') || '');
    const mode = String(params.get('mode') || '').toLowerCase();
    if (email && (mode === 'view' || mode === 'edit')) {
        showEditUserModal(email, mode === 'view');
    }
}

function setupUserForm() {
    const form = document.getElementById('userForm');
    if (!form) return;

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!isAdminPage()) return;

        const mode = String(form.dataset.mode || '').toLowerCase();
        if (mode === 'view') {
            closeModal('userModal');
            return;
        }

        const nameEl = document.getElementById('userName');
        const emailEl = document.getElementById('userEmail');
        const passwordEl = document.getElementById('userPassword');
        const companyEl = document.getElementById('userCompany');
        const roleEl = document.getElementById('userRole');
        const statusEl = document.getElementById('userStatus');
        const planEl = document.getElementById('userPlan');

        const name = String((nameEl && nameEl.value) || '').trim();
        const emailInput = String((emailEl && emailEl.value) || '').trim();
        const nextEmail = normalizeEmail(emailInput);
        const password = String((passwordEl && passwordEl.value) || '').trim();
        const company = String((companyEl && companyEl.value) || '').trim();
        const role = String((roleEl && roleEl.value) || 'client').trim();
        const status = String((statusEl && statusEl.value) || 'active').trim();
        const plan = String((planEl && planEl.value) || '').trim();

        const settings = getAdminSettings();
        if (settings && settings.security && settings.security.passwordComplexity && password && !isComplexPassword(password)) {
            alert('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.');
            return;
        }

        if (!name || !nextEmail) {
            alert('Name and Email are required.');
            return;
        }

        const usersMap = getCustomUsersMap();
        const editEmail = normalizeEmail(form.dataset.editEmail || '');
        const isEditing = Boolean(editEmail);
        const existing = isEditing ? usersMap[editEmail] : null;

        if (!isEditing && !password) {
            alert('Password is required for new users.');
            return;
        }

        if (isEditing && nextEmail !== editEmail && Object.prototype.hasOwnProperty.call(usersMap, nextEmail)) {
            alert('Another user with this email already exists.');
            return;
        }

        const nowIso = new Date().toISOString();
        const nextUser = {
            ...(existing && typeof existing === 'object' ? existing : {}),
            username: nextEmail,
            name,
            company,
            role,
            status,
            joinDate: (existing && (existing.joinDate || existing.createdAt)) ? (existing.joinDate || existing.createdAt) : nowIso,
            updatedAt: nowIso
        };

        if (!isEditing) {
            nextUser.createdAt = nowIso;
        }

        if (password) nextUser.password = password;

        if (isEditing && nextEmail !== editEmail) {
            delete usersMap[editEmail];
            renameEmailInEmailMap(KEY_CLIENT_EVENTS, editEmail, nextEmail);
            renameEmailInEmailMap(KEY_CLIENT_GUESTS, editEmail, nextEmail);
            renameEmailInEmailMap(KEY_CLIENT_SPONSORSHIPS, editEmail, nextEmail);
            renameEmailInEmailMap(KEY_CLIENT_CAMPAIGNS, editEmail, nextEmail);
            renameEmailInPlainMap(KEY_CLIENT_PLANS, editEmail, nextEmail);
            renameEmailInPlainMap(KEY_PLAN_CHECKLISTS, editEmail, nextEmail);

            const current = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            if (current && normalizeEmail(current.username) === editEmail) {
                const updatedCurrent = { ...current, username: nextEmail };
                sessionStorage.setItem('apex_user', JSON.stringify(updatedCurrent));
            }
        }

        usersMap[nextEmail] = nextUser;
        setCustomUsersMap(usersMap);

        const planMapRaw = safeParseJSON(sessionStorage.getItem(KEY_CLIENT_PLANS));
        let planMap = planMapRaw && typeof planMapRaw === 'object' ? planMapRaw : {};
        if (!planMap || typeof planMap !== 'object') planMap = {};

        if (plan) {
            const existingPlan = planMap[nextEmail] && typeof planMap[nextEmail] === 'object' ? planMap[nextEmail] : {};
            planMap[nextEmail] = {
                plan: plan,
                price: existingPlan.price || 0,
                selectedAt: existingPlan.selectedAt || nowIso,
                userId: nextEmail,
                paymentId: existingPlan.paymentId || null,
                setByAdmin: true
            };
            sessionStorage.setItem(KEY_CLIENT_PLANS, JSON.stringify(planMap));
        } else if (Object.prototype.hasOwnProperty.call(planMap, nextEmail)) {
            delete planMap[nextEmail];
            sessionStorage.setItem(KEY_CLIENT_PLANS, JSON.stringify(planMap));

            const checklistRaw = safeParseJSON(sessionStorage.getItem(KEY_PLAN_CHECKLISTS));
            const checklistMap = checklistRaw && typeof checklistRaw === 'object' ? checklistRaw : {};
            if (Object.prototype.hasOwnProperty.call(checklistMap, nextEmail)) {
                delete checklistMap[nextEmail];
                sessionStorage.setItem(KEY_PLAN_CHECKLISTS, JSON.stringify(checklistMap));
            }
        }

        if (!isEditing) {
            maybeNotify('user_registration', { email: nextEmail, name, company, role });
        }

        alert(isEditing ? 'User updated successfully!' : 'User created successfully!');

        closeModal('userModal');
        form.reset();
        delete form.dataset.editEmail;
        delete form.dataset.mode;

        const data = loadDashboardData();
        renderStatsCards(data);
        renderUsersTable(data);
        renderEventsTable(data);
        renderGuestsTable(data);
        renderSponsorshipsTable(data);
        renderAdminAnalytics();
    });
}

function setupAdminSettingsPage() {
    if (!isAdminPage()) return;

    const generalForm = document.getElementById('generalSettingsForm');
    const notificationForm = document.getElementById('notificationSettingsForm');
    const securityForm = document.getElementById('securitySettingsForm');
    if (!generalForm && !notificationForm && !securityForm) return;

    const settings = getAdminSettings();

    const companyNameEl = document.getElementById('companyName');
    const companyEmailEl = document.getElementById('companyEmail');
    const companyPhoneEl = document.getElementById('companyPhone');
    if (companyNameEl) companyNameEl.value = settings.general.companyName || '';
    if (companyEmailEl) companyEmailEl.value = settings.general.companyEmail || '';
    if (companyPhoneEl) companyPhoneEl.value = settings.general.companyPhone || '';

    const notifyNewEventsEl = document.getElementById('notifyNewEvents');
    const notifyRegistrationsEl = document.getElementById('notifyUserRegistrations');
    const notifySponsorshipEl = document.getElementById('notifySponsorshipUpdates');
    const notifySmsEl = document.getElementById('notifySmsUrgent');
    if (notifyNewEventsEl) notifyNewEventsEl.checked = Boolean(settings.notifications.newEventsEmail);
    if (notifyRegistrationsEl) notifyRegistrationsEl.checked = Boolean(settings.notifications.registrationsEmail);
    if (notifySponsorshipEl) notifySponsorshipEl.checked = Boolean(settings.notifications.sponsorshipUpdatesEmail);
    if (notifySmsEl) notifySmsEl.checked = Boolean(settings.notifications.urgentSms);

    const sessionTimeoutEl = document.getElementById('sessionTimeout');
    const require2faEl = document.getElementById('requireAdmin2fa');
    const complexityEl = document.getElementById('passwordComplexity');
    if (sessionTimeoutEl) sessionTimeoutEl.value = String(settings.security.sessionTimeoutMinutes == null ? 30 : settings.security.sessionTimeoutMinutes);
    if (require2faEl) require2faEl.checked = Boolean(settings.security.requireAdmin2fa);
    if (complexityEl) complexityEl.checked = Boolean(settings.security.passwordComplexity);

    if (generalForm) {
        generalForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const next = setAdminSettings({
                general: {
                    companyName: String((companyNameEl && companyNameEl.value) || '').trim(),
                    companyEmail: String((companyEmailEl && companyEmailEl.value) || '').trim(),
                    companyPhone: String((companyPhoneEl && companyPhoneEl.value) || '').trim()
                }
            });
            applyAdminSettingsToPage();
            alert('General settings saved.');
            return next;
        });
    }

    if (notificationForm) {
        notificationForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const next = setAdminSettings({
                notifications: {
                    newEventsEmail: Boolean(notifyNewEventsEl && notifyNewEventsEl.checked),
                    registrationsEmail: Boolean(notifyRegistrationsEl && notifyRegistrationsEl.checked),
                    sponsorshipUpdatesEmail: Boolean(notifySponsorshipEl && notifySponsorshipEl.checked),
                    urgentSms: Boolean(notifySmsEl && notifySmsEl.checked)
                }
            });
            alert('Notification settings saved.');
            return next;
        });
    }

    if (securityForm) {
        securityForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const raw = Number((sessionTimeoutEl && sessionTimeoutEl.value) || '');
            const minutes = Number.isFinite(raw) ? Math.max(5, Math.min(120, raw)) : 30;
            if (sessionTimeoutEl) sessionTimeoutEl.value = String(minutes);
            const next = setAdminSettings({
                security: {
                    sessionTimeoutMinutes: minutes,
                    requireAdmin2fa: Boolean(require2faEl && require2faEl.checked),
                    passwordComplexity: Boolean(complexityEl && complexityEl.checked)
                }
            });
            alert('Security settings saved.');
            return next;
        });
    }
}

function editSponsorship(id) {
    if (!isAdminPage()) {
        alert('Only admin can edit sponsorships.');
        return;
    }
    const email = resolveEmailForItemId(KEY_CLIENT_SPONSORSHIPS, id, arguments[1]);
    showEditSponsorshipModal(id, email);
}

function deleteSponsorship(id) {
    if (!isAdminPage()) return;
    const email = resolveEmailForItemId(KEY_CLIENT_SPONSORSHIPS, id, arguments[1]);
    if (!email) {
        alert('Client email is missing. Please refresh and try again.');
        return;
    }
    if (!confirm('Are you sure you want to delete this sponsorship?')) return;
    const list = getListForEmail(KEY_CLIENT_SPONSORSHIPS, email);
    setListForEmail(KEY_CLIENT_SPONSORSHIPS, email, list.filter(s => String(s.id) !== String(id)));
    renderSponsorshipsTable(loadDashboardData());
}

function showAddEventModal() {
    if (!isAdminPage()) return;
    const form = document.getElementById('eventForm');
    if (!form) return;
    form.reset();
    delete form.dataset.editId;
    delete form.dataset.editEmail;

    const modal = document.getElementById('eventModal');
    if (modal) {
        const header = modal.querySelector('.modal-header h2');
        const submitBtn = modal.querySelector('button[type="submit"]');
        if (header) header.textContent = 'Create Event';
        if (submitBtn) submitBtn.textContent = 'Create Event';
        modal.style.display = 'flex';
    }
}

function showEditEventModal(id) {
    const email = resolveEmailForItemId(KEY_CLIENT_EVENTS, id, arguments[1]);
    if (!email) {
        alert('Client email is missing. Please refresh and try again.');
        return;
    }
    const list = getListForEmail(KEY_CLIENT_EVENTS, email);
    const item = list.find(e => String(e.id) === String(id));
    if (!item) {
        alert('Event not found. Please refresh and try again.');
        return;
    }

    const form = document.getElementById('eventForm');
    if (!form) return;
    form.dataset.editId = String(id);
    form.dataset.editEmail = email;

    document.getElementById('eventClientEmail').value = item.clientEmail || email;
    document.getElementById('eventClientName').value = item.client || '';
    document.getElementById('eventName').value = item.name || '';
    document.getElementById('eventDate').value = item.date || '';
    document.getElementById('eventStatus').value = item.status || 'draft';
    document.getElementById('eventRegistrations').value = item.registrations || 0;
    document.getElementById('eventGuests').value = item.guests || 0;
    document.getElementById('eventSponsorship').value = item.sponsorship || 0;
    document.getElementById('eventRevenue').value = item.revenue || 0;

    const modal = document.getElementById('eventModal');
    if (modal) {
        const header = modal.querySelector('.modal-header h2');
        const submitBtn = modal.querySelector('button[type="submit"]');
        if (header) header.textContent = 'Edit Event';
        if (submitBtn) submitBtn.textContent = 'Save Changes';
        modal.style.display = 'flex';
    }
}

function setupEventForm() {
    const form = document.getElementById('eventForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!isAdminPage()) return;

        const editId = form.dataset.editId;
        const editEmail = normalizeEmail(form.dataset.editEmail || '');
        const clientEmail = normalizeEmail(document.getElementById('eventClientEmail').value);
        if (!clientEmail) return;

        const next = {
            id: editId ? editId : ('event_' + Date.now()),
            clientEmail,
            client: (document.getElementById('eventClientName').value || '').trim(),
            name: (document.getElementById('eventName').value || '').trim(),
            date: document.getElementById('eventDate').value,
            status: document.getElementById('eventStatus').value,
            registrations: parseFloat(document.getElementById('eventRegistrations').value || '0') || 0,
            guests: parseFloat(document.getElementById('eventGuests').value || '0') || 0,
            sponsorship: parseFloat(document.getElementById('eventSponsorship').value || '0') || 0,
            revenue: parseFloat(document.getElementById('eventRevenue').value || '0') || 0
        };

        const list = getListForEmail(KEY_CLIENT_EVENTS, clientEmail);
        const isEditing = Boolean(editId);

        if (isEditing) {
            const sourceEmail = editEmail || clientEmail;
            const sourceList = getListForEmail(KEY_CLIENT_EVENTS, sourceEmail);
            const sourceIdx = sourceList.findIndex(ev => String(ev.id) === String(editId));
            if (sourceIdx === -1) {
                alert('Event not found. Please refresh and try again.');
                closeModal('eventModal');
                return;
            }
            sourceList.splice(sourceIdx, 1);
            setListForEmail(KEY_CLIENT_EVENTS, sourceEmail, sourceList);

            const targetList = getListForEmail(KEY_CLIENT_EVENTS, clientEmail);
            const targetIdx = targetList.findIndex(ev => String(ev.id) === String(editId));
            if (targetIdx !== -1) targetList[targetIdx] = next;
            else targetList.push(next);
            setListForEmail(KEY_CLIENT_EVENTS, clientEmail, targetList);
            alert('Event updated successfully!');
        } else {
            list.push(next);
            setListForEmail(KEY_CLIENT_EVENTS, clientEmail, list);
            maybeNotify('new_event', { clientEmail, name: next.name, date: next.date, status: next.status });
            alert('Event created successfully!');
        }

        closeModal('eventModal');
        const data = loadDashboardData();
        renderEventsTable(data);
        form.reset();
        delete form.dataset.editId;
        delete form.dataset.editEmail;
    });
}

function showAddGuestModal() {
    if (!isAdminPage()) return;
    const form = document.getElementById('guestForm');
    if (!form) return;
    form.reset();
    delete form.dataset.editId;
    delete form.dataset.editEmail;
    delete form.dataset.mode;

    ['guestClientEmail', 'guestName', 'guestEmail', 'guestEvent', 'guestStatus', 'guestType', 'guestCheckIn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = false;
    });
    const modal = document.getElementById('guestModal');
    if (modal) {
        const header = modal.querySelector('.modal-header h2');
        const submitBtn = modal.querySelector('button[type="submit"]');
        if (header) header.textContent = 'Add Guest';
        if (submitBtn) submitBtn.textContent = 'Add Guest';
        modal.style.display = 'flex';
    }
}

function showEditGuestModal(id, email, readOnly) {
    const resolvedEmail = normalizeEmail(email || '');
    const isReadOnly = Boolean(readOnly);
    if (!resolvedEmail) {
        alert('Client email is missing. Please refresh and try again.');
        return;
    }
    const list = getListForEmail(KEY_CLIENT_GUESTS, resolvedEmail);
    const item = list.find(g => String(g.id) === String(id));
    if (!item) {
        alert('Guest not found. Please refresh and try again.');
        return;
    }

    const form = document.getElementById('guestForm');
    if (!form) return;
    form.dataset.editId = String(id);
    form.dataset.editEmail = resolvedEmail;
    form.dataset.mode = isReadOnly ? 'view' : 'edit';

    document.getElementById('guestClientEmail').value = item.clientEmail || resolvedEmail;
    document.getElementById('guestName').value = item.name || '';
    document.getElementById('guestEmail').value = item.email || '';
    document.getElementById('guestEvent').value = item.event || '';
    document.getElementById('guestStatus').value = item.status || 'pending';
    document.getElementById('guestType').value = item.type || 'Standard';
    document.getElementById('guestCheckIn').value = item.checkIn || '';

    ['guestClientEmail', 'guestName', 'guestEmail', 'guestEvent', 'guestStatus', 'guestType', 'guestCheckIn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = isReadOnly;
    });

    const modal = document.getElementById('guestModal');
    if (modal) {
        const header = modal.querySelector('.modal-header h2');
        const submitBtn = modal.querySelector('button[type="submit"]');
        if (header) header.textContent = isReadOnly ? 'View Guest' : 'Edit Guest';
        if (submitBtn) submitBtn.textContent = isReadOnly ? 'Close' : 'Save Changes';
        modal.style.display = 'flex';
    }
}

function setupGuestForm() {
    const form = document.getElementById('guestForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!isAdminPage()) return;

        const mode = String(form.dataset.mode || '').toLowerCase();
        if (mode === 'view') {
            closeModal('guestModal');
            return;
        }

        const editId = form.dataset.editId;
        const editEmail = normalizeEmail(form.dataset.editEmail || '');
        const clientEmail = normalizeEmail(document.getElementById('guestClientEmail').value);
        if (!clientEmail) return;

        const next = {
            id: editId ? editId : ('guest_' + Date.now()),
            clientEmail,
            name: (document.getElementById('guestName').value || '').trim(),
            email: (document.getElementById('guestEmail').value || '').trim(),
            event: (document.getElementById('guestEvent').value || '').trim(),
            status: document.getElementById('guestStatus').value,
            type: document.getElementById('guestType').value,
            checkIn: (document.getElementById('guestCheckIn').value || '').trim()
        };

        if (editId) {
            const sourceEmail = editEmail || clientEmail;
            const sourceList = getListForEmail(KEY_CLIENT_GUESTS, sourceEmail);
            const sourceIdx = sourceList.findIndex(g => String(g.id) === String(editId));
            if (sourceIdx === -1) {
                alert('Guest not found. Please refresh and try again.');
                closeModal('guestModal');
                return;
            }
            sourceList.splice(sourceIdx, 1);
            setListForEmail(KEY_CLIENT_GUESTS, sourceEmail, sourceList);

            const targetList = getListForEmail(KEY_CLIENT_GUESTS, clientEmail);
            const targetIdx = targetList.findIndex(g => String(g.id) === String(editId));
            if (targetIdx !== -1) targetList[targetIdx] = next;
            else targetList.push(next);
            setListForEmail(KEY_CLIENT_GUESTS, clientEmail, targetList);
            alert('Guest updated successfully!');
        } else {
            const planData = getClientPlanForEmail(clientEmail);
            const plan = (planData && planData.plan) || '';
            const limit = getPlanLimit(plan);
            if (!next.event) {
                alert('Please select an event name for this guest.');
                return;
            }
            const list = getListForEmail(KEY_CLIENT_GUESTS, clientEmail);
            if (limit) {
                const eventCount = list.filter(g => String(g.event || '').trim() === String(next.event || '').trim()).length;
                if (eventCount >= limit) {
                    alert(`Guest limit reached for Plan ${String(plan).toUpperCase()}: Max ${limit} guests per event.`);
                    return;
                }
            }
            list.push(next);
            setListForEmail(KEY_CLIENT_GUESTS, clientEmail, list);
            alert('Guest added successfully!');
        }

        closeModal('guestModal');
        renderGuestsTable(loadDashboardData());
        form.reset();
        delete form.dataset.editId;
        delete form.dataset.editEmail;
        delete form.dataset.mode;
    });
}

/* ============================================
   Analytics - Team Leaderboard Chart
   ============================================ */
document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('teamLeaderboardChart');
    if (canvas) {
        initTeamLeaderboardChart(canvas);
    }
});

function initTeamLeaderboardChart(canvas) {
    // Team Members Data (Mirrored from team-management.js)
    const teamMembers = [
        { id: 'tm001', name: 'Mr. Divyansh Gupta', photo: 'assets/images/team-divyansh-gupta.jpeg' },
        { id: 'tm002', name: 'Anurag Sangar', photo: 'assets/images/team-anurag-sangar.jpeg' },
        { id: 'tm003', name: 'Miss Palak', photo: 'assets/images/team-palak.jpeg' },
        { id: 'tm004', name: 'Aman Yadav', photo: 'assets/images/team-aman-yadav.jpeg' },
        { id: 'tm005', name: 'Aarti Yadav', photo: 'assets/images/team-aarti-yadav.jpeg' },
        { id: 'tm006', name: 'Prince Jangra', photo: 'assets/images/team-prince-jangra.jpeg' },
        { id: 'tm007', name: 'Naman Singh', photo: 'assets/images/team-naman-singh.jpeg' },
        { id: 'tm008', name: 'Drishti Pathak', photo: 'assets/images/team-drishti-pathak.jpeg' },
        { id: 'tm009', name: 'Deepti', photo: 'assets/images/team-deepti.jpeg' }
    ];

    // Fetch Rewards from API (Remote Only)
    // We cannot use localStorage. We will try to fetch from the server if possible.
    // For now, we will use an empty array or try to fetch if we have an endpoint.
    let localRewards = [];
    try {
        // Attempt to fetch if we have a global config or just use empty
        if (window.APEX_CONFIG && window.APEX_CONFIG.getApiUrl) {
            // This would be async, but Chart.js init is sync here.
            // In a real app, we would fetch then render.
            // For now, we'll leave it empty to respect "no local storage".
        }
    } catch (e) {
        localRewards = [];
    }
    
    // Calculate Points
    const scores = {};
    teamMembers.forEach(m => {
        scores[m.id] = { name: m.name, points: 0 };
    });
    
    localRewards.forEach(r => {
        const memId = String(r.memberId || '').trim();
        if (scores[memId]) {
            const amount = parseFloat(r.amount || 0);
            if (!isNaN(amount)) {
                scores[memId].points += amount;
            }
        }
    });

    // Sort by Points (Desc)
    const sortedMembers = Object.values(scores).sort((a, b) => b.points - a.points);
    
    // Prepare Chart Data
    const labels = sortedMembers.map(m => m.name.split(' ')[0]);
    const dataPoints = sortedMembers.map(m => m.points);
    
    // Render Chart
    new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Points',
                data: dataPoints,
                backgroundColor: 'rgba(212, 175, 55, 0.6)',
                borderColor: 'rgba(212, 175, 55, 1)',
                borderWidth: 1,
                hoverBackgroundColor: 'rgba(212, 175, 55, 0.8)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Points'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        autoSkip: false,
                        maxRotation: 45,
                        minRotation: 0
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false,
                    text: 'Team Performance Leaderboard'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Points: ${context.raw.toLocaleString()}`;
                        }
                    }
                }
            },
            animation: {
                duration: 1500,
                easing: 'easeOutQuart'
            }
        }
    });
}

function showAddSponsorshipModal() {
    if (!isAdminPage()) return;
    const form = document.getElementById('sponsorshipForm');
    if (!form) return;
    form.reset();
    delete form.dataset.editId;
    delete form.dataset.editEmail;
    delete form.dataset.mode;

    ['sponsorClientEmail', 'sponsorEvent', 'sponsorName', 'sponsorAmount', 'sponsorStatus', 'sponsorTier', 'sponsorContact'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = false;
    });
    const modal = document.getElementById('sponsorshipModal');
    if (modal) {
        const header = modal.querySelector('.modal-header h2');
        const submitBtn = modal.querySelector('button[type="submit"]');
        if (header) header.textContent = 'Add Sponsorship';
        if (submitBtn) submitBtn.textContent = 'Add Sponsorship';
        modal.style.display = 'flex';
    }
}

function showEditSponsorshipModal(id, email, readOnly) {
    const resolvedEmail = normalizeEmail(email || '');
    const isReadOnly = Boolean(readOnly);
    if (!resolvedEmail) {
        alert('Client email is missing. Please refresh and try again.');
        return;
    }
    const list = getListForEmail(KEY_CLIENT_SPONSORSHIPS, resolvedEmail);
    const item = list.find(s => String(s.id) === String(id));
    if (!item) {
        alert('Sponsorship not found. Please refresh and try again.');
        return;
    }

    const form = document.getElementById('sponsorshipForm');
    if (!form) return;
    form.dataset.editId = String(id);
    form.dataset.editEmail = resolvedEmail;
    form.dataset.mode = isReadOnly ? 'view' : 'edit';

    document.getElementById('sponsorClientEmail').value = item.clientEmail || resolvedEmail;
    document.getElementById('sponsorEvent').value = item.event || '';
    document.getElementById('sponsorName').value = item.sponsor || '';
    document.getElementById('sponsorAmount').value = item.amount || 0;
    document.getElementById('sponsorStatus').value = item.status || 'pending';
    document.getElementById('sponsorTier').value = item.tier || 'Bronze';
    document.getElementById('sponsorContact').value = item.contact || '';

    ['sponsorClientEmail', 'sponsorEvent', 'sponsorName', 'sponsorAmount', 'sponsorStatus', 'sponsorTier', 'sponsorContact'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = isReadOnly;
    });

    const modal = document.getElementById('sponsorshipModal');
    if (modal) {
        const header = modal.querySelector('.modal-header h2');
        const submitBtn = modal.querySelector('button[type="submit"]');
        if (header) header.textContent = isReadOnly ? 'View Sponsorship' : 'Edit Sponsorship';
        if (submitBtn) submitBtn.textContent = isReadOnly ? 'Close' : 'Save Changes';
        modal.style.display = 'flex';
    }
}

function setupSponsorshipForm() {
    const form = document.getElementById('sponsorshipForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!isAdminPage()) return;

        const mode = String(form.dataset.mode || '').toLowerCase();
        if (mode === 'view') {
            closeModal('sponsorshipModal');
            return;
        }

        const editId = form.dataset.editId;
        const editEmail = normalizeEmail(form.dataset.editEmail || '');
        const clientEmail = normalizeEmail(document.getElementById('sponsorClientEmail').value);
        if (!clientEmail) return;

        const next = {
            id: editId ? editId : ('sponsor_' + Date.now()),
            clientEmail,
            event: (document.getElementById('sponsorEvent').value || '').trim(),
            sponsor: (document.getElementById('sponsorName').value || '').trim(),
            amount: parseFloat(document.getElementById('sponsorAmount').value || '0') || 0,
            status: document.getElementById('sponsorStatus').value,
            tier: document.getElementById('sponsorTier').value,
            contact: (document.getElementById('sponsorContact').value || '').trim()
        };

        if (editId) {
            const sourceEmail = editEmail || clientEmail;
            const sourceList = getListForEmail(KEY_CLIENT_SPONSORSHIPS, sourceEmail);
            const sourceIdx = sourceList.findIndex(s => String(s.id) === String(editId));
            if (sourceIdx === -1) {
                alert('Sponsorship not found. Please refresh and try again.');
                closeModal('sponsorshipModal');
                return;
            }
            sourceList.splice(sourceIdx, 1);
            setListForEmail(KEY_CLIENT_SPONSORSHIPS, sourceEmail, sourceList);

            const targetList = getListForEmail(KEY_CLIENT_SPONSORSHIPS, clientEmail);
            const targetIdx = targetList.findIndex(s => String(s.id) === String(editId));
            if (targetIdx !== -1) targetList[targetIdx] = next;
            else targetList.push(next);
            setListForEmail(KEY_CLIENT_SPONSORSHIPS, clientEmail, targetList);
            maybeNotify('sponsorship_update', { clientEmail, event: next.event, sponsor: next.sponsor, status: next.status, amount: next.amount });
            alert('Sponsorship updated successfully!');
        } else {
            const list = getListForEmail(KEY_CLIENT_SPONSORSHIPS, clientEmail);
            list.push(next);
            setListForEmail(KEY_CLIENT_SPONSORSHIPS, clientEmail, list);
            maybeNotify('sponsorship_update', { clientEmail, event: next.event, sponsor: next.sponsor, status: next.status, amount: next.amount });
            alert('Sponsorship added successfully!');
        }

        closeModal('sponsorshipModal');
        renderSponsorshipsTable(loadDashboardData());
        form.reset();
        delete form.dataset.editId;
        delete form.dataset.editEmail;
        delete form.dataset.mode;
    });
}

function showAddCampaignModal() {
    if (!isAdminPage()) return;
    const form = document.getElementById('campaignForm');
    if (!form) return;
    form.reset();
    delete form.dataset.editId;
    delete form.dataset.editEmail;

    const modal = document.getElementById('campaignModal');
    if (modal) {
        const header = modal.querySelector('.modal-header h2');
        const submitBtn = modal.querySelector('button[type="submit"]');
        if (header) header.textContent = 'Create Campaign';
        if (submitBtn) submitBtn.textContent = 'Create Campaign';
        modal.style.display = 'flex';
    }
}

function editCampaign(id) {
    if (!isAdminPage()) return;
    const email = resolveEmailForItemId(KEY_CLIENT_CAMPAIGNS, id, arguments[1]);
    if (!email) {
        alert('Client email is missing. Please refresh and try again.');
        return;
    }
    const list = getListForEmail(KEY_CLIENT_CAMPAIGNS, email);
    const item = list.find(c => String(c.id) === String(id));
    if (!item) {
        alert('Campaign not found. Please refresh and try again.');
        return;
    }
    const form = document.getElementById('campaignForm');
    if (!form) return;
    form.dataset.editId = String(id);
    form.dataset.editEmail = email;

    document.getElementById('campaignClientEmail').value = item.clientEmail || email;
    document.getElementById('campaignEvent').value = item.event || '';
    document.getElementById('campaignPlatform').value = item.platform || '';
    document.getElementById('campaignStatus').value = item.status || 'pending';
    document.getElementById('campaignReach').value = item.reach || '';
    document.getElementById('campaignEngagement').value = item.engagement || '';

    const modal = document.getElementById('campaignModal');
    if (modal) {
        const header = modal.querySelector('.modal-header h2');
        const submitBtn = modal.querySelector('button[type="submit"]');
        if (header) header.textContent = 'Edit Campaign';
        if (submitBtn) submitBtn.textContent = 'Save Changes';
        modal.style.display = 'flex';
    }
}

function deleteCampaign(id) {
    if (!isAdminPage()) return;
    const email = resolveEmailForItemId(KEY_CLIENT_CAMPAIGNS, id, arguments[1]);
    if (!email) {
        alert('Client email is missing. Please refresh and try again.');
        return;
    }
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    const list = getListForEmail(KEY_CLIENT_CAMPAIGNS, email);
    setListForEmail(KEY_CLIENT_CAMPAIGNS, email, list.filter(c => String(c.id) !== String(id)));
    renderCampaignsTableForAdmin();
}

function setupCampaignForm() {
    const form = document.getElementById('campaignForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!isAdminPage()) return;

        const editId = form.dataset.editId;
        const editEmail = normalizeEmail(form.dataset.editEmail || '');
        const clientEmail = normalizeEmail(document.getElementById('campaignClientEmail').value);
        if (!clientEmail) return;

        const next = {
            id: editId ? editId : ('campaign_' + Date.now()),
            clientEmail,
            event: (document.getElementById('campaignEvent').value || '').trim(),
            platform: (document.getElementById('campaignPlatform').value || '').trim(),
            status: document.getElementById('campaignStatus').value,
            reach: parseFloat(document.getElementById('campaignReach').value || '0') || 0,
            engagement: parseFloat(document.getElementById('campaignEngagement').value || '0') || 0
        };

        if (editId) {
            const sourceEmail = editEmail || clientEmail;
            const sourceList = getListForEmail(KEY_CLIENT_CAMPAIGNS, sourceEmail);
            const sourceIdx = sourceList.findIndex(c => String(c.id) === String(editId));
            if (sourceIdx === -1) {
                alert('Campaign not found. Please refresh and try again.');
                closeModal('campaignModal');
                return;
            }
            sourceList.splice(sourceIdx, 1);
            setListForEmail(KEY_CLIENT_CAMPAIGNS, sourceEmail, sourceList);

            const targetList = getListForEmail(KEY_CLIENT_CAMPAIGNS, clientEmail);
            const targetIdx = targetList.findIndex(c => String(c.id) === String(editId));
            if (targetIdx !== -1) targetList[targetIdx] = next;
            else targetList.push(next);
            setListForEmail(KEY_CLIENT_CAMPAIGNS, clientEmail, targetList);
            alert('Campaign updated successfully!');
        } else {
            const list = getListForEmail(KEY_CLIENT_CAMPAIGNS, clientEmail);
            list.push(next);
            setListForEmail(KEY_CLIENT_CAMPAIGNS, clientEmail, list);
            alert('Campaign created successfully!');
        }

        closeModal('campaignModal');
        renderCampaignsTableForAdmin();
        form.reset();
        delete form.dataset.editId;
        delete form.dataset.editEmail;
    });
}

function getRevenueAnalytics(data) {
    const events = data && Array.isArray(data.events) ? data.events : [];
    const sponsorships = data && Array.isArray(data.sponsorships) ? data.sponsorships : [];

    const totalEventRevenue = events.reduce((sum, e) => sum + (parseFloat(e.revenue || '0') || 0), 0);
    const totalSponsorshipConfirmed = sponsorships
        .filter(s => String(s.status || '').toLowerCase() === 'confirmed')
        .reduce((sum, s) => sum + (parseFloat(s.amount || '0') || 0), 0);

    const monthKey = (dateStr) => {
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return null;
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        return `${y}-${String(m).padStart(2, '0')}`;
    };

    const byMonth = {};
    events.forEach(e => {
        const key = monthKey(e.date);
        if (!key) return;
        byMonth[key] = (byMonth[key] || 0) + (parseFloat(e.revenue || '0') || 0);
    });

    const sortedKeys = Object.keys(byMonth).sort();
    const lastKeys = sortedKeys.slice(-6);
    const monthly = lastKeys.map(k => {
        const [y, m] = k.split('-').map(Number);
        const label = new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-US', { month: 'short' });
        return { key: k, label, value: byMonth[k] || 0 };
    });

    const eventTypes = {};
    events.forEach(e => {
        const name = String(e.name || '');
        const type = name.toLowerCase().includes('corporate')
            ? 'Corporate'
            : name.toLowerCase().includes('university')
                ? 'University'
                : name.toLowerCase().includes('gala')
                    ? 'Institutional'
                    : 'Other';
        eventTypes[type] = (eventTypes[type] || 0) + 1;
    });

    const types = Object.keys(eventTypes).map(t => ({ type: t, count: eventTypes[t] })).sort((a, b) => b.count - a.count);

    return {
        totalEventRevenue,
        totalSponsorshipConfirmed,
        totalRevenue: totalEventRevenue,
        monthly,
        types
    };
}

function renderAdminAnalytics() {
    const monthlyEl = document.getElementById('monthlyRevenueChart');
    const typesEl = document.getElementById('eventTypesChart');
    const avgRevenueEl = document.getElementById('metricAvgRevenue');
    const avgAttendanceEl = document.getElementById('metricAvgAttendance');
    const sponsorshipEl = document.getElementById('metricSponsorshipRevenue');
    const eventSuccessEl = document.getElementById('metricEventSuccess');
    if (!monthlyEl && !typesEl && !avgRevenueEl) return;

    const data = loadDashboardData();
    const analytics = getRevenueAnalytics(data);

    const events = data && Array.isArray(data.events) ? data.events : [];
    const revenuePerEvent = events.length ? (analytics.totalEventRevenue / events.length) : 0;
    const avgAttendance = events.length
        ? (events.reduce((sum, e) => sum + (parseFloat(e.registrations || '0') || 0), 0) / events.length)
        : 0;
    const completed = events.filter(e => String(e.status || '').toLowerCase() === 'completed').length;
    const successRate = events.length ? Math.round((completed / events.length) * 100) : 0;

    if (avgRevenueEl) avgRevenueEl.textContent = formatCurrency(revenuePerEvent, 'INR');
    if (avgAttendanceEl) avgAttendanceEl.textContent = formatNumber(Math.round(avgAttendance));
    if (sponsorshipEl) sponsorshipEl.textContent = formatCurrency(analytics.totalSponsorshipConfirmed, 'INR');
    if (eventSuccessEl) eventSuccessEl.textContent = `${successRate}%`;

    if (monthlyEl) {
        const items = analytics.monthly;
        const max = Math.max(1, ...items.map(i => i.value));
        monthlyEl.innerHTML = `
            <div style="display: grid; gap: 0.5rem; width: 100%;">
                ${items.map(i => `
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="width: 42px; color: var(--text-secondary); font-size: 0.875rem;">${i.label}</div>
                        <div style="flex: 1; height: 12px; background: var(--bg-light); border-radius: 999px; overflow: hidden;">
                            <div style="height: 12px; width: ${Math.round((i.value / max) * 100)}%; background: var(--primary-color);"></div>
                        </div>
                        <div style="width: 140px; text-align: right; color: var(--text-primary); font-weight: 600; font-size: 0.875rem;">
                            ${formatCurrency(i.value, 'INR')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    if (typesEl) {
        const types = analytics.types;
        const total = Math.max(1, types.reduce((s, t) => s + t.count, 0));
        typesEl.innerHTML = `
            <div style="display: grid; gap: 0.75rem; width: 100%;">
                ${types.map(t => `
                    <div style="display: flex; justify-content: space-between; gap: 1rem;">
                        <div style="color: var(--text-primary); font-weight: 600;">${t.type}</div>
                        <div style="color: var(--text-secondary);">${formatNumber(t.count)} (${Math.round((t.count / total) * 100)}%)</div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

function setupAnalyticsExport() {
    const btn = document.getElementById('exportAnalyticsBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
        const data = loadDashboardData();
        const analytics = getRevenueAnalytics(data);
        const payload = {
            generatedAt: new Date().toISOString(),
            totals: {
                totalEventRevenue: analytics.totalEventRevenue,
                totalSponsorshipConfirmed: analytics.totalSponsorshipConfirmed,
                totalRevenue: analytics.totalRevenue
            },
            monthlyRevenue: analytics.monthly,
            eventTypes: analytics.types,
            events: data.events || [],
            sponsorships: data.sponsorships || []
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `apex-analytics-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    });
}

function setupAdminIndexActions() {
    if (!isAdminPage()) return;
    const fileNameRaw = (window.location.pathname || '').split('/').pop();
    const fileName = fileNameRaw ? String(fileNameRaw).toLowerCase() : 'index.html';
    if (fileName !== 'index.html') return;

    const headerActions = document.querySelector('.dashboard-header .dashboard-actions');
    if (headerActions) {
        const ensureBtn = (id, text, className) => {
            let btn = document.getElementById(id);
            if (btn) return btn;
            btn = document.createElement('button');
            btn.type = 'button';
            btn.id = id;
            btn.className = className;
            btn.textContent = text;
            headerActions.appendChild(btn);
            return btn;
        };

        ensureBtn('createEventBtn', 'Create Event', 'btn btn-primary');
        ensureBtn('addSponsorshipBtn', 'Add Sponsorship', 'btn btn-secondary');
        ensureBtn('createCampaignBtn', 'Add Campaign', 'btn btn-secondary');
        ensureBtn('quickActionsBtn', 'Quick Actions', 'btn btn-secondary');
    }

    const ensureQuickActionsModal = () => {
        let modal = document.getElementById('quickActionsModal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'quickActionsModal';
        modal.className = 'modal';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 520px;">
                <div class="modal-header">
                    <h2>Quick Actions</h2>
                    <span class="modal-close" data-quick-close>&times;</span>
                </div>
                <div class="modal-body">
                    <div style="display: grid; gap: 0.75rem;">
                        <button type="button" class="btn btn-primary" data-quick-href="events.html#newEvent">Create Event</button>
                        <button type="button" class="btn btn-secondary" data-quick-href="guests.html#newGuest">Add Guest</button>
                        <button type="button" class="btn btn-secondary" data-quick-href="sponsorships.html#newSponsorship">Add Sponsorship</button>
                        <button type="button" class="btn btn-secondary" data-quick-href="marketing.html#newCampaign">Add Campaign</button>
                        <button type="button" class="btn btn-secondary" data-quick-href="team-management.html">Assign Team Tasks</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    };

    const createBtn = document.getElementById('createEventBtn');
    if (createBtn && !createBtn.dataset.bound) {
        createBtn.dataset.bound = '1';
        createBtn.addEventListener('click', function () {
            window.location.href = 'events.html#newEvent';
        });
    }

    const sponsorshipBtn = document.getElementById('addSponsorshipBtn');
    if (sponsorshipBtn && !sponsorshipBtn.dataset.bound) {
        sponsorshipBtn.dataset.bound = '1';
        sponsorshipBtn.addEventListener('click', function () {
            window.location.href = 'sponsorships.html#newSponsorship';
        });
    }

    const campaignBtn = document.getElementById('createCampaignBtn');
    if (campaignBtn && !campaignBtn.dataset.bound) {
        campaignBtn.dataset.bound = '1';
        campaignBtn.addEventListener('click', function () {
            window.location.href = 'marketing.html#newCampaign';
        });
    }

    const quickBtn = document.getElementById('quickActionsBtn');
    if (quickBtn && !quickBtn.dataset.bound) {
        quickBtn.dataset.bound = '1';
        quickBtn.addEventListener('click', function () {
            ensureQuickActionsModal();
            openModal('quickActionsModal');
        });
    }

    const modal = ensureQuickActionsModal();
    if (modal) {
        if (!modal.dataset.bound) {
            modal.dataset.bound = '1';
            const close = modal.querySelector('[data-quick-close]');
            if (close) close.addEventListener('click', function () { closeModal('quickActionsModal'); });
            modal.addEventListener('click', function (e) {
                if (e.target === modal) closeModal('quickActionsModal');
            });

            modal.querySelectorAll('[data-quick-href]').forEach(el => {
                el.addEventListener('click', function () {
                    const href = this.getAttribute('data-quick-href');
                    if (href) window.location.href = href;
                });
            });
        }
    }
}

function filterTableRows(table, query) {
    if (!table) return;
    const q = String(query || '').trim().toLowerCase();
    const tbody = table.querySelector('tbody');
    const rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : Array.from(table.querySelectorAll('tr')).slice(1);
    rows.forEach(row => {
        const text = String(row.textContent || '').toLowerCase();
        row.style.display = !q || text.includes(q) ? '' : 'none';
    });
}

function csvEscape(value) {
    const raw = String(value == null ? '' : value);
    const needsQuotes = raw.includes(',') || raw.includes('"') || raw.includes('\n') || raw.includes('\r');
    const escaped = raw.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
}

function exportTableToCSV(table, filenamePrefix) {
    if (!table) return;
    const theadCells = Array.from(table.querySelectorAll('thead th'));
    const headers = theadCells.length ? theadCells.map(th => String(th.textContent || '').trim()) : [];

    const tbody = table.querySelector('tbody');
    const rows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
    const visibleRows = rows.filter(r => r.style.display !== 'none');

    const lines = [];
    if (headers.length) lines.push(headers.map(csvEscape).join(','));
    visibleRows.forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('td, th'));
        if (!cells.length) return;
        const values = cells.map(td => String(td.textContent || '').replace(/\s+/g, ' ').trim());
        lines.push(values.map(csvEscape).join(','));
    });

    const csv = lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${String(filenamePrefix || 'export')}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function setupTableHeaderActions() {
    const cards = document.querySelectorAll('.content-card');
    if (!cards.length) return;

    cards.forEach(card => {
        const header = card.querySelector('.content-card-header');
        const actions = header ? header.querySelector('.action-buttons') : null;
        const table = card.querySelector('table');
        if (!actions || !table) return;

        const search = actions.querySelector('input[type="text"]');
        if (search && !search.dataset.bound) {
            search.dataset.bound = '1';
            search.addEventListener('input', function () {
                filterTableRows(table, this.value);
            });
        }

        actions.querySelectorAll('button').forEach(btn => {
            if (btn.dataset.bound) return;
            const label = String(btn.textContent || '').trim().toLowerCase();
            if (label === 'filter') {
                btn.dataset.bound = '1';
                btn.addEventListener('click', function () {
                    let q = search ? String(search.value || '').trim() : '';
                    if (!q) {
                        const next = prompt('Enter filter text');
                        if (next === null) return;
                        q = String(next || '').trim();
                        if (search) search.value = q;
                    }
                    filterTableRows(table, q);
                    if (search) search.focus();
                });
                return;
            }
            if (label === 'export') {
                btn.dataset.bound = '1';
                btn.addEventListener('click', function () {
                    const id = table.getAttribute('id') || 'table';
                    exportTableToCSV(table, id);
                });
            }
        });
    });
}

function parseCSV(text) {
    const out = [];
    let row = [];
    let cur = '';
    let inQuotes = false;
    const s = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        const next = s[i + 1];
        if (inQuotes) {
            if (ch === '"' && next === '"') {
                cur += '"';
                i++;
                continue;
            }
            if (ch === '"') {
                inQuotes = false;
                continue;
            }
            cur += ch;
            continue;
        }
        if (ch === '"') {
            inQuotes = true;
            continue;
        }
        if (ch === ',') {
            row.push(cur);
            cur = '';
            continue;
        }
        if (ch === '\n') {
            row.push(cur);
            cur = '';
            const hasAny = row.some(c => String(c || '').trim() !== '');
            if (hasAny) out.push(row);
            row = [];
            continue;
        }
        cur += ch;
    }
    row.push(cur);
    const hasAny = row.some(c => String(c || '').trim() !== '');
    if (hasAny) out.push(row);
    return out;
}

function setupGuestCsvImport() {
    if (!isAdminPage()) return;
    if (!document.getElementById('guestsTable')) return;
    const buttons = Array.from(document.querySelectorAll('.dashboard-actions button'));
    const importBtn = buttons.find(b => String(b.textContent || '').trim().toLowerCase() === 'import csv');
    if (!importBtn || importBtn.dataset.bound) return;
    importBtn.dataset.bound = '1';

    importBtn.addEventListener('click', function () {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,text/csv';
        input.style.display = 'none';
        document.body.appendChild(input);

        input.addEventListener('change', async function () {
            try {
                const file = input.files && input.files[0];
                if (!file) return;
                const text = await file.text();
                const rows = parseCSV(text);
                if (!rows.length) {
                    alert('No rows found in CSV.');
                    return;
                }

                const head = rows[0].map(v => String(v || '').trim().toLowerCase());
                const hasHeader = head.some(h => ['client', 'clientemail', 'client email', 'name', 'email', 'event'].includes(h));
                const start = hasHeader ? 1 : 0;

                const idx = (names) => head.findIndex(h => names.includes(h));
                const headerIdx = {
                    clientEmail: idx(['client', 'clientemail', 'client email']),
                    name: idx(['name', 'guest', 'guestname', 'guest name']),
                    email: idx(['email', 'guestemail', 'guest email']),
                    event: idx(['event', 'eventname', 'event name']),
                    status: idx(['status']),
                    type: idx(['type']),
                    checkIn: idx(['check-in', 'checkin', 'check in'])
                };

                let defaultClientEmail = '';
                const map = getEmailMap(KEY_CLIENT_GUESTS);
                let added = 0;

                for (let i = start; i < rows.length; i++) {
                    const r = rows[i] || [];
                    const get = (k) => {
                        const j = headerIdx[k];
                        if (j >= 0) return r[j];
                        return '';
                    };

                    let clientEmail = '';
                    let name = '';
                    let email = '';
                    let event = '';
                    let statusRaw = '';
                    let type = '';
                    let checkIn = '';

                    if (hasHeader) {
                        clientEmail = normalizeEmail(get('clientEmail'));
                        name = String(get('name') || '').trim();
                        email = String(get('email') || '').trim();
                        event = String(get('event') || '').trim();
                        statusRaw = String(get('status') || '').trim().toLowerCase();
                        type = String(get('type') || '').trim();
                        checkIn = String(get('checkIn') || '').trim();
                    } else {
                        const cols = r.map(v => String(v == null ? '' : v).trim());
                        clientEmail = normalizeEmail(cols[0] || '');
                        name = String(cols[1] || '').trim();
                        email = String(cols[2] || '').trim();
                        event = String(cols[3] || '').trim();
                        statusRaw = String(cols[4] || '').trim().toLowerCase();
                        type = String(cols[5] || '').trim();
                        checkIn = String(cols[6] || '').trim();
                    }

                    if (!type) type = 'Standard';

                    if (!clientEmail) {
                        if (!defaultClientEmail) {
                            const next = prompt('Enter client email for imported guests (CSV missing client column)');
                            if (next === null) return;
                            defaultClientEmail = normalizeEmail(next);
                        }
                        clientEmail = defaultClientEmail;
                    }
                    if (!clientEmail || !name || !email || !event) continue;

                    const normalizedStatus = statusRaw === 'confirmed' || statusRaw === 'cancelled' || statusRaw === 'pending'
                        ? statusRaw
                        : 'pending';

                    const item = {
                        id: `guest_${Date.now()}_${added}`,
                        clientEmail,
                        name,
                        email,
                        event,
                        status: normalizedStatus,
                        type,
                        checkIn
                    };

                    if (!Array.isArray(map[clientEmail])) map[clientEmail] = [];
                    map[clientEmail].push(item);
                    added++;
                }

                setEmailMap(KEY_CLIENT_GUESTS, map);
                renderGuestsTable(loadDashboardData());
                alert(`Imported ${added} guest(s).`);
            } finally {
                input.remove();
            }
        });

        input.click();
    });
}

function openModalFromHash() {
    const hash = (window.location.hash || '').toLowerCase();
    if (!hash) return;
    if (hash === '#newevent') showAddEventModal();
    if (hash === '#newguest') showAddGuestModal();
    if (hash === '#newsponsorship') showAddSponsorshipModal();
    if (hash === '#newcampaign') showAddCampaignModal();
    if (hash === '#newuser') showAddUserModal();
}

// Initialize dashboard
function initDashboard() {
    applyAdminSettingsToPage();
    setupMobileSidebarToggle();
    const data = loadDashboardData();
    
    // Render all components
    renderStatsCards(data);
    renderEventsTable(data);
    renderGuestsTable(data);
    
    // Admin-only components
    if (isAdminPage()) {
        renderUsersTable(data);
        renderSponsorshipsTable(data);
    } else {
        renderSponsorshipsTable(data);
    }
    
    // Set active sidebar menu item
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
    sidebarLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        if (linkPath === currentPage || 
            (currentPage === 'index.html' && linkPath.includes('dashboard'))) {
            link.classList.add('active');
        }
    });

    initProfileForm();
    renderMarketingTableForClient();
    renderCampaignsTableForAdmin();
    injectBuyPlanButton();
    renderPlanChecklist();
    renderAdminAnalytics();
    setupAnalyticsExport();
    setupAdminIndexActions();

    setupEventForm();
    setupGuestForm();
    setupSponsorshipForm();
    setupCampaignForm();
    setupUserForm();
    setupUsersPageActions();
    setupAdminSettingsPage();
    setupTableHeaderActions();
    setupGuestCsvImport();
    // setupBookTeamMember(); // Removed as it is not defined
    openModalFromHash();
}





// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    const path = (window.location.pathname || '').toLowerCase();
    if (path.includes('dashboard') || path.includes('user') || path.includes('admin')) {
        initDashboard();
    }
});

