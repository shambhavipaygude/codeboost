import * as vscode from "vscode";
import * as dotenv from "dotenv";
import * as path from "path";
import { GeminiResponse } from "./interface";

dotenv.config({ path: path.join(__dirname, "../.env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

let diagnosticCollection: vscode.DiagnosticCollection;
let debounceTimeout: NodeJS.Timeout | undefined;
let lastProcessedCode = new Map<string, string>();
let webviewPanel: vscode.WebviewPanel | undefined;

async function getBugSuggestions(
    document: vscode.TextDocument
): Promise<{ diagnostics: vscode.Diagnostic[]; suggestions: {type: string; fix: string }[] }> {
    const { default: fetch } = await import("node-fetch");
    const codeContext = document.getText();

    const prompt = `
    Analyze the following code and identify any syntactic errors or logical bugs. If no issue found, stay silent. Do not hallucinate.
    Provide output in this format and make sure it is to the point:
    {type of bug} - {suggested fix}\n
    Code:\n
    ${codeContext}\n
    Response:\n
    `;

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
            }),
        });

        if (!response.ok) {
            throw new Error(`API request failed with status: ${response.status}`);
        }

        const data = (await response.json()) as GeminiResponse;
        const suggestionText =
            data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        if (!suggestionText) return { diagnostics: [], suggestions: [] };

        console.log(suggestionText);

        const diagnostics: vscode.Diagnostic[] = [];
        const suggestions: {type: string; fix: string }[] = [];

        suggestionText.split("\n").forEach((line) => {
            const match = line.match(/(.+?) - (.+)/);
            if (match) {
                const errorType = match[1];
                const fix = match[2];

                // Attach the diagnostic to the first character of the document
                const range = new vscode.Range(
                    new vscode.Position(0, 0),
                    new vscode.Position(0, 1)
                );

                const diagnostic = new vscode.Diagnostic(
                    range,
                    `CodeBoost: ${errorType}: ${fix}`,
                    vscode.DiagnosticSeverity.Information
                );
                diagnostic.source = "CodeBoost";
                diagnostics.push(diagnostic);

                suggestions.push({type: errorType, fix });
            }
        });

        return { diagnostics, suggestions };
    } catch (error) {
        console.error("Error fetching bug suggestions:", error);
        return { diagnostics: [], suggestions: [] };
    }
}

async function applyEachFix(errorType: string, fix: string) {
    console.log("applyEachFix triggered with:", { errorType, fix });

    const editor = vscode.window.visibleTextEditors.find(
        (e) => e.viewColumn === vscode.ViewColumn.One
    );
    if (!editor) {
        console.error("No active editor found.");
        return;
    }

    console.log("Fetching full document text...");
    const { default: fetch } = await import("node-fetch");
    const document = editor.document;
    const fullCode = document.getText();

    console.log("Full code extracted:", fullCode);

    const prompt = `
    Here is the full code:
    ${fullCode}\n
    
    There is an issue of ${errorType}\n
    
    Suggested fix: ${fix}\n
    
    Instructions:
    - Rewrite **only** the line of error using the provided fix.\n
    - **Do not** change any other part of the code.\n
    - Ignore all other errors.\n
    - Return the **entire code** in **Markdown format**, with the first and last lines containing backticks (\`\`\`).\n
    `;

    console.log("Generated prompt:", prompt);

    try {
        console.log("Making API request to Gemini...");
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
            }),
        });

        console.log("Response received:", response.status);

        if (!response.ok) {
            throw new Error(`API request failed with status: ${response.status}`);
        }

        const data = (await response.json()) as GeminiResponse;
        console.log("Response Data:", data);

        let fixedCode = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

        // Extract code between the first and last backticks
        const match = fixedCode.match(/```[\s\S]*?\n([\s\S]*)\n```/);
        if (match) {
            fixedCode = match[1].trim();
        }

        if (!fixedCode) {
            vscode.window.showErrorMessage("No valid response received from AI.");
            return;
        }

        console.log("Applying fix...");
        await editor.edit((editBuilder) => {
            const fullRange = new vscode.Range(
                new vscode.Position(0, 0),
                new vscode.Position(document.lineCount, 0)
            );
            editBuilder.replace(fullRange, fixedCode);
        });

        vscode.window.showInformationMessage(`✅ Applied fix`);
        
    } catch (error) {
        console.error("Error applying fix:", error);
        vscode.window.showErrorMessage("❌ Error applying fix. See console for details.");
    }
}


