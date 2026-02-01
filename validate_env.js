const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    console.log('.env file not found');
    process.exit(1);
}

const content = fs.readFileSync(envPath, 'utf8');
const lines = content.split('\n');
let hasDbUrl = false;
let dbUrlLine = '';

lines.forEach(line => {
    if (line.startsWith('DATABASE_URL=')) {
        hasDbUrl = true;
        dbUrlLine = line;
    } else if (line.startsWith('NEON_DB_URL=')) {
        hasDbUrl = true;
        dbUrlLine = line;
    }
});

if (hasDbUrl) {
    console.log('DATABASE_URL found.');
    // Check for common issues without revealing secrets
    const url = dbUrlLine.split('=')[1].trim();
    if (url.includes(' ')) console.log('Warning: URL contains spaces');
    if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) console.log('Warning: URL does not start with postgres://');
    if (url.includes('neondb_owner') && !url.includes(':')) console.log('Warning: URL might be missing password (no colon after user)');
    console.log('URL length:', url.length);
} else {
    console.log('DATABASE_URL not found in .env');
}
