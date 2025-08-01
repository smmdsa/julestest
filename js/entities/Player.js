/**
 * Player class - Extends Entity with player-specific functionality
 * Handles player movement, input processing, and player-specific properties
 */
class Player extends Entity {
    /**
     * Create a new Player instance
     * @param {number} x - Initial X position
     * @param {number} y - Initial Y position
     * @param {Object} config - Configuration object for player properties
     */
    constructor(x, y, config = {}) {
        // Initialize with player-specific health configuration
        const playerConfig = {
            health: config.health || window.MAX_HEALTH || 100,
            type: 'player',
            ...config
        };
        
        super(x, y, playerConfig);
        
        // Direction vectors for raycasting and movement
        this.dirX = config.dirX || -1;
        this.dirY = config.dirY || 0;
        this.planeX = config.planeX || 0;
        this.planeY = config.planeY || 0.66;
        
        // Movement properties
        this.moveSpeed = config.moveSpeed || 0.05;
        this.rotSpeed = config.rotSpeed || 0.03;
        
        // Player-specific properties
        this.shield = config.shield || 0;
        this.maxShield = config.maxShield || window.MAX_SHIELD || 100;
        this.ammo = config.ammo || window.MAX_AMMO_CARRY || 200;
        this.maxAmmo = config.maxAmmo || window.MAX_AMMO_CARRY || 200;
        this.score = config.score || 0;
        this.hasKey = config.hasKey || false;
        this.stepTimer = config.stepTimer || 0;
        
        // Add player movement behavior
        this.addBehavior('movement', new PlayerMovementBehavior(this, {
            moveSpeed: this.moveSpeed,
            rotSpeed: this.rotSpeed
        }));
    }
    
    /**
     * Initialize player-specific properties
     * @param {Object} config - Configuration object
     */
    initialize(config) {
        // Player-specific initialization
        this.lastInputTime = 0;
        this.inputCooldown = 0;
    }
    
    /**
     * Handle input for player movement and actions
     * @param {Object} keys - Key state object from input system
     */
    handleInput(keys) {
        if (!keys) return;
        
        // Delegate movement input to movement behavior
        const movementBehavior = this.getBehavior('movement');
        if (movementBehavior && movementBehavior.handleInput) {
            movementBehavior.handleInput(keys);
        }
        
        // Handle non-movement input
        this.handleActionInput(keys);
    }
    
    /**
     * Handle action input (shooting, reloading, weapon switching)
     * @param {Object} keys - Key state object
     */
    handleActionInput(keys) {
        if (!this.canAct()) return;
        
        // Reload input
        if (keys['KeyR']) {
            this.reload();
        }
        
        // Weapon switching input (only if player can act)
        if (keys['Digit1']) {
            this.switchWeapon('pistol');
        }
        if (keys['Digit2']) {
            this.switchWeapon('shotgun');
        }
        if (keys['Digit3']) {
            this.switchWeapon('machinegun');
        }
    }
    
    /**
     * Player-specific update logic
     * @param {number} deltaTime - Time elapsed since last update
     */
    onUpdate(deltaTime) {
        // Update input cooldown
        if (this.inputCooldown > 0) {
            this.inputCooldown--;
        }
        
        // Handle any player-specific update logic here
        // (Most movement logic is handled by the movement behavior)
    }
    
    /**
     * Override takeDamage to handle shield mechanics
     * @param {number} amount - Amount of damage to take
     * @param {Object} source - Source of the damage
     */
    takeDamage(amount, source = null) {
        if (!this.isActive || amount <= 0) return;
        
        // Calculate shield absorption first
        const shieldDamage = Math.min(this.shield, amount);
        this.shield -= shieldDamage;
        
        // Apply remaining damage to health
        const healthDamage = amount - shieldDamage;
        this.health -= healthDamage;
        
        // Set hit effect duration
        this.isHit = 10;
        
        // Ensure health doesn't go below 0
        if (this.health < 0) {
            this.health = 0;
        }
        
        // Play damage sound
        if (window.audioManager && window.audioManager.play) {
            window.audioManager.play('player_damage');
        }
        
        // Call parent damage handling for any additional logic
        this.onTakeDamage(amount, source);
        
        // Check if player should die
        if (this.health <= 0) {
            this.onDeath(source);
        }
    }
    
