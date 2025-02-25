import * as vscode from "vscode";
import * as dotenv from "dotenv";
import * as path from "path";
import {GeminiResponse} from './interface'

dotenv.config({ path: path.join(__dirname, "../.env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export function activateBugFix(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand("codeboost.fixBugs", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor found.");
            return;
        }
        
        const document = editor.document;
        await checkForBugFixes(document);
    });

    context.subscriptions.push(disposable);

    // Create a status bar button for bug fixing
    const bugFixButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    bugFixButton.command = "codeboost.fixBugs";
    bugFixButton.text = "$(wrench) Fix Bugs";
    bugFixButton.tooltip = "Click to analyze and fix bugs in the code";
    bugFixButton.show();
    
    context.subscriptions.push(bugFixButton);
}

export async function checkForBugFixes(document: vscode.TextDocument, errorMessage: string = ""): Promise<void> {
    const { default: fetch } = await import("node-fetch");
    const codeContext = document.getText();

    const prompt = `
Identify and fix any bugs in the following code snippet.

Do NOT add explanations. Only return the corrected code always in markdown format with backticks on first and last line.

Given Code:
${codeContext}

Error Message (if any):
${errorMessage}

Corrected Code:
`;


    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
            }),
        });

        const data = (await response.json()) as GeminiResponse;
        const fixSuggestion = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

        if (!fixSuggestion) {
            vscode.window.showInformationMessage("No issues detected.");
            return;
        }

        vscode.window.setStatusBarMessage("$(sync~spin) Applying fixes...", 3000);
        applyBugFix(document, fixSuggestion);
        showPet();
    } catch (error) {
        console.error("AI API error:", error);
    }
}


function applyBugFix(document: vscode.TextDocument, fixSuggestion: string): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    // Remove the first and last lines if they contain backticks
    const lines = fixSuggestion.split("\n");
    if (lines.length > 1 && lines[0].startsWith("```") && lines[lines.length - 1].startsWith("```")) {
        fixSuggestion = lines.slice(1, -1).join("\n");
    }

    const fullRange = new vscode.Range(
        new vscode.Position(0, 0),
        new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length)
    );

    editor.edit(editBuilder => {
        editBuilder.replace(fullRange, fixSuggestion);
    });
}

let petPanel: vscode.WebviewPanel | undefined;
function showPet() {
    if (petPanel) {
        petPanel.reveal(vscode.ViewColumn.Two);
        return;
    }

    petPanel = vscode.window.createWebviewPanel(
        "codePet",
        "Bug Fix Pet",
        vscode.ViewColumn.Two,
        { enableScripts: true, retainContextWhenHidden: false }
    );

    petPanel.webview.html = getPetWebviewContent();

    setTimeout(() => {
        petPanel?.dispose();
        petPanel = undefined;
    }, 5000);

    // petPanel.onDidDispose(() => {
    //     petPanel = undefined;
    // });
}

