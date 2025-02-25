import * as vscode from "vscode";
import { getAISuggestion } from "./codeGeneration";
import { activateBugFix } from "./bugFixes";
import { runAndFixLoop } from "./autoBuild";

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand("codeboost.helloWorld", async () => {
        vscode.window.showInformationMessage("Codeboost is live!");
    });
    context.subscriptions.push(disposable);

    // Register bug fix button
    activateBugFix(context);

    // Register auto-build command (User must trigger it manually)
    let autoBuildCommand = vscode.commands.registerCommand("codeboost.autoBuild", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor found.");
            return;
        }
        
        try {
            await runAndFixLoop(); // Only runs when manually triggered
        } catch (error) {
            vscode.window.showErrorMessage("AutoBuild encountered an error");
        }
    });
    context.subscriptions.push(autoBuildCommand);

    // Inline Completion Provider (No auto-build here)
    const provider: vscode.InlineCompletionItemProvider = {
        provideInlineCompletionItems: async (document, position) => {
            const linePrefix = document.lineAt(position).text.substring(0, position.character);
            if (!linePrefix.trim()) return [];

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
