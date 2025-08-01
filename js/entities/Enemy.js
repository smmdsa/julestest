/**
 * Enemy - Base class for all enemy entities
 * Extends Entity with enemy-specific properties and behaviors
 */
class Enemy extends Entity {
    /**
     * Create a new Enemy
     * @param {number} x - Initial X position
     * @param {number} y - Initial Y position
     * @param {string} enemyType - Type of enemy (grunt, sergeant, commander, boss)
     */
    constructor(x, y, enemyType) {
        // Get enemy configuration from ENEMY_TYPES
        const config = window.ENEMY_TYPES ? window.ENEMY_TYPES[enemyType] : null;
        if (!config) {
            console.error(`Enemy: Unknown enemy type '${enemyType}'`);
            // Fallback to basic config
            super(x, y, { health: 100, type: 'enemy', subType: enemyType });
        } else {
            super(x, y, { ...config, type: 'enemy', subType: enemyType });
        }
        
        // Enemy-specific properties
        this.enemyType = enemyType;
        this.state = 'idle';
        this.attackTimer = 0;
        this.deathTimer = 0;
        
        // Store enemy configuration
        this.enemyConfig = config || {
            health: 100,
            damage: 10,
            color: '#00ff00',
            scale: 1.0,
            aspectRatio: 0.8,
            score: 100,
            attackCooldown: 120
        };
        
        // Movement properties
        this.moveSpeed = this.enemyConfig.moveSpeed || 0.02;
        
        // Initialize enemy-specific behaviors
        this.initializeBehaviors();
    }
    
    /**
     * Initialize enemy behaviors based on type
     */
    initializeBehaviors() {
        // Add AI behavior
        if (window.AIBehavior) {
            const aiConfig = {
                sightRange: this.enemyConfig.sightRange || 20,
                attackRange: this.enemyConfig.attackRange || 10,
                chaseRange: this.enemyConfig.chaseRange || 20,
                loseTargetRange: this.enemyConfig.loseTargetRange || 30
            };
            this.addBehavior('ai', new window.AIBehavior(this, aiConfig));
        }
        
        // Add movement behavior
        if (window.EnemyMovementBehavior) {
            const movementConfig = {
                moveSpeed: this.moveSpeed,
                chaseSpeed: this.enemyConfig.chaseSpeed || this.moveSpeed
            };
            this.addBehavior('movement', new window.EnemyMovementBehavior(this, movementConfig));
        }
        
        // Add attack behavior (will be implemented in next task)
        // if (window.AttackBehavior) {
        //     const attackConfig = {
        //         damage: this.enemyConfig.damage,
        //         attackCooldown: this.enemyConfig.attackCooldown,
        //         attackRange: this.enemyConfig.attackRange || 10
        //     };
        //     this.addBehavior('attack', new window.AttackBehavior(this, attackConfig));
        // }
    }
    
    /**
     * Entity-specific update logic
     * @param {number} deltaTime - Time elapsed since last update
     */
    onUpdate(deltaTime) {
        // Update attack timer
        if (this.attackTimer > 0) {
            this.attackTimer--;
        }
        
        // Update death timer if dead
        if (this.state === 'dead') {
            this.deathTimer++;
            if (this.deathTimer >= 30) { // 30 frames = 0.5 seconds at 60fps
                this.markedForRemoval = true;
            }
        }
        
        // Sync AI state with enemy state
        this.syncAIState();
    }
    
    /**
     * Synchronize AI behavior state with enemy state
     */
    syncAIState() {
        const aiBehavior = this.getBehavior('ai');
        if (aiBehavior && aiBehavior.getState) {
            const aiState = aiBehavior.getState();
            if (aiState !== this.state && this.state !== 'dead') {
                this.state = aiState;
            }
        }
    }
    
    /**
     * Check if this enemy can see the player using line of sight
     * @param {Object} player - Player entity or position object
     * @returns {boolean} True if player is visible
     */
    canSeePlayer(player) {
        if (!player) return false;
        
        // Use existing isVisible function if available
        if (window.isVisible) {
            return window.isVisible(this, player);
        }
        
        // Fallback to simple line of sight check
        return this.simpleLineOfSight(player);
    }
    
    /**
     * Simple line of sight check using Bresenham's line algorithm
     * @param {Object} target - Target to check visibility to
     * @returns {boolean} True if target is visible
     */
    simpleLineOfSight(target) {
        if (!window.gameState || !window.gameState.map) return false;
        
        const map = window.gameState.map;
        let x0 = Math.floor(this.x);
        let y0 = Math.floor(this.y);
        let x1 = Math.floor(target.x);
        let y1 = Math.floor(target.y);
        
        const dx = Math.abs(x1 - x0);
        const dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        
        while (true) {
            // Check if current position is a wall
            if (map[y0] && map[y0][x0] === 1) return false;
            
            // Reached target
            if (x0 === x1 && y0 === y1) break;
            
            const e2 = 2 * err;
            if (e2 >= dy) {
                err += dy;
                x0 += sx;
            }
            if (e2 <= dx) {
                err += dx;
                y0 += sy;
            }
        }
        
        return true;
    }
    