// 🖼 HTML to display pet GIF at bottom-left
function getPetWebviewContent(): string {
    const petGifUrl = 'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExd2ozdjl5cW02OHh6OW51eDY1MDJxa2Y4azV2Ym1vbnVhbmNrbDl5ciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/cCOVfFwDI3awdse5A3/giphy.gif'; // 🔹 Replace with your GIF URL

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <style>
                body {
                    background-color: transparent;
                    overflow: hidden;
                    margin: 0;
                    padding: 0;
                }
                .pet-container {
                    position: fixed;
                    bottom: 30px; /* Adjust to place above the status bar */
                    left: 10px;
                    z-index: 9999;
                }
                img {
                    max-width: 80px; /* Adjust size as needed */
                }
            </style>
        </head>
        <body>
            <div class="pet-container">
                <img src="${petGifUrl}" alt="Pet">
            </div>
        </body>
        </html>
    `;
}

// import * as vscode from "vscode";
// import * as dotenv from "dotenv";
// import * as path from "path";
// import { GeminiResponse } from "./interface";

// dotenv.config({ path: path.join(__dirname, "../.env") });

// const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// const GEMINI_API_URL =
//     "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent";

// export function activateBugFix(context: vscode.ExtensionContext) {
//     let disposable = vscode.commands.registerCommand(
//         "codeboost.fixBugs",
//         async () => {
//             const editor = vscode.window.activeTextEditor;
//             if (!editor) {
//                 vscode.window.showErrorMessage("No active editor found.");
//                 return;
//             }

//             const document = editor.document;
//             await checkForBugFixes(document);
//         }
//     );

//     context.subscriptions.push(disposable);

//     // Create a status bar button for bug fixing
//     const bugFixButton = vscode.window.createStatusBarItem(
//         vscode.StatusBarAlignment.Right,
//         100
//     );
//     bugFixButton.command = "codeboost.fixBugs";
//     bugFixButton.text = "$(wrench) Fix Bugs";
//     bugFixButton.tooltip = "Click to analyze and fix bugs in the code";
//     bugFixButton.show();

//     context.subscriptions.push(bugFixButton);

//     // Listen for changes in the document
//     vscode.workspace.onDidChangeTextDocument(async (event) => {
//         const editor = vscode.window.activeTextEditor;
//         if (!editor || editor.document !== event.document) return;

//         if (event.contentChanges.length === 0) return;

//         const document = editor.document;
//         const line = event.contentChanges[0].range.start.line;
//         await suggestBugFixes(document, line);
//     });
// }

// export async function checkForBugFixes(
//     document: vscode.TextDocument,
//     errorMessage: string = ""
// ): Promise<void> {
//     const { default: fetch } = await import("node-fetch");
//     const codeContext = document.getText();

//     const prompt = `
//     Identify and fix any bugs in the following code snippet.\n
//     Do NOT add explanations. Only return the fixed code.\n
//     Given Code:\n
//     ${codeContext}\n
//     Error Message (if any):\n
//     ${errorMessage}\n
//     Corrected Code:\n
//     `;

//     try {
//         const response = await fetch(
//             `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
//             {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify({
//                     contents: [{ role: "user", parts: [{ text: prompt }] }],
//                 }),
//             }
//         );

//         const data = (await response.json()) as GeminiResponse;
//         const fixSuggestion =
//             data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

//         if (!fixSuggestion) {
//             vscode.window.showInformationMessage("No issues detected.");
//             return;
//         }

//         vscode.window.setStatusBarMessage(
//             "$(sync~spin) Applying fixes...",
//             3000
//         );
//         applyBugFix(document, fixSuggestion);
//         showPet();
//     } catch (error) {
//         console.error("AI API error:", error);
//     }
// }

// // Suggest Errors Dynamically Instead of Fixing
// async function suggestBugFixes(
//     document: vscode.TextDocument,
//     line: number
// ): Promise<void> {
//     const { default: fetch } = await import("node-fetch");
//     const codeContext = document.getText();

//     const prompt = `
//     Identify any errors in the given code and provide a brief explanation.\n
//     DO NOT return fixed code. ONLY return the issue, the affected line number, and a short explanation.\n
//     Given Code:\n
//     ${codeContext}\n
//     Error Details:\n
//     `;

//     try {
//         const response = await fetch(
//             `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
//             {
//                 method: "POST",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify({
//                     contents: [{ role: "user", parts: [{ text: prompt }] }],
//                 }),
//             }
//         );

//         const data = (await response.json()) as GeminiResponse;
//         const errorSuggestion =
//             data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

//         if (!errorSuggestion) return;

//         vscode.window.showWarningMessage(`Possible issue on line ${line + 1}: ${errorSuggestion}`);
//     } catch (error) {
//         console.error("Error fetching AI error suggestions:", error);
//     }
// }

// // Apply Fixes When "Fix Bugs" Button is Clicked
// function applyBugFix(document: vscode.TextDocument, fixSuggestion: string): void {
//     const editor = vscode.window.activeTextEditor;
//     if (!editor) return;

//     const fullRange = new vscode.Range(
//         new vscode.Position(0, 0),
//         new vscode.Position(
//             document.lineCount - 1,
//             document.lineAt(document.lineCount - 1).text.length
//         )
//     );

//     editor.edit((editBuilder) => {
//         editBuilder.replace(fullRange, fixSuggestion);
//     });
// }

// // Show Pet Animation
// let petPanel: vscode.WebviewPanel | undefined;
// function showPet() {
//     if (petPanel) {
//         petPanel.reveal(vscode.ViewColumn.Two);
//         return;
//     }

//     petPanel = vscode.window.createWebviewPanel(
//         "codePet",
//         "Bug Fix Pet",
//         vscode.ViewColumn.Two,
//         { enableScripts: true, retainContextWhenHidden: false }
//     );

//     petPanel.webview.html = getPetWebviewContent();

//     setTimeout(() => {
//         petPanel?.dispose();
//         petPanel = undefined;
//     }, 5000);
// }

// // 🖼 HTML to Display Pet Animation
// function getPetWebviewContent(): string {
//     const petGifUrl =
//         "https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExd2ozdjl5cW02OHh6OW51eDY1MDJxa2Y4azV2Ym1vbnVhbmNrbDl5ciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/cCOVfFwDI3awdse5A3/giphy.gif"; // Replace with your own GIF

//     return `
//         <!DOCTYPE html>
//         <html lang="en">
//         <head>
//             <style>
//                 body {
//                     background-color: transparent;
//                     overflow: hidden;
//                     margin: 0;
//                     padding: 0;
//                 }
//                 .pet-container {
//                     position: fixed;
//                     bottom: 30px;
//                     left: 10px;
//                     z-index: 9999;
//                 }
//                 img {
//                     max-width: 80px;
//                 }
//             </style>
//         </head>
//         <body>
//             <div class="pet-container">
//                 <img src="${petGifUrl}" alt="Pet">
//             </div>
//         </body>
//         </html>
//     `;
// }
