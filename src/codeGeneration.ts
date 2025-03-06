import * as vscode from 'vscode';
import * as dotenv from "dotenv";
import * as path from "path";
import { getLastLines } from './utils';
import { GeminiResponse } from './interface';

dotenv.config({ path: path.join(__dirname, "../.env") });
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

if (!GEMINI_API_KEY) {
    vscode.window.showErrorMessage("GEMINI_API_KEY is missing. Please set it in your environment variables.");
}

// Debounce function: Returns a promise and delays execution
function debounce<T extends (...args: any[]) => Promise<any>>(func: T, delay: number): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    let timeoutId: NodeJS.Timeout;
    let lastPromise: Promise<ReturnType<T>> | null = null;

    return (...args: Parameters<T>): Promise<ReturnType<T>> => {
        clearTimeout(timeoutId);

        return new Promise((resolve) => {
            timeoutId = setTimeout(async () => {
                lastPromise = func(...args);
                resolve(await lastPromise);
            }, delay);
        });
    };
}

async function fetchAISuggestion(document: vscode.TextDocument, position: vscode.Position): Promise<string> {
    const { default: fetch } = await import('node-fetch');
    const codeContext = getLastLines(document, position.line, 5);
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

// Debounced version of `fetchAISuggestion`
const debouncedGetAISuggestion = debounce(fetchAISuggestion, 500);

export async function getAISuggestion(document: vscode.TextDocument, position: vscode.Position): Promise<string> {
    return debouncedGetAISuggestion(document, position);
}





