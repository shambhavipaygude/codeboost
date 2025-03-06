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
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

let diagnosticCollection: vscode.DiagnosticCollection;
let debounceTimeout: NodeJS.Timeout | undefined;
let problemsTabOpened = false;
let lastProcessedCode = new Map<string, string>(); // Stores last checked content per file

async function getBugSuggestions(document: vscode.TextDocument): Promise<vscode.Diagnostic[]> {
    const { default: fetch } = await import("node-fetch");
    const codeContext = document.getText();

    const prompt = `
    Identify and suggest if any bugs exist in the following code. Provide output in this format:
    {line no.} - {type of bug} - {suggested fix}\n
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
        const suggestionText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        if (!suggestionText) return [];

        const diagnostics: vscode.Diagnostic[] = [];
        const suggestionLines = suggestionText.split("\n");

        for (const line of suggestionLines) {
            const match = line.match(/(\d+) - (.+?) - (.+)/);
            if (match) {
                const lineNumber = parseInt(match[1], 10);
                const errorType = match[2];
                const fix = match[3];

                const range = new vscode.Range(
                    new vscode.Position(lineNumber - 1, 0),
                    new vscode.Position(lineNumber - 1, Number.MAX_SAFE_INTEGER)
                );

                const diagnostic = new vscode.Diagnostic(range, `Codeboost : ${errorType}: ${fix}`, vscode.DiagnosticSeverity.Information);
                diagnostic.source = "CodeBoost"
                diagnostics.push(diagnostic);
            }
        }

        return diagnostics;
    } catch (error) {
        console.error("Error fetching bug suggestions:", error);
        return [];
    }
}

export function activateSuggestions(context: vscode.ExtensionContext) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection("CodeBoost");
    context.subscriptions.push(diagnosticCollection);

    vscode.workspace.onDidChangeTextDocument((event: vscode.TextDocumentChangeEvent) => {
        const document = event.document;
        if (!document.languageId) return;

        const newCode = document.getText();
        const filePath = document.uri.fsPath;

        // If the content hasn't changed, do not make an API call
        if (lastProcessedCode.get(filePath) === newCode) {
            return;
        }

        // Update last processed content
        lastProcessedCode.set(filePath, newCode);

        // Debounce mechanism to reduce API calls
        if (debounceTimeout) {
            clearTimeout(debounceTimeout);
        }

        debounceTimeout = setTimeout(async () => {
            const diagnostics = await getBugSuggestions(document);
            diagnosticCollection.set(document.uri, diagnostics);

            // Open Problems tab only once when the first issue is detected
            if (diagnostics.length > 0 && !problemsTabOpened) {
                problemsTabOpened = true;
                vscode.commands.executeCommand("workbench.actions.view.problems").then(() => {
                    // Immediately switch focus back to the editor
                    vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");
                });
            }
        }, 1500); // Wait 1.5s after the last change before making API call
    });
}





