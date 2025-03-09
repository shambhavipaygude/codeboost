import * as vscode from "vscode";
import { execSync } from "child_process";
import {getBuildCommand, detectLanguage} from "./autoBuild";
import * as fs from "fs";
import axios from "axios";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

async function generateTestCases(
  filePath: string,
  language: string
): Promise<{ input: string; output: string }[] | null> {
  const code = fs.readFileSync(filePath, "utf-8");

  const prompt = `
Analyze the following ${language} code and generate 15 diverse test cases. No input for any testcase can be empty.\n
Ensure that inputs match the expected format used by the program.\n
Return test cases in this JSON format:\n
[
    { "input": "<input_value>", "output": "<expected_output>" },
    ...
]
Make sure outputs strictly match expected program behavior.\n

Code:\n
${code}
`;

  try {
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }
    );

    let rawResponse =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    rawResponse = rawResponse.replace(/```json/g, "").replace(/```/g, "").trim();

    const testCases = JSON.parse(rawResponse);
    return testCases;
  } catch (error) {
    console.error("Error generating test cases:", error);
    return null;
  }
}

async function runTestCases(
    filePath: string,
    language: string,
    testCases: { input: string; output: string }[]
  ): Promise<void> {
    const outputChannel = vscode.window.createOutputChannel("CodeBoost Tests");
    outputChannel.show(true); // show output panel
    outputChannel.appendLine(`Running tests for ${filePath} (${language})\n`);
  
    let passed = 0,
      failed = 0;
  
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const inputData = testCase.input.replace(/\\n/g, "\n").trim();
      const expectedOutput = testCase.output.replace(/\\n/g, "\n").trim();
      
      outputChannel.appendLine(`TEST ${i + 1}:`);
      outputChannel.appendLine(`Input: ${inputData ? `"${inputData}"` : "(empty input)"}`);
      outputChannel.appendLine(`Expected Output: "${expectedOutput}"`);
      const command = getBuildCommand(filePath, language);
      if (!command) {
        outputChannel.appendLine(`⚠ Unsupported language: ${language}`);
        return;
      }
  
      try {
        const actualOutput = execSync(command, {
          input: inputData,
          encoding: "utf-8",
        })
          .trim()
          .replace(/\r\n/g, "\n"); // Normalize line endings
  
        if (actualOutput === expectedOutput) {
          outputChannel.appendLine(`   ✅ PASSED\n`);
          passed++;
        } else {
          outputChannel.appendLine(`   ❌ FAILED`);
          outputChannel.appendLine(`Expected: "${expectedOutput}"`);
          outputChannel.appendLine(`Got:      "${actualOutput}"\n`);
          failed++;
        }
      } catch (error) {
        outputChannel.appendLine(`   ❌ Error running test - ${error}\n`);
        failed++;
      }
    }
    outputChannel.appendLine(`\n✅ ${passed}/${passed + failed} test cases passed.`);
    outputChannel.appendLine(`❌ ${failed}/${passed + failed} test cases failed.\n`);
  
    if (failed > 0) {
      outputChannel.appendLine("⚠ Some tests failed. Ensure your program does not print any input() statements.");
    }
  }
  
export function activateTestRunner(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "codeboost.runTests",
    async () => {
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
      vscode.window.showInformationMessage(`Generating test cases`);
      const testCases = await generateTestCases(filePath, language);

      if (!testCases) {
        vscode.window.showErrorMessage("Failed to generate test cases.");
        return;
      }
      vscode.window.showInformationMessage(`Running test cases`);
      await runTestCases(filePath, language, testCases);
    }
  );

  context.subscriptions.push(disposable);
  const testButton = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  testButton.command = "codeboost.runTests";
  testButton.text = "$(beaker) Run Tests";
  testButton.tooltip = "Generate and execute test cases for the current code";
  testButton.show();

  context.subscriptions.push(testButton);
}
