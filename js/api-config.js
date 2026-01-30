// Global Configuration for The Apex Circle
// This file is loaded before other scripts to provide shared settings.

const APEX_CONFIG = {
    // Backend API URL (Render)
    // When set, all devices will attempt to connect here first.
    // Format: "https://your-app.onrender.com/api"
    API_BASE_URL: "https://apex-circle-backend.onrender.com/api",

    // Helper to get the effective API URL
    getApiUrl: function() {
        // 1. Check for global config (hardcoded) - Prioritize Production URL if set
        if (this.API_BASE_URL) return this.API_BASE_URL.replace(/\/+$/, '');

        // 2. Localhost & Private Network (LAN)
        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1' || !host || host.startsWith('192.168.') || host.startsWith('10.') || host.startsWith('172.')) {
            // Assume the node server is running on 8002 on the same host
            const serverHost = host || 'localhost';
            return `http://${serverHost}:8002/api`;
        }

        // 4. Fallback to Netlify Functions (default)
        return '/.netlify/functions';
    }
};

// Export to window for global access
window.APEX_CONFIG = APEX_CONFIG;
