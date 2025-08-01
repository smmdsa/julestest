// --- Main Game Initialization and Loop ---

/**
 * Initialize all game modules
 */
function initializeGame() {
    // Initialize canvas and generate textures (setup.js)
    initializeCanvas();
    generateTextures();
    setupInputHandlers();

    // Initialize game state after canvas setup (game.js)
    initializeGameState();
}

/**
 * Main game loop - coordinates between game logic and rendering
 */
function gameLoop() {
    updateGameState(); // Update game logic (game.js)
    renderFrame();     // Render the frame (renderer.js)
    requestAnimationFrame(gameLoop);
}

/**
 * Start the game
 */
function startGame() {
    // Initialize all modules
    initializeGame();
    
    // Generate the first level and start the game loop
    generateLevel(1).then(() => {
        gameLoop();

        // Add click to start message
        const startMessage = document.createElement('div');
        startMessage.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            z-index: 1000;
            font-family: 'Courier New', monospace;
        `;
        startMessage.innerHTML = 'Click to Start Game<br><small>Audio will be enabled</small>';
        document.body.appendChild(startMessage);

        canvas.addEventListener('click', function initGameAudio() {
            audioManager.init();
            audioManager.startLoFiSound();
            startMessage.remove();
            canvas.removeEventListener('click', initGameAudio);
            // Set up the ongoing click handler for gameplay
            setupCanvasClickHandler();
        }, { once: true });
    });
}

// Start the game when the page loads
startGame();
