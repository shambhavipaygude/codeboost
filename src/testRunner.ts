import * as vscode from "vscode"; 
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/**
 * Detect programming language based on file extension.
 */
function detectLanguage(document: vscode.TextDocument): string | null {
    const ext = path.extname(document.fileName);
    const langMap: Record<string, string> = {
        ".py": "Python",
        ".java": "Java",
        ".c": "C",
        ".cpp": "C++",
        ".go": "Go",
        ".rs": "Rust",
        ".js": "JavaScript",
        ".ts": "TypeScript"
    };
    return langMap[ext] || null;
}

/**
 * Generate 15 test cases dynamically using Gemini API.
 */
async function generateTestCases(filePath: string, language: string): Promise<{ input: string, output: string }[] | null> {
    const code = fs.readFileSync(filePath, "utf-8");

    const prompt = `
Analyze the following ${language} code and generate 15 diverse test cases.
The code may take multiple lines of input and return various types of outputs (numbers, strings, booleans, etc.).

Return the test cases in this JSON format:

[
    { "input": "<input_value>", "output": "<expected_output>" },
    ...
]

Ensure correctness by following the code logic.

Code:
${code}
`;

    try {
        const response = await axios.post(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        });

        let rawResponse = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // Clean response by removing backticks and unnecessary "json" keywords
        rawResponse = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();

        const testCases = JSON.parse(rawResponse);
        return testCases;
    } catch (error) {
        console.error("Error generating test cases:", error);
        return null;
    }
}

/**
 * Run test cases and validate results.
 */
async function runTestCases(filePath: string, language: string, testCases: { input: string, output: string }[]): Promise<void> {
    let passed = 0, failed = 0;

    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        const inputData = testCase.input.replace(/\\n/g, "\n");
        console.log(inputData)
        const expectedOutput = testCase.output.replace(/\\n/g, "\n");
        //console.log(expectedOutput)
        const command = buildCommand(filePath, language);

        if (!command) {
            console.error(`⚠ Unsupported language: ${language}`);
            return;
        }

        try {
            const actualOutput = execSync(command, { input: inputData, encoding: "utf-8" }).trim();
            console.log(actualOutput)

            if (actualOutput === expectedOutput) {
                console.log(`✅ Test ${i + 1}: PASSED`);
                passed++;
            } else {
                console.log(`❌ Test ${i + 1}: FAILED`);
                console.log(`   Input: ${inputData}`);
                console.log(`   Expected: ${expectedOutput}`);
                console.log(`   Got: ${actualOutput}`);
                failed++;
            }
        } catch (error) {
            console.log(`❌ Test ${i + 1}: Error running test - ${error}`);
            failed++;
        }
    }

    console.log(`\n✅ ${passed}/${passed + failed} test cases passed.`);
    console.log(`❌ ${failed}/${passed + failed} test cases failed.`);
}

/**
 * Build the execution command based on language.
 */
function buildCommand(filePath: string, language: string): string | null {
    const baseName = path.basename(filePath, path.extname(filePath));

    const commands: Record<string, string> = {
        "Python": `python "${filePath}"`,
        "Java": `javac "${filePath}" && java ${baseName}`,
        "C": `gcc "${filePath}" -o "${baseName}.out" && ./"${baseName}.out"`,
        "C++": `g++ "${filePath}" -o "${baseName}.out" && ./"${baseName}.out"`,
        "Go": `go run "${filePath}"`,
        "Rust": `rustc "${filePath}" -o "${baseName}.out" && ./"${baseName}.out"`,
        "JavaScript": `node "${filePath}"`,
        "TypeScript": `tsc "${filePath}" && node "${baseName}.js"`
    };

    return commands[language] || null;
}

/**
 * Activate Test Runner
 */
export function activateTestRunner(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand("codeboost.runTests", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor found.");
            return;
        }
        
        const document = editor.document;
        const language = detectLanguage(document);
        const filePath = document.uri.fsPath;

        if (!language) {
            vscode.window.showErrorMessage("Unsupported file type for testing.");
            return;
        }

        vscode.window.showInformationMessage(`Detecting language: ${language}`);

        const testCases = await generateTestCases(filePath, language);

        if (!testCases) {
            vscode.window.showErrorMessage("Failed to generate test cases.");
            return;
        }

        await runTestCases(filePath, language, testCases);
    });

    context.subscriptions.push(disposable);

    const testButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    testButton.command = "codeboost.runTests";
    testButton.text = "$(beaker) Run Tests";
    testButton.tooltip = "Generate and execute test cases for the current code";
    testButton.show();

    context.subscriptions.push(testButton);
}
