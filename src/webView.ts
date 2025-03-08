export function getWebviewContent(suggestions: {type: string; fix: string }[]) {
    const suggestionHTML = suggestions
        .map(s => `
            <tr>
                <td>${s.type}</td>
                <td>${s.fix}</td>
                <td><button onclick="sendFixToVSCode('${s.type.replace(/'/g, "\\'")}', '${s.fix.replace(/'/g, "\\'")}')">Apply Fix</button></td>
            </tr>
        `)
        .join("");

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CodeBoost Sidebar</title>
        <style>
        @font-face {
            font-family: 'PixelFont';
            src: url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
            font-display: swap;
        }
        
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: 'Press Start 2P', monospace;
            background-color: #1a1a2e;
            color: #ffffff;
            padding: 20px;
            line-height: 1.5;
            text-shadow: 2px 2px 0px #000000;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            border: 4px solid #ffffff;
            padding: 4px;
            background-color: #000000;
        }
        
        .header {
            background-color: #ffd700;
            color: #000000;
            padding: 15px;
            text-align: center;
            font-size: 20px;
            text-shadow: 2px 2px 0px #996600;
            border-bottom: 4px solid #ffffff;
            position: relative;
            overflow: hidden;
        }
        
        .header::before, .header::after {
            content: "⚡";
            position: absolute;
            font-size: 24px;
            top: 50%;
            transform: translateY(-50%);
        }
        
        .header::before {
            left: 20px;
        }
        
        .header::after {
            right: 20px;
        }
        
        .table-container {
            padding: 15px;
            background-color: #16213e;
            border: 4px solid #ffffff;
            margin: 10px;
        }
        
        table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0 4px;
            font-size: 12px;
        }
        
        th {
            background-color: #ff00ff;
            color: #000000;
            padding: 12px 8px;
            text-align: left;
            text-shadow: 1px 1px 0px #ffffff;
            border: 2px solid #ffffff;
        }
        
        td {
            padding: 10px 8px;
            border: 2px solid #ffffff;
            background-color: #0f3460;
        }
        
        tr:hover td {
            background-color: #533483;
        }
        
        .pixel-button {
            background-color: #00ff00;
            color: #000000;
            border: none;
            padding: 8px 12px;
            cursor: pointer;
            font-family: 'Press Start 2P', monospace;
            font-size: 10px;
            text-transform: uppercase;
            border: 2px solid #ffffff;
            box-shadow: 3px 3px 0px #000000;
            text-shadow: 1px 1px 0px #ffffff;
            transition: all 0.1s;
        }
        
        .pixel-button:hover {
            background-color: #66ff66;
            transform: translate(1px, 1px);
            box-shadow: 2px 2px 0px #000000;
        }
        
        .pixel-button:active {
            background-color: #00cc00;
            transform: translate(3px, 3px);
            box-shadow: 0px 0px 0px #000000;
        }
        
        .footer {
            text-align: center;
            padding: 10px;
            font-size: 10px;
            color: #ffd700;
            margin-top: 10px;
        }
        
        /* Pixel art decorations */
        .pixel-decoration {
            display: inline-block;
            width: 10px;
            height: 10px;
            background-color: #ffffff;
            margin: 0 5px;
        }
        
        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            
            .header {
                font-size: 16px;
            }
            
            table {
                font-size: 10px;
            }
            
            .pixel-button {
                padding: 6px 8px;
                font-size: 8px;
            }
        }
    </style>
    </head>
    <body>
        <div class="container">
        <div class="header">
            <span class="pixel-decoration"></span>
            CODEBOOST POWER-UPS
            <span class="pixel-decoration"></span>
        </div>
        
        <div class="table-container">
            <table>
                <tr>
                    <th>BUG TYPE</th>
                    <th>POWER-UP</th>
                    <th>ACTIVATE</th>
                </tr>
                ${suggestionHTML}
            </table>
        </div>
        
        <div class="footer">
            MADE WITH 🩷 BY CODER
        </div>
    </div>
        <script>
        const vscode = acquireVsCodeApi();
        function sendFixToVSCode(errorType, fix) {
            vscode.postMessage({ command: "applyFix", errorType: errorType, fix: fix });
        }
    </script>

    </body>
    </html>`;
}