    /**
     * Attack the player (placeholder - will be enhanced with AttackBehavior)
     * @param {Object} player - Player entity to attack
     */
    attackPlayer(player) {
        if (!player || this.attackTimer > 0) return;
        
        // Set attack cooldown
        this.attackTimer = this.enemyConfig.attackCooldown;
        
        // Create projectile towards player
        const distance = this.getDistanceTo(player);
        if (distance > 0) {
            const direction = this.getDirectionTo(player);
            
            // Add projectile to game state
            if (window.gameState && window.gameState.sprites) {
                window.gameState.sprites.push({
                    type: 'projectile',
                    x: this.x,
                    y: this.y,
                    dirX: direction.x,
                    dirY: direction.y,
                    speed: 0.1,
                    damage: this.enemyConfig.damage,
                    color: '#FFA500'
                });
            }
        }
    }
    
    /**
     * Handle enemy-specific damage
     * @param {number} amount - Amount of damage taken
     * @param {Object} source - Source of the damage
     */
    onTakeDamage(amount, source) {
        // Play enemy damage sound if available
        if (window.audioManager && window.audioManager.play) {
            window.audioManager.play('enemy_damage');
        }
    }
    
    /**
     * Handle enemy death
     * @param {Object} source - Source that caused death
     */
    onEntityDeath(source) {
        this.state = 'dead';
        this.deathTimer = 0;
        
        // Award score to player
        if (window.gameState && window.gameState.player) {
            window.gameState.player.score += this.enemyConfig.score;
        }
        
        // Handle boss-specific death behavior
        if (this.enemyType === 'boss') {
            this.handleBossDeath();
        }
    }
    
    /**
     * Handle boss-specific death behavior (drop key and spawn exit)
     */
    handleBossDeath() {
        if (!window.gameState || !window.gameState.sprites) return;
        
        // Drop key at boss location
        window.gameState.sprites.push({
            x: this.x,
            y: this.y,
            type: 'pickup',
            subType: 'key'
        });
        
        // Spawn exit door
        if (window.spawnExitDoor) {
            window.spawnExitDoor();
        }
    }
    
    /**
     * Get enemy state for renderer integration
     * @returns {string} Current enemy state
     */
    getState() {
        return this.state;
    }
    
    /**
     * Get enemy type
     * @returns {string} Enemy type
     */
    getEnemyType() {
        return this.enemyType;
    }
    
    /**
     * Get enemy configuration
     * @returns {Object} Enemy configuration object
     */
    getEnemyConfig() {
        return { ...this.enemyConfig };
    }
    
    /**
     * Get enemy visual properties for renderer
     * @returns {Object} Visual properties object
     */
    getVisualProperties() {
        return {
            color: this.enemyConfig.color,
            scale: this.enemyConfig.scale,
            aspectRatio: this.enemyConfig.aspectRatio,
            isHit: this.isHit > 0,
            state: this.state
        };
    }
    
    /**
     * Check if enemy can attack
     * @returns {boolean} True if enemy can attack
     */
    canAttack() {
        return this.attackTimer <= 0 && this.state !== 'dead' && this.isAlive();
    }
    
    /**
     * Set enemy state
     * @param {string} newState - New state to set
     */
    setState(newState) {
        if (this.state !== newState && this.state !== 'dead') {
            this.state = newState;
        }
    }
    
    /**
     * Clean up enemy resources
     */
    onCleanup() {
        // Clean up enemy-specific resources
        this.enemyConfig = null;
        this.attackTimer = 0;
        this.deathTimer = 0;
    }
}

/**
 * GruntEnemy - Basic enemy type
 */
class GruntEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'grunt');
    }
}

/**
 * SergeantEnemy - Intermediate enemy type
 */
class SergeantEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'sergeant');
    }
}

/**
 * CommanderEnemy - Advanced enemy type
 */
class CommanderEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'commander');
    }
}

/**
 * BossEnemy - Boss enemy type with special behaviors
 */
class BossEnemy extends Enemy {
    constructor(x, y) {
        super(x, y, 'boss');
    }
    
    /**
     * Boss-specific update logic
     * @param {number} deltaTime - Time elapsed since last update
     */
    onUpdate(deltaTime) {
        super.onUpdate(deltaTime);
        
        // Boss-specific behavior can be added here
        // For example: special attack patterns, multiple phases, etc.
    }
}

// Export classes
if (typeof window !== 'undefined') {
    window.Enemy = Enemy;
    window.GruntEnemy = GruntEnemy;
    window.SergeantEnemy = SergeantEnemy;
    window.CommanderEnemy = CommanderEnemy;
    window.BossEnemy = BossEnemy;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Enemy, GruntEnemy, SergeantEnemy, CommanderEnemy, BossEnemy };
}