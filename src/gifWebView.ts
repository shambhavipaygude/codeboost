export function getPetWebviewContent(): string {
    const petGifUrl = 'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExbmhwcnk5cmx5ZnU1YTRlZTduNDE0d3pyM2k2NHVkemV4eHA0OWVneSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/wSLgAC3rqQljfeQE2f/giphy.gif'; // 🔹 Replace with your GIF URL

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <style>
                body {
                    background-color: transparent;
                    overflow: hidden;
                    margin: 0;
                    padding: 0;
                }
                .pet-container {
                    position: fixed;
                    bottom: 30px; /* Adjust to place above the status bar */
                    left: 10px;
                    z-index: 9999;
                }
                img {
                    max-width: 110px; /* Adjust size as needed */
                }
            </style>
        </head>
        <body>
            <div class="pet-container">
                <img src="${petGifUrl}" alt="Pet">
            </div>
        </body>
        </html>
    `;
}