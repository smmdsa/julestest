/**
 * Base Entity class - provides common functionality for all game objects
 * Implements composition pattern for behaviors and shared entity properties
 */
class Entity {
    /**
     * Create a new Entity
     * @param {number} x - Initial X position
     * @param {number} y - Initial Y position
     * @param {Object} config - Configuration object with entity properties
     */
    constructor(x, y, config = {}) {
        // Position properties
        this.x = x;
        this.y = y;

        // Health and damage properties
        this.health = config.health || 100;
        this.maxHealth = config.health || 100;
        this.isHit = 0; // Hit effect timer

        // Behavior composition system
        this.behaviors = new Map();

        // Entity lifecycle state
        this.isActive = true;
        this.markedForRemoval = false;

        // Additional properties from config
        this.type = config.type || 'entity';
        this.subType = config.subType || null;

        // Initialize entity-specific properties
        this.initialize(config);
    }

    /**
     * Initialize entity-specific properties (override in subclasses)
     * @param {Object} config - Configuration object
     */
    initialize(config) {
        // Override in subclasses for specific initialization
    }

    /**
     * Update entity state and all attached behaviors
     * @param {number} deltaTime - Time elapsed since last update
     */
    update(deltaTime) {
        if (!this.isActive) return;

        // Update hit effect timer
        if (this.isHit > 0) {
            this.isHit--;
        }

        // Update all behaviors
        for (const [name, behavior] of this.behaviors) {
            if (behavior && typeof behavior.update === 'function') {
                behavior.update(deltaTime);
            }
        }

        // Call entity-specific update logic
        this.onUpdate(deltaTime);
    }

    /**
     * Entity-specific update logic (override in subclasses)
     * @param {number} deltaTime - Time elapsed since last update
     */
    onUpdate(deltaTime) {
        // Override in subclasses for specific update logic
    }

    /**
     * Handle damage taken by this entity
     * @param {number} amount - Amount of damage to take
     * @param {Object} source - Source of the damage (optional)
     */
    takeDamage(amount, source = null) {
        if (!this.isActive) return;

        // Apply damage
        this.health -= amount;
        this.isHit = 10; // Set hit effect duration

        // Ensure health doesn't go below 0
        if (this.health < 0) {
            this.health = 0;
        }

        // Call entity-specific damage handling
        this.onTakeDamage(amount, source);

        // Check if entity should die
        if (this.health <= 0) {
            this.onDeath(source);
        }
    }

    /**
     * Entity-specific damage handling (override in subclasses)
     * @param {number} amount - Amount of damage taken
     * @param {Object} source - Source of the damage
     */
    onTakeDamage(amount, source) {
        // Override in subclasses for specific damage handling
    }

    /**
     * Handle entity death
     * @param {Object} source - Source that caused death
     */
    onDeath(source) {
        this.isActive = false;
        this.markedForRemoval = true;

        // Call entity-specific death handling
        this.onEntityDeath(source);
    }

    /**
     * Entity-specific death handling (override in subclasses)
     * @param {Object} source - Source that caused death
     */
    onEntityDeath(source) {
        // Override in subclasses for specific death handling
    }

    /**
     * Add a behavior component to this entity
     * @param {string} name - Name identifier for the behavior
     * @param {Object} behavior - Behavior object with update method
     */
    addBehavior(name, behavior) {
        if (!behavior) {
            console.warn(`Attempted to add null behavior: ${name}`);
            return;
        }

        // Set reference to parent entity in behavior
        if (behavior.setEntity) {
            behavior.setEntity(this);
        } else {
            behavior.entity = this;
        }

        this.behaviors.set(name, behavior);
    }

    /**
     * Get a behavior component by name
     * @param {string} name - Name of the behavior to retrieve
     * @returns {Object|null} The behavior object or null if not found
     */
    getBehavior(name) {
        return this.behaviors.get(name) || null;
    }

    /**
     * Remove a behavior component
     * @param {string} name - Name of the behavior to remove
     */
    removeBehavior(name) {
        const behavior = this.behaviors.get(name);
        if (behavior && behavior.cleanup) {
            behavior.cleanup();
        }
        this.behaviors.delete(name);
    }

    /**
     * Check if entity has a specific behavior
     * @param {string} name - Name of the behavior to check
     * @returns {boolean} True if behavior exists
     */
    hasBehavior(name) {
        return this.behaviors.has(name);
    }

    /**
     * Get entity position for renderer integration
     * @returns {Object} Position object with x and y coordinates
     */
    getPosition() {
        return { x: this.x, y: this.y };
    }

    /**
     * Get entity health information for renderer integration
     * @returns {Object} Health object with current and max health
     */
    getHealth() {
        return {
            current: this.health,
            max: this.maxHealth,
            percentage: this.maxHealth > 0 ? this.health / this.maxHealth : 0
        };
    }

    /**
     * Get hit state for visual effects
     * @returns {number} Hit effect timer value
     */
    getHitState() {
        return this.isHit;
    }

    /**
     * Get entity type information
     * @returns {Object} Type information object
     */
    getTypeInfo() {
        return {
            type: this.type,
            subType: this.subType
        };
    }

    /**
     * Check if entity is alive and active
     * @returns {boolean} True if entity is active and has health > 0
     */
    isAlive() {
        return this.isActive && this.health > 0;
    }

    /**
     * Check if entity should be removed from game
     * @returns {boolean} True if entity should be removed
     */
    shouldRemove() {
        return this.markedForRemoval;
    }

    /**
     * Get distance to another entity or position
     * @param {Entity|Object} target - Target entity or position object with x,y
     * @returns {number} Distance to target
     */
    getDistanceTo(target) {
        const targetX = target.x || target.getPosition().x;
        const targetY = target.y || target.getPosition().y;
        return Math.hypot(this.x - targetX, this.y - targetY);
    }

    /**
     * Get direction vector to another entity or position
     * @param {Entity|Object} target - Target entity or position object with x,y
     * @returns {Object} Normalized direction vector {x, y}
     */
    getDirectionTo(target) {
        const targetX = target.x || target.getPosition().x;
        const targetY = target.y || target.getPosition().y;
        const distance = this.getDistanceTo(target);

        if (distance === 0) return { x: 0, y: 0 };

        return {
            x: (targetX - this.x) / distance,
            y: (targetY - this.y) / distance
        };
    }

    /**
     * Clean up entity resources and behaviors
     */
    cleanup() {
        // Clean up all behaviors
        for (const [name, behavior] of this.behaviors) {
            if (behavior && behavior.cleanup) {
                behavior.cleanup();
            }
        }
        this.behaviors.clear();

        // Mark as inactive
        this.isActive = false;
        this.markedForRemoval = true;

        // Call entity-specific cleanup
        this.onCleanup();
    }

    /**
     * Entity-specific cleanup (override in subclasses)
     */
    onCleanup() {
        // Override in subclasses for specific cleanup
    }
}

// Export the Entity class
if (typeof window !== 'undefined') {
    window.Entity = Entity;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = Entity;
}