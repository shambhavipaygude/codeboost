import * as vscode from "vscode";
import * as dotenv from "dotenv";
import * as path from "path";
import { GeminiResponse } from "./interface";

dotenv.config({ path: path.join(__dirname, "../.env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export async function applyEachFix(errorType: string, fix: string) {
    console.log("applyEachFix triggered with:", { errorType, fix });

    const editor = vscode.window.visibleTextEditors.find(
        (e) => e.viewColumn === vscode.ViewColumn.One
    );
    if (!editor) {
        console.error("No active editor found.");
        return;
    }

    console.log("Fetching full document text...");
    const { default: fetch } = await import("node-fetch");
    const document = editor.document;
    const fullCode = document.getText();

    console.log("Full code extracted:", fullCode);

    const prompt = `
    Here is the full code:
    ${fullCode}\n
    
    There is an issue of ${errorType}\n
    
    Suggested fix: ${fix}\n
    
    Instructions:
    - Rewrite **ONLY** the line of error using the provided fix.\n
    - **Do not** change any other part of the code.\n
    - Ignore all other errors.\n
    - Return the **entire code** in **Markdown format**, with the first and last lines containing backticks (\`\`\`).\n
    `;

    console.log("Generated prompt:", prompt);

    try {
        console.log("Making API request to Gemini...");
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
            }),
        });

        console.log("Response received:", response.status);

        if (!response.ok) {
            throw new Error(`API request failed with status: ${response.status}`);
        }

        const data = (await response.json()) as GeminiResponse;
        console.log("Response Data:", data);

        let fixedCode = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

        // Extract code between the first and last backticks
        const match = fixedCode.match(/```[\s\S]*?\n([\s\S]*)\n```/);
        if (match) {
            fixedCode = match[1].trim();
        }

        if (!fixedCode) {
            vscode.window.showErrorMessage("No valid response received from AI.");
            return;
        }

        console.log("Applying fix...");
        await editor.edit((editBuilder) => {
            const fullRange = new vscode.Range(
                new vscode.Position(0, 0),
                new vscode.Position(document.lineCount, 0)
            );
            editBuilder.replace(fullRange, fixedCode);
        });

        vscode.window.showInformationMessage(`Applied fix`);
        
    } catch (error) {
        console.error("Error applying fix:", error);
        vscode.window.showErrorMessage("❌ Error applying fix. See console for details.");
    }
}


