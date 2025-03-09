import * as vscode from "vscode";
import * as path from "path";
import { checkForBugFixes } from "./bugFixes"; 

export function detectLanguage(document: vscode.TextDocument): string | null {
  const ext = path.extname(document.fileName);
  const langMap: Record<string, string> = {
    ".py": "Python",
    ".java": "Java",
    ".c": "C",
    ".cpp": "C++",
    ".go": "Go",
    ".rs": "Rust",
    ".js": "JavaScript",
    ".ts": "TypeScript",
  };
  return langMap[ext] || null;
}

export function getBuildCommand(filePath: string, language: string): string | null {
  const baseName = path.basename(filePath, path.extname(filePath));
  const commands: Record<string, string> = {
    "Python": `python "${filePath}"`,
    "Java": `javac "${filePath}" && java ${baseName}`,
    "C": `gcc "${filePath}" -o "${baseName}.out" && ./"${baseName}.out"`,
    "C++": `g++ "${filePath}" -o "${baseName}.out" && ./"${baseName}.out"`,
    "Go": `go run "${filePath}"`,
    "Rust": `rustc "${filePath}" -o "${baseName}.out" && ./"${baseName}.out"`,
    "JavaScript": `node "${filePath}"`,
    "TypeScript": `tsc "${filePath}" && node "${baseName}.js"`,
  };
  return commands[language] || null;
}

export async function runBuild(document: vscode.TextDocument) {
    try {
        vscode.window.showInformationMessage("Fixing bugs before build...");
        await checkForBugFixes(document);
    
        //small delay to ensure all bugs fixed
        await new Promise(resolve => setTimeout(resolve, 2000)); 
        const language = detectLanguage(document)
        if (!language) {
            vscode.window.showErrorMessage("Unsupported file type for testing.");
            return;
        }
        const filePath = document.uri.fsPath;
        const buildCommand = getBuildCommand(filePath, language);
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
