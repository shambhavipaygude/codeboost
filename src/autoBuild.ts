import * as vscode from "vscode";
import { checkForBugFixes } from "./bugFixes"; 

function getBuildCommand(document: vscode.TextDocument): string | null {
    const fileName = document.fileName;
    if (fileName.endsWith(".py")) {
        return `python "${fileName}"`; // Python
    } else if (fileName.endsWith(".cpp")) {
        return `g++ "${fileName}" -o output && ./output`; // C++
    } else if (fileName.endsWith(".java")) {
        return `javac "${fileName}" && java "${fileName.replace(".java", "")}"`; // Java
    } else if (fileName.endsWith(".js")) {
        return `node "${fileName}"`; // JavaScript
    } else if (fileName.endsWith(".ts")) {
        return `tsc "${fileName}" && node "${fileName.replace(".ts", ".js")}"`; // TypeScript
    } else if (fileName.endsWith(".go")) {
        return `go run "${fileName}"`; // Go
    } else if (fileName.endsWith(".rs")) {
        return `rustc "${fileName}" -o output && ./output`; // Rust
    } else if (fileName.endsWith("package.json")) {
        return `npm run build`; // React or Node.js projects
    } else if (fileName.endsWith("Cargo.toml")) {
        return `cargo build && cargo run`; // Rust Cargo projects
    } else if (fileName.endsWith("Makefile")) {
        return `make`; // General Makefile projects
    }
    return null; // Unsupported file type
}

async function runBuild(document: vscode.TextDocument) {
    const terminal = vscode.window.createTerminal("Auto Build");

    try {
        vscode.window.showInformationMessage("Fixing bugs before build...");
        await checkForBugFixes(document);
    
        //small delay to ensure all bugs fixed
        await new Promise(resolve => setTimeout(resolve, 2000)); 
    
        const buildCommand = getBuildCommand(document);
        if (!buildCommand) {
            vscode.window.showErrorMessage("Unsupported file type for build.");
            return;
        }
        const terminal = vscode.window.createTerminal("CodeBoost Build");
        terminal.show();
        terminal.sendText(buildCommand);
        
        vscode.window.showInformationMessage("Build started...");
    } catch (error) {
        vscode.window.showErrorMessage(`Error during build`);
    }   
}

export function activateAutoBuildButton(context: vscode.ExtensionContext) {
    const autoBuildButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    autoBuildButton.text = "⚡ Auto Build";
    autoBuildButton.tooltip = "Fix bugs and build project";
    autoBuildButton.command = "extension.autoBuild";
    autoBuildButton.show();

    const autoBuildCommand = vscode.commands.registerCommand("extension.autoBuild", () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            runBuild(activeEditor.document);
        } else {
            vscode.window.showErrorMessage("No active file to build.");
        }
    });
    context.subscriptions.push(autoBuildButton, autoBuildCommand);
}
