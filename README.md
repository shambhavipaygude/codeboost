<a id="readme-top"></a>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#features">Features</a></li>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
  </ol>
</details>

---

## About The Project

**Codeboost** is a powerful **VS Code extension** designed to enhance developer productivity by automating **code completion, bug fixes, and builds**. It helps developers write code faster and with fewer errors by offering **AI-powered suggestions**, **real-time error detection**, and **one-click bug fixing & auto-build**.

---

### Features 

- **AI-powered code completion** - Get real-time code suggestions as you type.  
- **Live bug detection & quick fixes** - Instantly spot and fix errors in your code.  
- **One-click auto-build** - Fix all bugs and compile your code with a single button.  
- **Seamless VS Code integration** - Works smoothly with your coding workflow.  
- **Minimal manual intervention** - Reduces debugging time, allowing you to focus on coding.  

---

### Built With 

- [TypeScript](https://www.typescriptlang.org/)
- [Node.js](https://nodejs.org/)
- [VS Code API](https://code.visualstudio.com/api)
- [Gemini API](https://ai.google.dev/)

---


## Getting Started

Here are some instructions to make your own copy of Codeboost and get started with it locally.

### Prerequisites

  ```sh
  npm install npm@latest -g
  ```

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/shambhavipaygude/codeboost
   ```
2. Install NPM packages
   ```sh
   npm install
   ```
3. Make `.env` file and add your API credentials in it.
   ```js
   API_KEY = 'ENTER YOUR API KEY';
   ```
4. Change git remote url to avoid accidental pushes to base project
   ```sh
   git remote set-url origin https://github.com/shambhavipaygude/codeboost
   git remote -v # confirm the changes
   ```


## Usage
1. After cloning the repository, run these commands in terminal.
   ```sh
   npm run compile
   code .
   ```
2. Press FN + F5 to start deubug console and open Extension Development Host.
   
3. Press Ctrl + Shift + P and type Codeboost.

4. Codeboost is live!

<video src='public/google_hack.mp4' width=180/>

## Workflow 
![Design and Approach](<public/workflow.jpg>) 