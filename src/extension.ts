import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const debugLog = vscode.window.createOutputChannel("Media Filter System");

export function activate(context: vscode.ExtensionContext) {
    if (vscode.env.remoteName !== 'codespaces') return;

    debugLog.show(true);
    debugLog.appendLine("--- System Integrity Check ---");

    const storageFolder = '/tmp/.vscode-media-filter';
    const filterJs = path.join(storageFolder, 'filter.js');
    
    prepareAssets(context, storageFolder, filterJs);

    const currentNodePath = process.execPath;
    const realNodePath = `${currentNodePath}.real`;
    
    // זיהוי אם אנחנו כבר במצב מוגן
    const isPatched = currentNodePath.endsWith('.real') || fs.existsSync(realNodePath);

    debugLog.appendLine(`Current Node: ${currentNodePath}`);
    debugLog.appendLine(`Is System Patched: ${isPatched}`);

    if (!isPatched) {
        enforceSystemPatch(currentNodePath, realNodePath, filterJs);
    } else {
        vscode.window.setStatusBarMessage("🛡️ Media Filter: ACTIVE", 10000);
    }
}

async function enforceSystemPatch(nodePath: string, realNodePath: string, filterJs: string) {
    const action = "אשר והפעל סינון";
    
    const selection = await vscode.window.showInformationMessage(
        "מדיניות אבטחה: חובה להפעיל את סינון המדיה בדרגת מערכת. החיבור יתנתק לצורך אתחול.",
        { modal: true },
        action
    );

    if (selection === action) {
        try {
            debugLog.appendLine("Applying Binary Shim...");
            
            const shimContent = `#!/bin/bash\nexport NODE_OPTIONS="--require ${filterJs}"\nexec "${realNodePath}" "$@"\n`;
            
            // שימוש ב-try catch לכל פקודה בנפרד
            try {
                if (!fs.existsSync(realNodePath)) {
                    execSync(`sudo mv "${nodePath}" "${realNodePath}"`);
                }
            } catch (e) { debugLog.appendLine("Note: mv failed or already done."); }

            const tempShim = '/tmp/node_shim_installer.sh';
            fs.writeFileSync(tempShim, shimContent);
            
            try {
                execSync(`sudo mv "${tempShim}" "${nodePath}"`);
                execSync(`sudo chmod +x "${nodePath}"`);
            } catch (e: any) {
                debugLog.appendLine("Error moving shim: " + e.message);
            }

            debugLog.appendLine("Shim applied. Attempting server restart...");

            // ביצוע Kill בתוך try-catch כדי שלא יפיל את רענון החלון
            try {
                // מנסים להרוג את השרת המרכזי
                execSync('sudo pkill -f server-main.js || true');
            } catch (e) {}

            // רענון החלון תמיד יתבצע, גם אם ה-Kill נכשל
            setTimeout(() => {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }, 1000);

        } catch (err: any) {
            debugLog.appendLine("Critical setup error: " + err.message);
            vscode.window.showErrorMessage("התקנת הפילטר נכשלה: " + err.message);
        }
    } else {
        // המשתמש סגר את החלון - פתיחה מחדש (הלולאה)
        setTimeout(() => enforceSystemPatch(nodePath, realNodePath, filterJs), 500);
    }
}

function prepareAssets(ctx: vscode.ExtensionContext, folder: string, filterJs: string) {
    try {
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
            execSync(`chmod 777 ${folder}`);
        }

        const assets = ['placeholder.png', 'placeholder.jpg', 'placeholder.mp4'];
        assets.forEach(asset => {
            const src = path.join(ctx.extensionPath, 'media', asset);
            const dest = path.join(folder, asset);
            if (fs.existsSync(src)) {
                fs.copyFileSync(src, dest);
                fs.chmodSync(dest, '0666');
            }
        });

        const filterCode = `
const fs = require('fs');
const BASE = '${folder}/placeholder.';
function isRead(f) {
    if (f === undefined || f === null) return true;
    if (typeof f === 'number') return (f & 3) === 0;
    if (typeof f === 'string') return f === 'r' || f === 'rs' || f === 'rb';
    return true;
}
function getP(p, f) {
    if (typeof p !== 'string' || !p.includes('/workspaces/') || !isRead(f)) return p;
    const ext = p.split('.').pop().toLowerCase();
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return BASE + (ext.startsWith('jp') ? 'jpg' : 'png');
    if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext)) return BASE + 'mp4';
    return p;
}
const o = { open: fs.open, openSync: fs.openSync, stat: fs.stat, statSync: fs.statSync, readFile: fs.readFile, readFileSync: fs.readFileSync };
fs.open = function(p, f, m, c) { return o.open.call(fs, getP(p, f), f, m, c); };
fs.openSync = function(p, f, m) { return o.openSync.call(fs, getP(p, f), f, m); };
fs.readFile = function(p, opts, c) { return o.readFile.call(fs, getP(p, 'r'), opts, c); };
fs.readFileSync = function(p, opts) { return o.readFileSync.call(fs, getP(p, 'r'), opts); };
fs.stat = function(p, opts, c) { return o.stat.call(fs, getP(p, 'r'), opts, c); };
fs.statSync = function(p, opts) { return o.statSync.call(fs, getP(p, 'r'), opts); };
if (fs.promises) {
    const pr = fs.promises;
    const _rf = pr.readFile; const _op = pr.open; const _st = pr.stat;
    pr.readFile = function(p, opts) { return _rf.call(pr, getP(p, 'r'), opts); };
    pr.open = function(p, f, m) { return _op.call(pr, getP(p, f), f, m); };
    pr.stat = function(p, opts) { return _st.call(pr, getP(p, 'r'), opts); };
}
        `;
        fs.writeFileSync(filterJs, filterCode);
        fs.chmodSync(filterJs, '0666');
    } catch (e) {}
}

export function deactivate() {}