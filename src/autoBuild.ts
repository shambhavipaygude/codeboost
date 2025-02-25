import * as vscode from "vscode";
import { checkForBugFixes } from "./bugFixes";

export async function runAndFixLoop() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage("No active editor found.");
        return;
    }

    let document = editor.document;
    let maxAttempts = 5; // Avoid infinite loops
    let attempt = 0;

    while (attempt < maxAttempts) {
        attempt++;

        // Save file before execution
        await document.save();

        // Run code and check for errors
        const errorMessage = await runCodeAndGetErrors(document);
        if (!errorMessage) {
            vscode.window.showInformationMessage("Code executed successfully.");
            return;
        }

        vscode.window.showWarningMessage(`Errors found. Attempting fix... (${attempt}/${maxAttempts})`);

        // Fix errors
        await checkForBugFixes(document, errorMessage);

        // Refresh document reference
        document = vscode.window.activeTextEditor?.document!;
    }

    vscode.window.showErrorMessage("Max attempts reached.");
}



// 🚀 Run code and return errors if any
async function runCodeAndGetErrors(document: vscode.TextDocument): Promise<string | null> {
    const terminal = vscode.window.createTerminal(`Run Code`);
    const filePath = document.fileName;
    let compileCommand = "";
    let executeCommand = "";

    if (filePath.endsWith(".cpp")) {
        compileCommand = `g++ "${filePath}" -o "${filePath.replace(".cpp", "")}"`;
        executeCommand = `"${filePath.replace(".cpp", "")}"`;
    } else if (filePath.endsWith(".py")) {
        executeCommand = `python3 "${filePath}"`;
    } else if (filePath.endsWith(".js")) {
        executeCommand = `node "${filePath}"`;
    } else {
        vscode.window.showErrorMessage("Unsupported file type.");
        return null;
    }

    return new Promise((resolve) => {
        let hasError = false;
        let errorOutput = "";

        // Run compilation (if applicable)
        if (compileCommand) {
            terminal.sendText(compileCommand);
        }

        // Execute the file after a delay (to ensure compilation finishes)
        setTimeout(() => {
            terminal.sendText(executeCommand);
        }, 1000);

        // Listen for terminal closure
        const exitListener = vscode.window.onDidCloseTerminal((closedTerminal) => {
            if (closedTerminal === terminal) {
                resolve(hasError ? errorOutput : null);
                exitListener.dispose();
            }
        });

        // Simulate capturing error messages (since there's no onDidWriteTerminalData)
        setTimeout(() => {
            if (hasError) {
                vscode.window.showErrorMessage("Compilation error detected.");
            }
        }, 2000);
    });
}