export function activateSuggestions(context: vscode.ExtensionContext) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection("CodeBoost");
    context.subscriptions.push(diagnosticCollection);

    let lastRequestTime = 0;

vscode.workspace.onDidChangeTextDocument(async (event) => {
    const document = event.document;
    if (!document.languageId) return;

    const newCode = document.getText();
    const filePath = document.uri.fsPath;

    if (lastProcessedCode.get(filePath) === newCode) {
        return;
    }

    lastProcessedCode.set(filePath, newCode);

    if (debounceTimeout) {
        clearTimeout(debounceTimeout);
    }

    debounceTimeout = setTimeout(async () => {
        const now = Date.now();
        if (now - lastRequestTime < 5000) {
            console.log("Skipping request due to rate limit.");
            return; // Prevents too frequent API calls
        }

        lastRequestTime = now; // Update last request timestamp

        const { diagnostics, suggestions } = await getBugSuggestions(document);
        diagnosticCollection.set(document.uri, diagnostics);
        if (suggestions.length > 0) {
            showWebview(suggestions);
        }
    }, 2000); // Slightly increased debounce to 2 seconds
});

}

function showWebview(suggestions: {type: string; fix: string }[]) {
    if (!webviewPanel) {
        webviewPanel = vscode.window.createWebviewPanel(
            "codeBoostSidebar",
            "CodeBoost Suggestions",
            { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
            { enableScripts: true, retainContextWhenHidden: true }
        );

        webviewPanel.onDidDispose(() => {
            webviewPanel = undefined;
        });

        webviewPanel.webview.onDidReceiveMessage((message) => {
            console.log("Received message from Webview:", message);
            if (message.command === "applyFix") {
                applyEachFix(message.errorType, message.fix).then(() => {
                    // Remove the applied fix from the suggestions array
                    suggestions = suggestions.filter((s) => s.fix !== message.fix);

                    // Ensure webviewPanel is still available before updating
                    if (webviewPanel) {
                        webviewPanel.webview.html = getWebviewContent(suggestions);
                    }
                });
            }
        });
    } else {
        // If webview already exists, update its content
        webviewPanel.webview.html = getWebviewContent(suggestions);
    }
}

function getWebviewContent(suggestions: {type: string; fix: string }[]) {
    const suggestionHTML = suggestions
        .map(s => `
            <tr>
                <td>${s.type}</td>
                <td>${s.fix}</td>
                <td><button onclick="sendFixToVSCode('${s.type.replace(/'/g, "\\'")}', '${s.fix.replace(/'/g, "\\'")}')">Apply Fix</button></td>
            </tr>
        `)
        .join("");

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CodeBoost Sidebar</title>
        <style>
            body { font-family: Arial, sans-serif; padding: 10px; background-color: #1e1e1e; color: white; }
            h2 { font-size: 18px; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; font-size: 14px; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #555; }
            th { background-color: #333; color: white; }
            tr:hover { background-color: #444; }
            button { background-color: #4CAF50; color: white; border: none; padding: 5px 10px; cursor: pointer; }
            button:hover { background-color: #45a049; }
        </style>
    </head>
    <body>
        <h2>🔍 CodeBoost Suggestions</h2>
        <table>
            <tr>
                <th>Issue</th>
                <th>Fix</th>
                <th>Action</th>
            </tr>
            ${suggestionHTML}
        </table>
        <script>
        const vscode = acquireVsCodeApi();
        function sendFixToVSCode(errorType, fix) {
            vscode.postMessage({ command: "applyFix", errorType: errorType, fix: fix });
        }
    </script>

    </body>
    </html>`;
}


