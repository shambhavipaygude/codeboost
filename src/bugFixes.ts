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

    // create status bar button for bug fixing
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
    Identify and fix any bugs in the following code snippet.\n
    Do NOT add explanations. Only return the corrected code always in markdown format with backticks on first and last line.\n
    Given Code:\n
    ${codeContext}\n
    Error Message (if any):\n
    ${errorMessage}\n
    Corrected Code:\n
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

    // removing first and last lines if they contain backticks
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
}

// display gif
function getPetWebviewContent(): string {
    const petGifUrl = 'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExbmhwcnk5cmx5ZnU1YTRlZTduNDE0d3pyM2k2NHVkemV4eHA0OWVneSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/wSLgAC3rqQljfeQE2f/giphy.gif'; // 🔹 Replace with your GIF URL

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
                    max-width: 110px; /* Adjust size as needed */
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

