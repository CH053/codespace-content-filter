// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');


/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('מציג התמונות המוגן של נטפרי פעיל');

    const provider = new ImageFilteredEditorProvider(context);
    const registration = vscode.window.registerCustomEditorProvider('1568741230.imageViewer', provider);
    
    context.subscriptions.push(registration);
}

class ImageFilteredEditorProvider {
    constructor(context) {
        this.context = context;
    }

    /**
     * נדרש עבור עורכים מותאמים אישית של קבצים בינאריים
     */
    async openCustomDocument(uri) {
        return { uri, dispose: () => { } };
    }

    /**
     * נקרא אוטומטית בכל פעם שפותחים קובץ תמונה
     */
    async resolveCustomEditor(document, webviewPanel) {
        webviewPanel.webview.options = { enableScripts: true };
        
        // הצגת מצב טעינה ראשוני
        webviewPanel.webview.html = `<html><body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#1e1e1e;color:white;font-family:sans-serif;">
            <div>בודק תמונה מול שרת נטפרי...</div>
        </body></html>`;

        try {
            const filteredUrl = await mockFilterServer(document.uri);
            webviewPanel.webview.html = this.getHtmlForWebview(filteredUrl, document.uri.fsPath);
        } catch (err) {
            webviewPanel.webview.html = `<html><body>שגיאה בסינון התמונה</body></html>`;
        }
    }

    getHtmlForWebview(imageUrl, fileName) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { 
                        display: flex; flex-direction: column; justify-content: center; align-items: center; 
                        height: 100vh; margin: 0; background: var(--vscode-editor-background); 
                        color: var(--vscode-editor-foreground); font-family: sans-serif;
                    }
                    img { max-width: 85%; max-height: 80vh; border: 3px solid #007acc; box-shadow: 0 0 15px rgba(0,0,0,0.5); }
                    .status { margin-bottom: 15px; padding: 5px 15px; background: #007acc; color: white; border-radius: 20px; font-size: 12px; }
                    .path { margin-top: 10px; font-size: 11px; opacity: 0.7; }
                </style>
            </head>
            <body>
                <div class="status">נבדק ואושר על ידי סינון נטפרי</div>
                <img src="${imageUrl}" />
                <div class="path">${fileName}</div>
            </body>
            </html>
        `;
    }
}

/**
 * פונקציה המדמה שרת סינון מרוחק
 * @param {vscode.Uri} sourceUri 
 */

async function mockFilterServer(sourceUri) {
    // כאן בעתיד תהיה קריאת API לשרת נטפרי האמיתי
    // כרגע אנחנו מדמים השהיית רשת
    await new Promise(resolve => setTimeout(resolve, 20));
    
    // מחזיר תמונה מוגדרת מראש (Placeholder) שמייצגת תמונה מאושרת/מסוננת
    return "https://netfree.link/img/logo/text.svg"; 
}
// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
