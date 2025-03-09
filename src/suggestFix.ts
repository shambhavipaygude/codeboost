import * as vscode from "vscode";
import * as dotenv from "dotenv";
import * as path from "path";
import { GeminiResponse } from "./interface";
import {applyEachFix} from "./applyEachFix";
import {getWebviewContent} from "./webView";
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
    type of bug - suggested fix\n
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

        lastRequestTime = now; 
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
                    suggestions = suggestions.filter((s) => s.fix !== message.fix);
                    if (webviewPanel) {
                        webviewPanel.webview.html = getWebviewContent(suggestions);
                    }
                });
            }
        });
    } else {
        webviewPanel.webview.html = getWebviewContent(suggestions);
    }
}

