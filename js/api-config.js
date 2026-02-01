// Global Configuration for The Apex Circle
// This file is loaded before other scripts to provide shared settings.

const APEX_CONFIG = {
    // Backend API URL (Render)
    // When set, all devices will attempt to connect here first.
    // Format: "https://your-app.onrender.com/api"
    API_BASE_URL: "https://apex-circle-backend.onrender.com/api",

    // Helper to get the effective API URL
    getApiUrl: function() {
        // 1. Check for localStorage override (Sync Settings)
        if (typeof sessionStorage !== 'undefined') {
             const override = sessionStorage.getItem('apex_api_base');
             if (override) return override;
        }

        const host = window.location.hostname;
        
        // 2. If running on Localhost (Dev Mode) -> USE LOCAL SERVER
        // The Cloud Backend (Render) is currently unstable/unreachable.
        // We prioritize the Local Server which connects to the same Global Database (Neon).
        if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) {
            // If served by the node server itself (port 8002), use relative path
            if (window.location.port === '8002') return '/api';
            
            // If served by Live Server, point to the running Local API Server
            return 'http://localhost:8002/api';
        }

        // 3. If running on Render (Production), use relative path
        if (host.includes('onrender.com')) {
            return '/api';
        }

        // 4. Fallback
        if (this.API_BASE_URL) return this.API_BASE_URL.replace(/\/+$/, '');
        return '/api';
    }
};

// Export to window for global access
window.APEX_CONFIG = APEX_CONFIG;
