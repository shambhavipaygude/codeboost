// import * as vscode from "vscode";
// import * as dotenv from "dotenv";
// import * as path from "path";
// import { GeminiResponse } from "./interface";

// dotenv.config({ path: path.join(__dirname, "../.env") });
// const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
// if (!GEMINI_API_KEY) {
//     vscode.window.showErrorMessage("GEMINI_API_KEY is missing. Please set it in your environment variables.");
// }

// async function getBugSuggestions(document: vscode.TextDocument): Promise<{ suggestion: string }> {
//     const { default: fetch } = await import("node-fetch");
//     const codeContext = document.getText();

//     const prompt = `
//     Identify and suggest if any bugs in the following code snippet. If no bugs detected, remain silent.
//     Do NOT add explanations. Only respond in this format:\n
//     {line no. of bug} - {type of bug} - {suggested fix (in very brief)}\n
//     Given Code:\n
//     ${codeContext}\n
//     Response:\n
//     `;

//     try {
//         const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
//             method: "POST",
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({
//                 contents: [{ role: "user", parts: [{ text: prompt }] }],
//             }),
//         });
//         if (!response.ok) {
//             throw new Error(`API request failed with status: ${response.status}`);
//         }
//         const data = (await response.json()) as GeminiResponse;
//         const suggestion = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
//         return { suggestion };
//     } catch (error) {
//         console.error("Error fetching bug suggestions:", error);
//         vscode.window.showErrorMessage("Error fetching bug suggestions. Check the console for details.");
//         return { suggestion: "" };
//     }
// }

// // Track cursor and make suggestions every 3 modified lines
// export function trackCursorForSuggestions(context: vscode.ExtensionContext) {
//     let lastCheckedLine = 0;
//     const disposable = vscode.workspace.onDidChangeTextDocument(async (event: vscode.TextDocumentChangeEvent) => {
//         const document = event.document;
//         if (document.lineCount > lastCheckedLine && (document.lineCount - lastCheckedLine) >= 3) {
//             const { suggestion } = await getBugSuggestions(document);
//             if (suggestion) {
//                 vscode.window.showInformationMessage(suggestion);
//             }
//             lastCheckedLine = document.lineCount; 
//         }
//     });
//     context.subscriptions.push(disposable);
// }

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
): Promise<{ diagnostics: vscode.Diagnostic[]; suggestions: { line: number; type: string; fix: string }[] }> {
    const { default: fetch } = await import("node-fetch");
    const codeContext = document.getText();

    const prompt = `
    Analyze the following code and identify any syntactic errors or logical bugs. 
    Provide output in this format and make sure it is to the point:
    {error line number} - {type of bug} - {suggested fix}\n
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
        const suggestions: { line: number; type: string; fix: string }[] = [];

        suggestionText.split("\n").forEach((line) => {
            const match = line.match(/(\d+) - (.+?) - (.+)/);
            if (match) {
                const lineNumber = parseInt(match[1], 10);
                const errorType = match[2];
                const fix = match[3];

                const range = new vscode.Range(
                    new vscode.Position(lineNumber - 1, 0),
                    new vscode.Position(lineNumber - 1, Number.MAX_SAFE_INTEGER)
                );

                const diagnostic = new vscode.Diagnostic(
                    range,
                    `CodeBoost: ${errorType}: ${fix}`,
                    vscode.DiagnosticSeverity.Information
                );
                diagnostic.source = "CodeBoost";
                diagnostics.push(diagnostic);

                suggestions.push({ line: lineNumber, type: errorType, fix });
            }
        });

        return { diagnostics, suggestions };
    } catch (error) {
        console.error("Error fetching bug suggestions:", error);
        return { diagnostics: [], suggestions: [] };
    }
}

function showWebview(suggestions: { line: number; type: string; fix: string }[]) {
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
            if (message.command === "applyFix") {
                applyFix(message.line, message.fix);
            }
        });
    }

    webviewPanel.webview.html = getWebviewContent(suggestions);
}

async function applyFix(lineNumber: number, fix: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const document = editor.document;
    const line = document.lineAt(lineNumber - 1);

    await editor.edit((editBuilder) => {
        editBuilder.replace(line.range, fix);
    });

    vscode.window.showInformationMessage(`✅ Applied fix on line ${lineNumber}: ${fix}`);
}

function getWebviewContent(suggestions: { line: number; type: string; fix: string }[]) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CodeBoost Suggestions</title>
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
                <th>Line No.</th>
                <th>Issue</th>
                <th>Fix</th>
                <th>Action</th>
            </tr>
            ${suggestions
                .map(
                    (s) =>
                        `<tr>
                            <td>${s.line}</td>
                            <td>${s.type}</td>
                            <td>${s.fix}</td>
                            <td><button onclick="applyFix(${s.line}, '${s.fix.replace(
                                /'/g,
                                "\\'"
                            )}')">Apply</button></td>
                        </tr>`
                )
                .join("")}
        </table>
        <script>
            const vscode = acquireVsCodeApi();
            function applyFix(line, fix) {
                vscode.postMessage({ command: "applyFix", line: line, fix: fix });
            }
        </script>
    </body>
    </html>`;
}

export function activateSuggestions(context: vscode.ExtensionContext) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection("CodeBoost");
    context.subscriptions.push(diagnosticCollection);

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
            const { diagnostics, suggestions } = await getBugSuggestions(document);
            diagnosticCollection.set(document.uri, diagnostics);
            if (suggestions.length > 0) {
                showWebview(suggestions);
            }
        }, 1000);
    });
}


