const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');

// Folders to copy
const foldersToCopy = [
    'assets',
    'css',
    'dashboard',
    'js'
];

// Files to copy (glob patterns or explicit list)
const filesToCopy = [
    'about.html',
    'collaborations.html',
    'contact.html',
    'gallery.html',
    'index.html',
    'process.html',
    'services.html',
    'team.html',
    'manifest.json',
    'sw.js',
    'favicon.ico' // if exists
];

function copyFile(src, dest) {
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`Copied file: ${src} -> ${dest}`);
    } else {
        console.warn(`Warning: File not found: ${src}`);
    }
}

function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
    console.log(`Copied directory: ${src} -> ${dest}`);
}

// Main execution
try {
    // Clean dist
    if (fs.existsSync(distDir)) {
        fs.rmSync(distDir, { recursive: true, force: true });
        console.log('Cleaned dist directory');
    }
    fs.mkdirSync(distDir);
    
    // Copy folders
    for (const folder of foldersToCopy) {
        copyDir(path.join(__dirname, folder), path.join(distDir, folder));
    }
    
    // Copy files
    for (const file of filesToCopy) {
        copyFile(path.join(__dirname, file), path.join(distDir, file));
    }
    
    console.log('Build completed successfully!');
} catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
}
