/* ============================================
   The Apex Circle - Authentication System
   Demo JS-based Authentication
   ============================================ */

// Demo User Credentials
const demoUsers = {
    admin: {
        username: "theapexcirclestarexuniversity@gmail.com",
        password: "admin123",
        name: "The Apex Circle",
        role: "admin",
        profilePhoto: "../../assets/images/apex-circle-logo.png"
    },
    // Team Members
    teamMembers: {
        "divyansh.gupta@apexcircle.com": {
            username: "divyansh.gupta@apexcircle.com",
            password: "divyansh2025",
            name: "Mr. Divyansh Gupta",
            role: "team",
            position: "Team Leader",
            id: "tm001",
            phone: "",
            profilePhoto: "../../assets/images/team-divyansh-gupta.jpeg"
        },
        "anurag.sangar@apexcircle.com": {
            username: "anurag.sangar@apexcircle.com",
            password: "anurag2025",
            name: "Anurag Sangar",
            role: "team",
            position: "Registration Management",
            id: "tm002",
            phone: "",
            profilePhoto: "../../assets/images/team-anurag-sangar.jpeg"
        },
        "palak@apexcircle.com": {
            username: "palak@apexcircle.com",
            password: "palak2025",
            name: "Miss Palak",
            role: "team",
            position: "Guest Management",
            id: "tm003",
            phone: "",
            profilePhoto: "../../assets/images/team-palak.jpeg"
        },
        "aman.yadav@apexcircle.com": {
            username: "aman.yadav@apexcircle.com",
            password: "aman2025",
            name: "Aman Yadav",
            role: "team",
            position: "Social Media & PR",
            id: "tm004",
            phone: "",
            profilePhoto: "../../assets/images/team-aman-yadav.jpeg"
        },
        "aarti.yadav@apexcircle.com": {
            username: "aarti.yadav@apexcircle.com",
            password: "aarti2025",
            name: "Aarti Yadav",
            role: "team",
            position: "Host & Anchor",
            id: "tm005",
            phone: "",
            profilePhoto: "../../assets/images/team-aarti-yadav.jpeg"
        },
        "prince.jangra@apexcircle.com": {
            username: "prince.jangra@apexcircle.com",
            password: "prince2025",
            name: "Prince Jangra",
            role: "team",
            position: "Event Coordinator",
            id: "tm006",
            phone: "+919992515619",
            profilePhoto: "../../assets/images/team-prince-jangra.jpeg"
        },
        "naman.singh@apexcircle.com": {
            username: "naman.singh@apexcircle.com",
            password: "naman2025",
            name: "Naman Singh",
            role: "team",
            position: "Social Media & PR",
            id: "tm007",
            phone: "+9178335091207",
            profilePhoto: "../../assets/images/team-naman-singh.jpeg"
        },
        "drishti.pathak@apexcircle.com": {
            username: "drishti.pathak@apexcircle.com",
            password: "drishti2025",
            name: "Drishti Pathak",
            role: "team",
            position: "Creative Team Head",
            id: "tm008",
            phone: "",
            profilePhoto: "../../assets/images/team-drishti-pathak.jpeg"
        },
        "deepti@apexcircle.com": {
            username: "deepti@apexcircle.com",
            password: "deepti2025",
            name: "Deepti",
            role: "team",
            position: "Stage Coordinator",
            id: "tm009",
            phone: "+919958546372",
            profilePhoto: "../../assets/images/team-deepti.jpeg"
        }
    },
    // Clients
    clients: {
        "divyanshgupta.4567@gmail.com": {
            username: "divyanshgupta.4567@gmail.com",
            password: "client2025",
            name: "Divyansh Gupta",
            role: "client",
            company: "Client Company"
        }
    }
};

// Check if user is logged in
function isAuthenticated() {
    const user = sessionStorage.getItem('apex_user');
    return user !== null;
}

// Get current user
function getCurrentUser() {
    const user = sessionStorage.getItem('apex_user');
    return user ? JSON.parse(user) : null;
}

// Helper to get user-scoped storage key
function getUserStorageKey(key) {
    const user = getCurrentUser();
    const id = user && user.id ? String(user.id).trim() : 'unknown';
    return `${key}_${id}`;
}

function normalizeUsername(username) {
    return (username || '').trim().toLowerCase();
}

function safeParseJSON(value) {
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch (e) {
        return null;
    }
}

const KEY_ADMIN_SETTINGS = 'apex_admin_settings';
const KEY_ADMIN_2FA_VERIFIED_AT = 'apex_admin_2fa_verified_at';
const ADMIN_2FA_DEMO_CODE = '123456';