    /**
     * Handle player death
     * @param {Object} source - Source that caused death
     */
    onEntityDeath(source) {
        // Ensure player is marked as inactive
        this.isActive = false;
        
        // Game over logic
        const finalScore = this.score;
        const currentLevel = window.gameState ? window.gameState.currentLevel : 1;
        
        // Play death sound if available
        if (window.audioManager && window.audioManager.play) {
            window.audioManager.play('player_death');
        }
        
        // Show game over message and restart
        setTimeout(() => {
            alert(`GAME OVER! Final Score: ${finalScore} on Level ${currentLevel}`);
            document.location.reload();
        }, 100); // Small delay to ensure sound plays
    }
    
    /**
     * Collect a pickup item
     * @param {Object} pickup - Pickup object with type and subType
     * @returns {boolean} True if pickup was collected
     */
    collectPickup(pickup) {
        if (!pickup || !pickup.subType || !this.isActive) return false;
        
        let collected = false;
        let scoreGained = 0;
        
        switch (pickup.subType) {
            case 'ammo':
                if (this.ammo < this.maxAmmo) {
                    const ammoGained = Math.min(30, this.maxAmmo - this.ammo);
                    this.ammo += ammoGained;
                    scoreGained = 10;
                    collected = true;
                }
                break;
                
            case 'health':
                if (this.health < this.maxHealth) {
                    const healthGained = Math.min(25, this.maxHealth - this.health);
                    this.health += healthGained;
                    scoreGained = 10;
                    collected = true;
                }
                break;
                
            case 'shield':
                if (this.shield < this.maxShield) {
                    const shieldGained = Math.min(50, this.maxShield - this.shield);
                    this.shield += shieldGained;
                    scoreGained = 10;
                    collected = true;
                }
                break;
                
            case 'key':
                if (!this.hasKey) {
                    this.hasKey = true;
                    scoreGained = 500;
                    collected = true;
                }
                break;
                
            case 'shotgun':
            case 'machinegun':
                if (this.pickupWeapon(pickup.subType)) {
                    scoreGained = 100;
                    collected = true;
                }
                break;
                
            default:
                // Unknown pickup type
                console.warn(`Unknown pickup type: ${pickup.subType}`);
                return false;
        }
        
        // Add score if pickup was collected
        if (collected && scoreGained > 0) {
            this.addScore(scoreGained);
        }
        
        // Play pickup sound if collected
        if (collected && window.audioManager && window.audioManager.play) {
            window.audioManager.play('pickup');
        }
        
        return collected;
    }
    
    /**
     * Shoot current weapon
     * @returns {boolean} True if weapon was fired successfully
     */
    shoot() {
        if (!this.isActive) return false;
        
        if (window.weaponManager && window.weaponManager.shoot) {
            return window.weaponManager.shoot(this);
        }
        return false;
    }
    
    /**
     * Reload current weapon
     * @returns {boolean} True if reload was started successfully
     */
    reload() {
        if (!this.isActive) return false;
        
        if (window.weaponManager && window.weaponManager.startReload) {
            return window.weaponManager.startReload();
        }
        return false;
    }
    
    /**
     * Switch to a different weapon
     * @param {string} weaponType - Type of weapon to switch to
     * @returns {boolean} True if weapon was switched successfully
     */
    switchWeapon(weaponType) {
        if (!this.isActive) return false;
        
        if (window.weaponManager && window.weaponManager.switchWeapon) {
            return window.weaponManager.switchWeapon(weaponType);
        }
        return false;
    }
    
    /**
     * Pick up a weapon
     * @param {string} weaponType - Type of weapon to pick up
     * @returns {boolean} True if weapon was picked up
     */
    pickupWeapon(weaponType) {
        if (!this.isActive) return false;
        
        if (window.weaponManager && window.weaponManager.pickupWeapon) {
            return window.weaponManager.pickupWeapon(weaponType);
        }
        return false;
    }
    
    /**
     * Get player position for renderer integration
     * @returns {Object} Position object with x, y, direction, and plane vectors
     */
    getPosition() {
        return {
            x: this.x,
            y: this.y,
            dirX: this.dirX,
            dirY: this.dirY,
            planeX: this.planeX,
            planeY: this.planeY
        };
    }
    
    /**
     * Get player health information including shield
     * @returns {Object} Health object with current health, shield, and percentages
     */
    getHealth() {
        return {
            current: this.health,
            max: this.maxHealth,
            percentage: this.maxHealth > 0 ? this.health / this.maxHealth : 0,
            shield: this.shield,
            maxShield: this.maxShield,
            shieldPercentage: this.maxShield > 0 ? this.shield / this.maxShield : 0
        };
    }
    
