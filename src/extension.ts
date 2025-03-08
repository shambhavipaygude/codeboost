import * as vscode from "vscode";
import { getAISuggestion } from "./codeGeneration";
import { activateBugFix } from "./bugFixes";
import { activateSuggestions } from "./suggestFix";
import { activateAutoBuildButton } from "./autoBuild";
import {activateTestRunner} from "./testRunner";

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand("codeboost.helloWorld", async () => {
        vscode.window.showInformationMessage("Codeboost is live!");
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor found.");
            return;
        }
    });
    context.subscriptions.push(disposable);

    activateBugFix(context); //bug fix button
    activateAutoBuildButton(context); //build button
    activateTestRunner(context); //test case generator button
    activateSuggestions(context); // auto-suggestions feature

    // Inline Completion Provider 
    const provider: vscode.InlineCompletionItemProvider = {
        provideInlineCompletionItems: async (document, position) => {
            const linePrefix = document.lineAt(position).text.substring(0, position.character);
            if (!linePrefix.trim()) return [];

            // AI-based suggestions
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
