/**
 * MovementBehavior - Base class for entity movement and collision detection
 * Provides common movement functionality and collision detection with the map system
 */
class MovementBehavior {
    /**
     * Create a new MovementBehavior
     * @param {Entity} entity - The entity this behavior is attached to
     * @param {Object} config - Configuration object for movement parameters
     */
    constructor(entity, config = {}) {
        this.entity = entity;
        this.moveSpeed = config.moveSpeed || 0.05;
        this.isActive = true;
        
        // Movement state
        this.isMoving = false;
        this.lastMoveTime = 0;
        
        // Delta time support
        this.deltaTimeMultiplier = 1.0;
    }
    
    /**
     * Set the entity reference (called by Entity.addBehavior)
     * @param {Entity} entity - The entity this behavior belongs to
     */
    setEntity(entity) {
        this.entity = entity;
    }
    
    /**
     * Update movement behavior (override in subclasses)
     * @param {number} deltaTime - Time elapsed since last update
     */
    update(deltaTime) {
        if (!this.isActive || !this.entity) return;
        
        // Calculate delta time multiplier for frame-rate independent movement
        this.deltaTimeMultiplier = deltaTime || 1.0;
        
        // Call subclass-specific update logic
        this.onUpdate(deltaTime);
    }
    
    /**
     * Subclass-specific update logic (override in subclasses)
     * @param {number} deltaTime - Time elapsed since last update
     */
    onUpdate(deltaTime) {
        // Override in subclasses for specific movement logic
    }
    
    /**
     * Check collision with walls using the existing map system
     * @param {number} newX - New X position to check
     * @param {number} newY - New Y position to check
     * @returns {boolean} True if collision detected (wall present)
     */
    checkCollision(newX, newY) {
        // Ensure we have access to the game map
        if (!window.gameState || !window.gameState.map) {
            console.warn('MovementBehavior: No map available for collision detection');
            return true; // Assume collision if no map
        }
        
        const map = window.gameState.map;
        const mapHeight = window.gameState.mapHeight;
        const mapWidth = window.gameState.mapWidth;
        
        // Check bounds
        if (newX < 0 || newX >= mapWidth || newY < 0 || newY >= mapHeight) {
            return true; // Out of bounds = collision
        }
        
        // Check if the tile at the new position is a wall (1 = wall, 0 = empty)
        const tileX = Math.floor(newX);
        const tileY = Math.floor(newY);
        
        // Ensure we're within map bounds
        if (tileY < 0 || tileY >= mapHeight || tileX < 0 || tileX >= mapWidth) {
            return true;
        }
        
        return map[tileY][tileX] === 1;
    }
    
    /**
     * Safe movement method that prevents entities from moving into walls
     * @param {number} dirX - X direction component (-1 to 1)
     * @param {number} dirY - Y direction component (-1 to 1)
     * @param {number} speedMultiplier - Optional speed multiplier (default: 1.0)
     * @returns {boolean} True if movement was successful
     */
    move(dirX, dirY, speedMultiplier = 1.0) {
        if (!this.entity || !this.isActive) return false;
        
        // Calculate movement speed with delta time and multiplier
        const actualSpeed = this.moveSpeed * speedMultiplier * this.deltaTimeMultiplier;
        
        // Calculate new position
        const newX = this.entity.x + (dirX * actualSpeed);
        const newY = this.entity.y + (dirY * actualSpeed);
        
        // Check collision for X movement
        const canMoveX = !this.checkCollision(newX, this.entity.y);
        // Check collision for Y movement  
        const canMoveY = !this.checkCollision(this.entity.x, newY);
        
        let moved = false;
        
        // Move in X direction if possible
        if (canMoveX) {
            this.entity.x = newX;
            moved = true;
        }
        
        // Move in Y direction if possible
        if (canMoveY) {
            this.entity.y = newY;
            moved = true;
        }
        
        // Update movement state
        this.isMoving = moved;
        if (moved) {
            this.lastMoveTime = Date.now();
        }
        
        return moved;
    }
    
    /**
     * Move towards a target position
     * @param {Object} target - Target with x,y properties or Entity
     * @param {number} speedMultiplier - Optional speed multiplier (default: 1.0)
     * @returns {boolean} True if movement was successful
     */
    moveTowards(target, speedMultiplier = 1.0) {
        if (!this.entity || !target) return false;
        
        // Get target position
        const targetX = target.x || (target.getPosition && target.getPosition().x) || 0;
        const targetY = target.y || (target.getPosition && target.getPosition().y) || 0;
        
        // Calculate direction
        const distance = Math.hypot(targetX - this.entity.x, targetY - this.entity.y);
        
        if (distance === 0) return false;
        
        const dirX = (targetX - this.entity.x) / distance;
        const dirY = (targetY - this.entity.y) / distance;
        
        return this.move(dirX, dirY, speedMultiplier);
    }
    
    /**
     * Move away from a target position
     * @param {Object} target - Target with x,y properties or Entity
     * @param {number} speedMultiplier - Optional speed multiplier (default: 1.0)
     * @returns {boolean} True if movement was successful
     */
    moveAwayFrom(target, speedMultiplier = 1.0) {
        if (!this.entity || !target) return false;
        
        // Get target position
        const targetX = target.x || (target.getPosition && target.getPosition().x) || 0;
        const targetY = target.y || (target.getPosition && target.getPosition().y) || 0;
        
        // Calculate direction (opposite)
        const distance = Math.hypot(targetX - this.entity.x, targetY - this.entity.y);
        
        if (distance === 0) return false;
        
        const dirX = -(targetX - this.entity.x) / distance;
        const dirY = -(targetY - this.entity.y) / distance;
        
        return this.move(dirX, dirY, speedMultiplier);
    }
    
