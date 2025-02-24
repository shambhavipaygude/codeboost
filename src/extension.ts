import * as vscode from "vscode";
import { getAISuggestion } from "./codeGeneration";
import { activateBugFix } from "./bugFixes";  // Import bug fixing logic

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand("codeboost.helloWorld", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor found.");
            return;
        }
        vscode.window.showInformationMessage("Codeboost is live!");
    });
    context.subscriptions.push(disposable);

    // Register bug fix button (separate process)
    activateBugFix(context);

    // Inline Completion Provider
    const provider: vscode.InlineCompletionItemProvider = {
        provideInlineCompletionItems: async (document, position) => {
            const linePrefix = document.lineAt(position).text.substring(0, position.character);
            if (!linePrefix.trim()) return []; // Ignore empty lines

            const commands = await vscode.commands.getCommands();
            if (!commands.includes("codeboost.helloWorld")) {
                console.error("Command 'codeboost.helloWorld' is not registered.");
                return [];
            }

            await vscode.commands.executeCommand("codeboost.helloWorld");

            // Fetch AI-based suggestions
            const aiSuggestion = await getAISuggestion(document, position);
            if (!aiSuggestion) return [];

            return [
                new vscode.InlineCompletionItem(aiSuggestion, new vscode.Range(position, position))
            ];
        }
    };
    context.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider({ scheme: "file", language: "*" }, provider));
}

export function deactivate() {}
