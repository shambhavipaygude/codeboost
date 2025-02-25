import * as vscode from "vscode";
import * as dotenv from "dotenv";
import * as path from "path";
import { GeminiResponse } from "./interface"; // Assuming you have this interface defined

dotenv.config({ path: path.join(__dirname, "../.env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

if (!GEMINI_API_KEY) {
    vscode.window.showErrorMessage("GEMINI_API_KEY is missing. Please set it in your environment variables.");
}

// Function to request bug suggestions from Gemini API
async function getBugSuggestions(document: vscode.TextDocument): Promise<{ suggestion: string }> {
    const { default: fetch } = await import("node-fetch");
    const codeContext = document.getText();

    const prompt = `
    Identify and suggest if any bugs in the following code snippet. If no bugs detected, remain silent.
    
    Do NOT add explanations. Only respond in this format:
    {line no. of bug} - {type of bug} - {suggested fix (in very brief)}
    
    Given Code:
    ${codeContext}
    
    Response:
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
        const suggestion = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

        return { suggestion };
    } catch (error) {
        console.error("Error fetching bug suggestions:", error);
        vscode.window.showErrorMessage("Error fetching bug suggestions. Check the console for details.");
        return { suggestion: "" };
    }
}

// Track cursor and make suggestions every 3 modified lines
export function trackCursorForSuggestions(context: vscode.ExtensionContext) {
    let lastCheckedLine = 0;

    const disposable = vscode.workspace.onDidChangeTextDocument(async (event: vscode.TextDocumentChangeEvent) => {
        const document = event.document;

        // Only trigger suggestions after 3 lines have been modified
        if (document.lineCount > lastCheckedLine && (document.lineCount - lastCheckedLine) >= 3) {
            const { suggestion } = await getBugSuggestions(document);

            if (suggestion) {
                vscode.window.showInformationMessage(suggestion);
            }

            lastCheckedLine = document.lineCount; // Update to the last checked line
        }
    });

    context.subscriptions.push(disposable);
}