function getAdminSecuritySettings() {
    // Admin settings are now fetched remotely or default
    // We can't use synchronous localStorage here if we want to be fully remote.
    // For now, return defaults or use sessionStorage if cached.
    const parsed = safeParseJSON(sessionStorage.getItem(KEY_ADMIN_SETTINGS));
    const stored = parsed && typeof parsed === 'object' ? parsed : {};
    const security = stored.security && typeof stored.security === 'object' ? stored.security : {};
    const minutesRaw = Number(security.sessionTimeoutMinutes);
    // Allow up to 24 hours (1440 minutes) for "live" dashboard usage
    const minutes = Number.isFinite(minutesRaw) ? Math.max(5, Math.min(1440, minutesRaw)) : 1440;
    const requireAdmin2fa = Boolean(security.requireAdmin2fa);
    return { sessionTimeoutMinutes: minutes, requireAdmin2fa };
}

function setSessionStartNow() {
    sessionStorage.setItem('apex_session_started_at', String(Date.now()));
}

function getSessionStart() {
    const raw = sessionStorage.getItem('apex_session_started_at');
    const ms = raw ? Number(raw) : NaN;
    return Number.isFinite(ms) ? ms : null;
}

function clearSessionStorage() {
    sessionStorage.removeItem('apex_user');
    sessionStorage.removeItem('apex_session_started_at');
    sessionStorage.removeItem(KEY_ADMIN_2FA_VERIFIED_AT);
}

function setAdmin2faVerifiedNow() {
    sessionStorage.setItem(KEY_ADMIN_2FA_VERIFIED_AT, String(Date.now()));
}

function isAdmin2faVerified() {
    const raw = sessionStorage.getItem(KEY_ADMIN_2FA_VERIFIED_AT);
    const verifiedAt = raw ? Number(raw) : NaN;
    if (!Number.isFinite(verifiedAt)) return false;
    const startedAt = getSessionStart();
    if (startedAt && verifiedAt < startedAt) return false;
    return true;
}

function initAdmin2faLoginUi() {
    const path = (window.location.pathname || '').toLowerCase();
    if (!path.includes('/dashboard/admin/login.html')) return;

    const group = document.getElementById('admin2faGroup');
    const input = document.getElementById('admin2faCode');
    if (!group || !input) return;

    const { requireAdmin2fa } = getAdminSecuritySettings();
    group.style.display = requireAdmin2fa ? '' : 'none';
    input.required = Boolean(requireAdmin2fa);
    if (!requireAdmin2fa) input.value = '';
}

function getCustomUsers() {
    const raw = sessionStorage.getItem('apex_custom_users');
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
        return {};
    }
}

// Login function
async function login(username, password, userType) {
    const normalizedUsername = normalizeUsername(username);

    // Check team members first if userType is team or not specified
    if (!userType || userType === 'team') {
        const teamMember = demoUsers.teamMembers[normalizedUsername];
        if (teamMember && teamMember.password === password) {
            const userData = {
                username: teamMember.username,
                name: teamMember.name,
                role: teamMember.role,
                position: teamMember.position,
                id: teamMember.id,
                phone: teamMember.phone || "",
                profilePhoto: teamMember.profilePhoto || null
            };
            sessionStorage.setItem('apex_user', JSON.stringify(userData));
            setSessionStartNow();
            return { success: true, user: userData };
        }
    }

    if (userType === 'user' || userType === 'client') {
        // Check hardcoded clients
        if (demoUsers.clients && demoUsers.clients[normalizedUsername]) {
            const client = demoUsers.clients[normalizedUsername];
            if (client.password === password) {
                const userData = {
                    username: client.username,
                    name: client.name,
                    role: client.role,
                    company: client.company || null,
                    loginMethod: 'local'
                };
                sessionStorage.setItem('apex_user', JSON.stringify(userData));
                setSessionStartNow();
                return { success: true, user: userData };
            }
        }

        const customUsers = await getCustomUsers();
        const customUser = customUsers[normalizedUsername];
        if (customUser && customUser.password === password) {
            const userData = {
                username: customUser.username,
                name: customUser.name,
                role: customUser.role || 'client',
                company: customUser.company || null,
                loginMethod: 'local'
            };
            sessionStorage.setItem('apex_user', JSON.stringify(userData));
            setSessionStartNow();
            return { success: true, user: userData };
        }
    }
    
    // Check regular users (admin, client)
    const user = demoUsers[userType];
    if (user && normalizeUsername(user.username) === normalizedUsername && user.password === password) {
        const userData = {
            username: user.username,
            name: user.name,
            role: user.role,
            company: user.company || null
        };
        sessionStorage.setItem('apex_user', JSON.stringify(userData));
        setSessionStartNow();
        return { success: true, user: userData };
    }
    
    return { success: false, message: "Invalid credentials" };
}

