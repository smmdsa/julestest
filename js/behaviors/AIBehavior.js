/**
 * AIBehavior - Implements enemy AI state machine logic
 * Handles state transitions between idle, chasing, and attacking based on player visibility and distance
 */
class AIBehavior {
    /**
     * Create a new AIBehavior
     * @param {Entity} entity - The enemy entity this behavior is attached to
     * @param {Object} config - Configuration object for AI parameters
     */
    constructor(entity, config = {}) {
        this.entity = entity;
        this.config = config;
        
        // AI state machine
        this.state = 'idle';
        this.previousState = 'idle';
        
        // AI parameters from config
        this.sightRange = config.sightRange || 20;
        this.attackRange = config.attackRange || 10;
        this.chaseRange = config.chaseRange || this.sightRange;
        this.loseTargetRange = config.loseTargetRange || this.sightRange * 1.5;
        
        // State timers
        this.stateTimer = 0;
        this.idleTimer = 0;
        this.chaseTimer = 0;
        
        // Target tracking
        this.target = null;
        this.lastKnownTargetPosition = null;
        this.canSeeTarget = false;
        this.distanceToTarget = Infinity;
        
        // Behavior flags
        this.isActive = true;
        this.debugMode = false;
    }
    
    /**
     * Set the entity reference (called by Entity.addBehavior)
     * @param {Entity} entity - The entity this behavior belongs to
     */
    setEntity(entity) {
        this.entity = entity;
    }
    
    /**
     * Update AI behavior and state machine
     * @param {number} deltaTime - Time elapsed since last update
     */
    update(deltaTime) {
        if (!this.isActive || !this.entity || !this.entity.isAlive()) return;
        
        // Update state timer
        this.stateTimer++;
        
        // Get player as default target
        if (!this.target && window.gameState && window.gameState.player) {
            this.target = window.gameState.player;
        }
        
        if (!this.target) return;
        
        // Update target information
        this.updateTargetInfo();
        
        // Execute state machine
        this.executeStateMachine();
        
        // Update movement behavior based on state
        this.updateMovementBehavior();
        
        // Debug output
        if (this.debugMode) {
            this.debugOutput();
        }
    }
    
    /**
     * Update information about the current target
     */
    updateTargetInfo() {
        if (!this.target || !this.entity) return;
        
        // Calculate distance to target
        this.distanceToTarget = this.entity.getDistanceTo(this.target);
        
        // Check line of sight to target
        this.canSeeTarget = this.entity.canSeePlayer ? 
            this.entity.canSeePlayer(this.target) : 
            this.checkLineOfSight(this.target);
        
        // Update last known position if we can see the target
        if (this.canSeeTarget) {
            this.lastKnownTargetPosition = {
                x: this.target.x,
                y: this.target.y
            };
        }
    }
    
    /**
     * Execute the AI state machine logic
     */
    executeStateMachine() {
        const previousState = this.state;
        
        switch (this.state) {
            case 'idle':
                this.handleIdleState();
                break;
                
            case 'chasing':
                this.handleChasingState();
                break;
                
            case 'attacking':
                this.handleAttackingState();
                break;
                
            default:
                console.warn(`AIBehavior: Unknown state ${this.state}, resetting to idle`);
                this.setState('idle');
                break;
        }
        
        // Track state changes
        if (previousState !== this.state) {
            this.onStateChange(previousState, this.state);
        }
    }
    
    /**
     * Handle idle state logic
     */
    handleIdleState() {
        this.idleTimer++;
        
        // Check if we can see the player and they're within sight range
        if (this.canSeeTarget && this.distanceToTarget <= this.sightRange) {
            if (this.distanceToTarget <= this.attackRange) {
                this.setState('attacking');
            } else {
                this.setState('chasing');
            }
        }
    }
    
    /**
     * Handle chasing state logic
     */
    handleChasingState() {
        this.chaseTimer++;
        
        // If we can see the target and they're close enough to attack
        if (this.canSeeTarget && this.distanceToTarget <= this.attackRange) {
            this.setState('attacking');
        }
        // If we can't see the target or they're too far away, go back to idle
        else if (!this.canSeeTarget || this.distanceToTarget > this.loseTargetRange) {
            this.setState('idle');
        }
        // Continue chasing if we can see them and they're within chase range
        else if (this.canSeeTarget && this.distanceToTarget <= this.chaseRange) {
            // Continue chasing - movement handled in updateMovementBehavior
        }
        // Lost target, return to idle
        else {
            this.setState('idle');
        }
    }
    
