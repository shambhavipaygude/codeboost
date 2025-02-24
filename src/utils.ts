import * as vscode from "vscode";

export function getLastLines(document: vscode.TextDocument, line: number, count: number): string {
    const startLine = Math.max(0, line - count);
    return document.getText(new vscode.Range(startLine, 0, line, 0));
}