// Logout function
function logout() {
    sessionStorage.removeItem('apex_user');
    sessionStorage.removeItem('apex_session_started_at');
    sessionStorage.removeItem(KEY_ADMIN_2FA_VERIFIED_AT);
    const path = (window.location.pathname || '').toLowerCase();

    // Redirect to the login page of the current portal
    if (path.includes('/dashboard/admin/')) {
        window.location.href = 'login.html';
    } else if (path.includes('/dashboard/team/')) {
        window.location.href = 'login.html';
    } else if (path.includes('/dashboard/user/')) {
        window.location.href = 'login.html';
    } else if (path.includes('/dashboard/')) {
        window.location.href = 'login.html';
    } else {
        window.location.href = 'index.html';
    }
}

// Check authentication and redirect if needed
function requireAuth(requiredRole = null) {
    const user = getCurrentUser();
    
    if (!user) {
        // Redirect to login page
        window.location.href = 'login.html';
        return false;
    }

    const { sessionTimeoutMinutes, requireAdmin2fa } = getAdminSecuritySettings();
    const startedAt = getSessionStart();
    if (startedAt) {
        const maxAgeMs = sessionTimeoutMinutes * 60 * 1000;
        if ((Date.now() - startedAt) > maxAgeMs) {
            logout();
            return false;
        }
    } else {
        setSessionStartNow();
    }

    if (user.role === 'admin' && requireAdmin2fa && !isAdmin2faVerified()) {
        clearSessionStorage();
        window.location.href = 'login.html';
        return false;
    }
    
    const allowedRoles = Array.isArray(requiredRole) ? requiredRole : (requiredRole ? [requiredRole] : null);
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirect to appropriate dashboard using relative paths
        // Assumes we are in dashboard/{role}/...
        if (user.role === 'admin') {
            window.location.href = '../admin/';
        } else if (user.role === 'team') {
            window.location.href = '../team/';
        } else {
            window.location.href = '../user/';
        }
        return false;
    }
    
    return true;
}

// Initialize authentication check on dashboard pages
function initAuth() {
    const currentPath = (window.location.pathname || '').toLowerCase();
    
    // Skip auth check on login pages
    if (currentPath.includes('login.html') || currentPath.endsWith('/login')) {
        // If already logged in, check if we need to redirect
        if (isAuthenticated()) {
            const user = getCurrentUser();
            const { requireAdmin2fa } = getAdminSecuritySettings();

            // Only redirect if we are in the matching portal
            if (currentPath.includes('/admin/') && user.role === 'admin') {
                if (requireAdmin2fa && !isAdmin2faVerified()) {
                    initAdmin2faLoginUi();
                    return;
                }
                window.location.href = './';
                return;
            }
            
            if (currentPath.includes('/team/') && user.role === 'team') {
                window.location.href = './';
                return;
            }
            
            if (currentPath.includes('/user/') && (user.role === 'client' || user.role === 'user')) {
                const selectedPlan = sessionStorage.getItem('apex_selected_plan');
                window.location.href = selectedPlan ? './' : 'plans';
                return;
            }

            // If on main dashboard login
            if (currentPath.endsWith('/dashboard/login.html') || currentPath.endsWith('/dashboard/login')) {
                if (user.role === 'admin') window.location.href = 'admin/';
                else if (user.role === 'team') window.location.href = 'team/';
                else window.location.href = 'user/';
            }
        }
        return;
    }
    
    // Require authentication for dashboard pages
    if (currentPath.includes('dashboard') || currentPath.includes('user') || currentPath.includes('admin') || currentPath.includes('team')) {
        const requiredRole = currentPath.includes('/dashboard/admin/')
            ? 'admin'
            : currentPath.includes('/dashboard/team/')
                ? 'team'
                : currentPath.includes('/dashboard/user/')
                    ? ['client', 'user']
                    : null;
        requireAuth(requiredRole);
    }
}

