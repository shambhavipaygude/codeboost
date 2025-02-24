import * as vscode from "vscode";
import * as dotenv from "dotenv";
import * as path from "path";
import {GeminiResponse} from './interface'

dotenv.config({ path: path.join(__dirname, "../.env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent";

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

export async function checkForBugFixes(document: vscode.TextDocument): Promise<void> {
    const { default: fetch } = await import("node-fetch");
    const codeContext = document.getText(); // Send entire document

    const prompt = `
    Identify and fix any bugs in the following code snippet.\n
    Only respond if there are issues, otherwise remain silent.\n
    Provide only the corrected code, replacing the incorrect parts.\n
    Do NOT add explanations. Do NOT make up any code by yourself, if enough information is not provided remain silent.\n
    \n
    ---\n
    Code Snippet:\n
    ${codeContext}
    ---\n
    Corrected Code (if needed):\n
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
        if (!data.candidates || data.candidates.length === 0) {
            vscode.window.showInformationMessage("No issues detected.");
            return;
        }

        const fixSuggestion = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        if (!fixSuggestion) {
            vscode.window.showInformationMessage("No issues detected.");
            return;
        }

        applyBugFix(document, fixSuggestion);
    } catch (error) {
        console.error("AI API error:", error);
    }
}

function applyBugFix(document: vscode.TextDocument, fixSuggestion: string): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const fullRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length));

    editor.edit(editBuilder => {
        editBuilder.replace(fullRange, fixSuggestion);
    });
}
