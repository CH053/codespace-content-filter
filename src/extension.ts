import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
    // 1. נתיבי מקור (בתוך התוסף המותקן)
    const mediaPath = path.join(context.extensionPath, 'media');
    const sourceImg = path.join(mediaPath, 'placeholder.png');
    const sourceVid = path.join(mediaPath, 'placeholder.mp4');

    // 2. נתיבי יעד (בתיקייה יציבה בשרת)
    const storageDir = context.globalStorageUri.fsPath;
    const filterScriptPath = path.join(storageDir, 'filter.js');
    const targetImg = path.join(storageDir, 'placeholder.png');
    const targetVid = path.join(storageDir, 'placeholder.mp4');

    // יצירת תיקיית האחסון אם לא קיימת
    if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
    }

    // העתקת קבצי המדיה מהתוסף לתיקיית האחסון הציבורית של השרת
    try {
        if (fs.existsSync(sourceImg)) fs.copyFileSync(sourceImg, targetImg);
        if (fs.existsSync(sourceVid)) fs.copyFileSync(sourceVid, targetVid);
    } catch (err) {
        console.error("Failed to copy assets", err);
    }

    // 3. יצירת סקריפט ה-filter.js הדינמי
    const filterCode = `
const fs = require('fs');
const REAL_IMG = '${targetImg.replace(/\\/g, '/')}';
const REAL_VID = '${targetVid.replace(/\\/g, '/')}';

const isImg = (p) => typeof p === 'string' && p.match(/\\.(png|jpg|jpeg|gif|webp|svg)$/i) && p.includes('/workspaces/');
const isVid = (p) => typeof p === 'string' && p.match(/\\.(mp4|mov|webm|avi|mkv|m4v)$/i) && p.includes('/workspaces/');

const getTarget = (p) => isImg(p) ? REAL_IMG : (isVid(p) ? REAL_VID : p);

const originalFs = { 
    open: fs.open, openSync: fs.openSync, 
    stat: fs.stat, lstat: fs.lstat,
    access: fs.access,
    promises: { open: fs.promises?.open, stat: fs.promises?.stat } 
};

fs.open = function(path, ...args) { return originalFs.open.call(fs, getTarget(path), ...args); };
fs.openSync = function(path, ...args) { return originalFs.openSync.call(fs, getTarget(path), ...args); };
fs.stat = function(path, ...args) { return originalFs.stat.call(fs, getTarget(path), ...args); };
fs.lstat = function(path, ...args) { return originalFs.lstat.call(fs, getTarget(path), ...args); };
fs.access = function(path, ...args) { return originalFs.access.call(fs, getTarget(path), ...args); };

if (fs.promises && fs.promises.open) {
    fs.promises.open = function(path, ...args) { return originalFs.promises.open.call(fs.promises, getTarget(path), ...args); };
    fs.promises.stat = function(path, ...args) { return originalFs.promises.stat.call(fs.promises, getTarget(path), ...args); };
}
    `;
    fs.writeFileSync(filterScriptPath, filterCode);

    // 4. בדיקת אכיפה
    const isRunning = process.env.NODE_OPTIONS && process.env.NODE_OPTIONS.includes(filterScriptPath);

    if (!isRunning) {
        showEnforcementDialog(filterScriptPath);
    }
}

async function showEnforcementDialog(scriptPath: string) {
    const selection = await vscode.window.showInformationMessage(
        "מדיניות אבטחה: יש להפעיל את סינון המדיה כדי להשתמש בסביבה זו.",
        { modal: true },
        "התקן והפעל מחדש"
    );

    if (selection === "התקן והפעל מחדש") {
        const config = vscode.workspace.getConfiguration();
        // עדכון הגדרות NODE_OPTIONS למשתמש
        await config.update('terminal.integrated.env.linux', {
            "NODE_OPTIONS": `--require ${scriptPath}`
        }, vscode.ConfigurationTarget.Global);

        // אתחול השרת
        exec('pkill -f node');
        setTimeout(() => {
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        }, 1000);
    } else {
        // אם סגר את החלון - פתח שוב
        showEnforcementDialog(scriptPath);
    }
}

export function deactivate() {}