    /**
     * Handle attacking state logic
     */
    handleAttackingState() {
        // If target moved out of attack range but still visible, chase
        if (this.canSeeTarget && this.distanceToTarget > this.attackRange) {
            if (this.distanceToTarget <= this.chaseRange) {
                this.setState('chasing');
            } else {
                this.setState('idle');
            }
        }
        // If we can't see the target, go back to idle
        else if (!this.canSeeTarget) {
            this.setState('idle');
        }
        // Continue attacking - attack behavior handled by AttackBehavior component
    }
    
    /**
     * Update movement behavior based on current AI state
     */
    updateMovementBehavior() {
        const movementBehavior = this.entity.getBehavior('movement');
        if (!movementBehavior) return;
        
        switch (this.state) {
            case 'idle':
                // Stop movement
                if (movementBehavior.stop) {
                    movementBehavior.stop();
                }
                break;
                
            case 'chasing':
                // Move towards target
                if (movementBehavior.setTarget && this.target) {
                    movementBehavior.setTarget(this.target);
                }
                break;
                
            case 'attacking':
                // Stop movement while attacking (or move slowly)
                if (movementBehavior.stop) {
                    movementBehavior.stop();
                }
                break;
        }
    }
    
    /**
     * Set AI state and reset state timer
     * @param {string} newState - New state to set
     */
    setState(newState) {
        if (this.state !== newState) {
            this.previousState = this.state;
            this.state = newState;
            this.stateTimer = 0;
            
            // Reset state-specific timers
            if (newState === 'idle') {
                this.idleTimer = 0;
            } else if (newState === 'chasing') {
                this.chaseTimer = 0;
            }
        }
    }
    
    /**
     * Handle state change events
     * @param {string} fromState - Previous state
     * @param {string} toState - New state
     */
    onStateChange(fromState, toState) {
        // Override in subclasses for state-specific behavior
        if (this.debugMode) {
            console.log(`AI State Change: ${fromState} -> ${toState}`);
        }
    }
    
    /**
     * Check line of sight to target using existing visibility algorithm
     * @param {Object} target - Target to check visibility to
     * @returns {boolean} True if target is visible
     */
    checkLineOfSight(target) {
        if (!target || !this.entity) return false;
        
        // Use existing isVisible function if available
        if (window.isVisible) {
            return window.isVisible(this.entity, target);
        }
        
        // Fallback: simple line of sight check
        return this.simpleLineOfSight(target);
    }
    
    /**
     * Simple line of sight check using Bresenham's line algorithm
     * @param {Object} target - Target to check visibility to
     * @returns {boolean} True if target is visible
     */
    simpleLineOfSight(target) {
        if (!window.gameState || !window.gameState.map) return false;
        
        const map = window.gameState.map;
        let x0 = Math.floor(this.entity.x);
        let y0 = Math.floor(this.entity.y);
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
     * Get current AI state
     * @returns {string} Current state
     */
    getState() {
        return this.state;
    }
    
    /**
     * Get previous AI state
     * @returns {string} Previous state
     */
    getPreviousState() {
        return this.previousState;
    }
    
    /**
     * Check if AI can see its target
     * @returns {boolean} True if target is visible
     */
    getCanSeeTarget() {
        return this.canSeeTarget;
    }
    
    /**
     * Get distance to current target
     * @returns {number} Distance to target
     */
    getDistanceToTarget() {
        return this.distanceToTarget;
    }
    
    /**
     * Set the target for this AI
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
     * Enable or disable this behavior
     * @param {boolean} active - Whether behavior should be active
     */
    setActive(active) {
        this.isActive = active;
        if (!active) {
            this.setState('idle');
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
     * Enable or disable debug mode
     * @param {boolean} debug - Whether to enable debug output
     */
    setDebugMode(debug) {
        this.debugMode = debug;
    }
    
    /**
     * Output debug information
     */
    debugOutput() {
        console.log(`AI Debug - State: ${this.state}, Distance: ${this.distanceToTarget.toFixed(2)}, CanSee: ${this.canSeeTarget}`);
    }
    
    /**
     * Clean up behavior resources
     */
    cleanup() {
        this.entity = null;
        this.target = null;
        this.lastKnownTargetPosition = null;
        this.isActive = false;
    }
}

// Export the AIBehavior class
if (typeof window !== 'undefined') {
    window.AIBehavior = AIBehavior;
} else if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIBehavior;
}