    /**
     * Stop movement
     */
    stop() {
        this.isMoving = false;
    }
    
    /**
     * Check if entity is currently moving
     * @returns {boolean} True if entity moved recently
     */
    getIsMoving() {
        return this.isMoving;
    }
    
    /**
     * Get current movement speed
     * @returns {number} Current movement speed
     */
    getMoveSpeed() {
        return this.moveSpeed;
    }
    
    /**
     * Set movement speed
     * @param {number} speed - New movement speed
     */
    setMoveSpeed(speed) {
        this.moveSpeed = Math.max(0, speed);
    }
    
    /**
     * Enable or disable this behavior
     * @param {boolean} active - Whether behavior should be active
     */
    setActive(active) {
        this.isActive = active;
        if (!active) {
            this.stop();
        }
    }
    
    /**
     * Check if behavior is active
     * @returns {boolean} True if behavior is active
     */
    getIsActive() {
        return this.isActive;
    }
    
    /**
     * Clean up behavior resources
     */
    cleanup() {
        this.entity = null;
        this.isActive = false;
        this.isMoving = false;
    }
}

/**
 * PlayerMovementBehavior - Handles player-specific movement with input processing
 */
class PlayerMovementBehavior extends MovementBehavior {
    /**
     * Create a new PlayerMovementBehavior
     * @param {Entity} entity - The player entity
     * @param {Object} config - Configuration object
     */
    constructor(entity, config = {}) {
        super(entity, config);
        
        // Player-specific movement properties
        this.rotSpeed = config.rotSpeed || 0.03;
        this.stepSoundInterval = 15; // Frames between step sounds
    }
    
    /**
     * Update player movement based on input
     * @param {number} deltaTime - Time elapsed since last update
     */
    onUpdate(deltaTime) {
        if (!this.entity || !window.keys) return;
        
        const keys = window.keys;
        this.handleInput(keys);
    }
    
    /**
     * Handle step sound timing
     * @param {boolean} isMoving - Whether the player is currently moving
     */
    handleStepSounds(isMoving) {
        if (!this.entity) return;
        
        if (isMoving) {
            // Use the player's stepTimer property
            if (this.entity.stepTimer !== undefined) {
                this.entity.stepTimer++;
                if (this.entity.stepTimer >= this.stepSoundInterval) {
                    // Play step sound if audio manager is available
                    if (window.audioManager && window.audioManager.play) {
                        window.audioManager.play('step');
                    }
                    this.entity.stepTimer = 0;
                }
            }
        } else {
            // Reset step timer when not moving
            if (this.entity.stepTimer !== undefined) {
                this.entity.stepTimer = 0;
            }
        }
    }
    
    /**
     * Handle input for player movement (can be called directly)
     * @param {Object} inputKeys - Key state object
     * @returns {boolean} True if any movement occurred
     */
    handleInput(inputKeys) {
        if (!inputKeys || !this.entity) return false;
        
        let moved = false;
        
        // Get player direction vectors
        const dirX = this.entity.dirX || 0;
        const dirY = this.entity.dirY || 0;
        const planeX = this.entity.planeX || 0;
        const planeY = this.entity.planeY || 0;
        
        // Process movement input
        if (inputKeys['KeyW'] || inputKeys['ArrowUp']) {
            moved = this.move(dirX, dirY) || moved;
        }
        if (inputKeys['KeyS'] || inputKeys['ArrowDown']) {
            moved = this.move(-dirX, -dirY) || moved;
        }
        if (inputKeys['KeyD']) {
            moved = this.move(planeX, planeY) || moved;
        }
        if (inputKeys['KeyA']) {
            moved = this.move(-planeX, -planeY) || moved;
        }
        
        // Handle step sounds
        this.handleStepSounds(moved);
        
        return moved;
    }
}

/**
 * EnemyMovementBehavior - Handles enemy movement towards targets
 */
class EnemyMovementBehavior extends MovementBehavior {
    /**
     * Create a new EnemyMovementBehavior
     * @param {Entity} entity - The enemy entity
     * @param {Object} config - Configuration object
     */
    constructor(entity, config = {}) {
        super(entity, config);
        
        // Enemy-specific movement properties
        this.target = null;
        this.chaseSpeed = config.chaseSpeed || 0.02;
        this.pathfindingEnabled = config.pathfindingEnabled || false;
    }
    
    /**
     * Update enemy movement towards target
     * @param {number} deltaTime - Time elapsed since last update
     */
    onUpdate(deltaTime) {
        if (!this.target || !this.entity) return;
        
        // Move towards target using chase speed
        this.moveTowards(this.target, this.chaseSpeed / this.moveSpeed);
    }
    
    /**
     * Set the target to move towards
     * @param {Object} target - Target entity or position
     */
    setTarget(target) {
        this.target = target;
    }
    
    /**
     * Get current target
     * @returns {Object|null} Current target
     */
    getTarget() {
        return this.target;
    }
    
    /**
     * Clear current target
     */
    clearTarget() {
        this.target = null;
        this.stop();
    }
}

// Export classes
if (typeof window !== 'undefined') {
    window.MovementBehavior = MovementBehavior;
    window.PlayerMovementBehavior = PlayerMovementBehavior;
    window.EnemyMovementBehavior = EnemyMovementBehavior;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MovementBehavior, PlayerMovementBehavior, EnemyMovementBehavior };
}