// Handle login form submission
async function handleLogin(event) {
    if (event) event.preventDefault();
    console.log('handleLogin triggered');
    
    const usernameEl = document.getElementById('username');
    const passwordEl = document.getElementById('password');
    
    if (!usernameEl || !passwordEl) {
        console.error('Login fields missing');
        return;
    }

    const username = usernameEl.value;
    const password = passwordEl.value;
    const userTypeEl = document.getElementById('userType');
    const currentPath = (window.location.pathname || '').toLowerCase();
    
    let userType = (userTypeEl && userTypeEl.value);
    if (!userType) {
        if (currentPath.includes('admin')) userType = 'admin';
        else if (currentPath.includes('team')) userType = 'team';
        else userType = 'user';
    }
    
    console.log('Attempting login:', { username, userType });
    const result = await login(username, password, userType);
    console.log('Login result:', result);
    
    if (result.success) {
        if (result.user.role === 'admin') {
            const { requireAdmin2fa } = getAdminSecuritySettings();
            if (requireAdmin2fa) {
                const codeEl = document.getElementById('admin2faCode');
                const code = ((codeEl && codeEl.value) || '').trim();
                if (code !== ADMIN_2FA_DEMO_CODE) {
                    clearSessionStorage();
                    const errorDiv = document.getElementById('loginError');
                    if (errorDiv) {
                        errorDiv.textContent = 'Invalid 2FA code.';
                        errorDiv.classList.remove('hidden');
                    }
                    return;
                }
                setAdmin2faVerifiedNow();
            } else {
                sessionStorage.removeItem(KEY_ADMIN_2FA_VERIFIED_AT);
            }
        }

        // Redirect to appropriate dashboard
        console.log('Redirecting user...');
        if (result.user.role === 'admin') {
            // Use directory path for clean URL (no index.html)
            window.location.href = '/dashboard/admin/';
        } else if (result.user.role === 'team') {
            // Use directory path for clean URL (no index.html)
            window.location.href = '/dashboard/team/';
        } else {
            // Check if client has selected a plan
            const selectedPlan = sessionStorage.getItem('apex_selected_plan');
            const target = selectedPlan ? '' : 'plans';
            
            // Use directory path for index, explicit path for other pages
            window.location.href = '/dashboard/user/' + target;
        }
    } else {
        // Show error message
        const errorDiv = document.getElementById('loginError');
        if (errorDiv) {
            errorDiv.textContent = result.message;
            errorDiv.classList.remove('hidden');
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initAuth();
    initAdmin2faLoginUi();
    
    // Attach login handler if login form exists
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Attach logout handler if logout button exists
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
    
    // Display user info if on dashboard
    let user = getCurrentUser();
    
    // Force update admin details from config to ensure latest branding
    if (user && user.role === 'admin' && demoUsers.admin) {
        // Update local object
        user.name = demoUsers.admin.name;
        user.profilePhoto = demoUsers.admin.profilePhoto;
        
        // Update storage to persist changes
        try {
            const storedUser = JSON.parse(sessionStorage.getItem('apex_user'));
            if (storedUser) {
                storedUser.name = demoUsers.admin.name;
                storedUser.profilePhoto = demoUsers.admin.profilePhoto;
                sessionStorage.setItem('apex_user', JSON.stringify(storedUser));
            }
        } catch (e) {
            console.error('Failed to update admin user storage', e);
        }
    }

    if (user && !window.location.pathname.includes('login.html')) {
        const nameText = String(user.name || user.username || '').trim();
        const roleText = user.role === 'admin'
            ? 'Administrator'
            : user.role === 'team'
                ? String(user.position || 'Team Member')
                : String(user.company || 'Client');

        const photoSrc = String(user.profilePhoto || user.picture || '').trim();
        document.querySelectorAll('.sidebar-user').forEach(container => {
            if (!container) return;
            if (container.querySelector('.sidebar-user-photo')) return;
            const img = document.createElement('img');
            img.className = 'sidebar-user-photo';
            img.alt = 'Profile photo';
            img.style.display = 'none';
            container.insertBefore(img, container.firstChild);
        });

        const userNameElements = document.querySelectorAll('.user-name, .sidebar-user-name');
        userNameElements.forEach(el => {
            if (el && nameText) el.textContent = nameText;
        });
        
        const userRoleElements = document.querySelectorAll('.user-role, .sidebar-user-role');
        userRoleElements.forEach(el => {
            if (el && roleText) el.textContent = roleText;
        });

        const userPhotoElements = document.querySelectorAll('.sidebar-user-photo');
        userPhotoElements.forEach(el => {
            if (!el) return;
            // Add admin logo class if current user is admin
            if (user.role === 'admin') {
                el.classList.add('admin-avatar-logo');
            }
            if (!photoSrc) {
                el.style.display = 'none';
                return;
            }
            el.src = photoSrc;
            el.style.display = '';
            el.onerror = function () {
                el.style.display = 'none';
            };
        });

        const teamNameEl = document.getElementById('teamMemberName');
        if (teamNameEl && nameText) teamNameEl.textContent = nameText;
        const teamPositionEl = document.getElementById('teamMemberPosition');
        if (teamPositionEl) teamPositionEl.textContent = String(user.position || 'Team Member');
        const teamPhotoEl = document.getElementById('teamMemberPhoto');
        if (teamPhotoEl) {
            if (photoSrc) {
                teamPhotoEl.src = photoSrc;
                teamPhotoEl.style.display = '';
                teamPhotoEl.onerror = function () {
                    teamPhotoEl.style.display = 'none';
                };
            } else {
                teamPhotoEl.style.display = 'none';
            }
        }
    }
});