    /**
     * Get player ammo information
     * @returns {Object} Ammo object with current and max ammo
     */
    getAmmo() {
        return {
            current: this.ammo,
            max: this.maxAmmo,
            percentage: this.maxAmmo > 0 ? this.ammo / this.maxAmmo : 0
        };
    }
    
    /**
     * Get player score
     * @returns {number} Current player score
     */
    getScore() {
        return this.score;
    }
    
    /**
     * Get player key status
     * @returns {boolean} True if player has key
     */
    getHasKey() {
        return this.hasKey;
    }
    
    /**
     * Get player movement properties for renderer
     * @returns {Object} Movement properties object
     */
    getMovementProperties() {
        return {
            moveSpeed: this.moveSpeed,
            rotSpeed: this.rotSpeed,
            stepTimer: this.stepTimer
        };
    }
    
    /**
     * Get all player properties needed by renderer and UI
     * @returns {Object} Complete player state object
     */
    getPlayerState() {
        return {
            position: this.getPosition(),
            health: this.getHealth(),
            ammo: this.getAmmo(),
            score: this.getScore(),
            hasKey: this.getHasKey(),
            movement: this.getMovementProperties(),
            hitState: this.getHitState(),
            isActive: this.isActive
        };
    }
    
    /**
     * Set player direction vectors (for camera rotation)
     * @param {number} dirX - New X direction
     * @param {number} dirY - New Y direction
     * @param {number} planeX - New X plane vector
     * @param {number} planeY - New Y plane vector
     */
    setDirection(dirX, dirY, planeX, planeY) {
        this.dirX = dirX;
        this.dirY = dirY;
        this.planeX = planeX;
        this.planeY = planeY;
    }
    
    /**
     * Add score to player
     * @param {number} points - Points to add
     */
    addScore(points) {
        if (points > 0) {
            this.score += points;
        }
    }
    
    /**
     * Get current weapon information from weapon manager
     * @returns {Object} Current weapon info or null
     */
    getCurrentWeaponInfo() {
        if (window.weaponManager && window.weaponManager.getCurrentWeapon) {
            return {
                weapon: window.weaponManager.getCurrentWeapon(),
                state: window.weaponManager.getCurrentWeaponState(),
                ammoDisplay: window.weaponManager.getAmmoDisplay(),
                weaponName: window.weaponManager.getWeaponName(),
                isReloading: window.weaponManager.isReloading,
                reloadProgress: window.weaponManager.getReloadProgress()
            };
        }
        return null;
    }
    
    /**
     * Check if player can perform actions (not dead, not reloading, etc.)
     * @returns {boolean} True if player can act
     */
    canAct() {
        return this.isActive && this.health > 0;
    }
    
    /**
     * Set player key status
     * @param {boolean} hasKey - Whether player has key
     */
    setHasKey(hasKey) {
        this.hasKey = hasKey;
    }
    
    /**
     * Restore player health
     * @param {number} amount - Amount of health to restore
     */
    restoreHealth(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }
    
    /**
     * Restore player shield
     * @param {number} amount - Amount of shield to restore
     */
    restoreShield(amount) {
        this.shield = Math.min(this.maxShield, this.shield + amount);
    }
    
    /**
     * Add ammo to player
     * @param {number} amount - Amount of ammo to add
     */
    addAmmo(amount) {
        this.ammo = Math.min(this.maxAmmo, this.ammo + amount);
    }
    
    /**
     * Use ammo (called by weapon system)
     * @param {number} amount - Amount of ammo to use
     * @returns {boolean} True if ammo was available and used
     */
    useAmmo(amount) {
        if (!this.isActive || amount <= 0) return false;
        
        if (this.ammo >= amount) {
            this.ammo -= amount;
            return true;
        }
        return false;
    }
    
    /**
     * Check if player has enough ammo
     * @param {number} amount - Amount of ammo to check
     * @returns {boolean} True if player has enough ammo
     */
    hasAmmo(amount) {
        return this.ammo >= amount;
    }
    
    /**
     * Reset player to initial state (for new level)
     */
    reset() {
        this.health = this.maxHealth;
        this.shield = 0;
        this.ammo = this.maxAmmo;
        this.hasKey = false;
        this.stepTimer = 0;
        this.isHit = 0;
        this.isActive = true;
        this.markedForRemoval = false;
    }
}

// Export the Player class
if (typeof window !== 'undefined') {
    window.Player = Player;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = Player;
}