import * as vscode from 'vscode';
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent";


interface GeminiResponse {
    candidates?: {
        content?: {
            parts?: { text: string }[];
            role?: string;
        };
        finishReason?: string;
        index?: number;
        safetyRatings?: any[];
    }[];
}


export async function getAISuggestion(document: vscode.TextDocument, position: vscode.Position): Promise<string> {
    const { default: fetch } = await import('node-fetch');
    const codeContext = getLastLines(document, position.line, 5); // Send last 5 lines of code
    const cursorPrefix = document.lineAt(position.line).text.substring(0, position.character); 
    const prompt = `
    Complete this code **without repeating existing text**.\n
    Only give the next part of the statement where the cursor is.\n
    Do NOT include explanations or comments.\n
    ---\n
    Previous Code:\n
    ${codeContext}\n
    ---\n
    Current Line Start:\n
    ${cursorPrefix}█  <-- (Cursor here)\n
    What comes next?
    `;
    
    console.log(JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
    }))

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
            })
        });
        

        const data = (await response.json()) as GeminiResponse;
        
        if (!data.candidates || data.candidates.length === 0) {
            console.error("AI API returned an unexpected response:", data);
            return "";
        }
        
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

        if (!textResponse) {
            console.error("AI API returned an empty or unexpected response:", data);
            return "";
        }
        
        return textResponse;
        

    } catch (error) {
        console.error('AI API error:', error);
        return '';
    }
}

function getLastLines(document: vscode.TextDocument, line: number, count: number): string {
    const startLine = Math.max(0, line - count);
    return document.getText(new vscode.Range(startLine, 0, line, 0));
}



