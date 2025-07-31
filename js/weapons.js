// --- Weapon System ---

const WEAPON_TYPES = {
    'pistol': {
        name: 'Simple Gun',
        clipSize: 15,
        damage: 50,
        fireRate: 1, // bullets per click
        fireDelay: 0, // frames between shots in burst
        bulletSpeed: 0.2,
        bulletColor: '#FFFF00',
        reloadTime: 60, // frames
        spread: 0, // bullet spread in radians
        sound: 'shot',
        pickupColor: '#C0C0C0'
    },
    'shotgun': {
        name: 'Gunshot',
        clipSize: 2,
        damage: 40,
        fireRate: 5, // bullets per click (pellets)
        fireDelay: 2, // frames between pellets
        bulletSpeed: 0.15,
        bulletColor: '#FF8C00', 
        reloadTime: 100, // frames (slower reload)
        spread: 0.1, // wider spread
        sound: 'shotgun_blast',
        pickupColor: '#8B4513'
    },
    'machinegun': {
        name: 'Machine Gun',
        clipSize: 100,
        damage: 25,
        fireRate: 1,
        fireDelay: 0,
        bulletSpeed: 0.25,
        bulletColor: '#FF0000',
        reloadTime: 180, // frames (longest reload)
        spread: 0.1, // slight spread
        sound: 'machine_gun',
        pickupColor: '#2F4F4F'
    }
};

class WeaponManager {
    constructor() {
        this.currentWeapon = 'pistol';
        this.weapons = {};
        this.fireTimer = 0;
        this.reloadTimer = 0;
        this.burstCount = 0;
        this.isReloading = false;
        
        // Initialize all weapons
        for (const weaponType in WEAPON_TYPES) {
            this.weapons[weaponType] = {
                owned: weaponType === 'pistol', // Start with pistol
                clipAmmo: weaponType === 'pistol' ? WEAPON_TYPES[weaponType].clipSize : 0
            };
        }
    }

    getCurrentWeapon() {
        return WEAPON_TYPES[this.currentWeapon];
    }

    getCurrentWeaponState() {
        return this.weapons[this.currentWeapon];
    }

    canShoot() {
        const weapon = this.getCurrentWeapon();
        const weaponState = this.getCurrentWeaponState();
        return weaponState.clipAmmo > 0 && this.fireTimer <= 0 && !this.isReloading;
    }

    shoot(player) {
        if (!this.canShoot()) return false;

        const weapon = this.getCurrentWeapon();
        const weaponState = this.getCurrentWeaponState();
        
        // Start burst fire
        this.burstCount = weapon.fireRate;
        this.fireTimer = weapon.fireDelay;
        
        this.fireBullet(player, weapon);
        weaponState.clipAmmo--;
        
        // Play weapon sound
        audioManager.play(weapon.sound);
        
        return true;
    }

    fireBullet(player, weapon) {
        // Calculate spread
        const baseAngle = Math.atan2(player.dirY, player.dirX);
        const spreadAngle = (Math.random() - 0.5) * weapon.spread;
        const finalAngle = baseAngle + spreadAngle;
        
        const dirX = Math.cos(finalAngle);
        const dirY = Math.sin(finalAngle);
        
        // Create bullet
        gameState.sprites.push({
            type: 'playerBullet',
            x: player.x,
            y: player.y,
            dirX: dirX,
            dirY: dirY,
            speed: weapon.bulletSpeed,
            damage: weapon.damage,
            color: weapon.bulletColor,
            lifetime: 100
        });
    }

    update() {
        // Handle fire timer
        if (this.fireTimer > 0) {
            this.fireTimer--;
            
            // Continue burst fire
            if (this.fireTimer <= 0 && this.burstCount > 1) {
                const weapon = this.getCurrentWeapon();
                const weaponState = this.getCurrentWeaponState();
                
                if (weaponState.clipAmmo > 0) {
                    this.fireBullet(gameState.player, weapon);
                    weaponState.clipAmmo--;
                    this.burstCount--;
                    this.fireTimer = weapon.fireDelay;
                } else {
                    this.burstCount = 0;
                }
            }
        }

        // Handle reload timer
        if (this.reloadTimer > 0) {
            this.reloadTimer--;
            if (this.reloadTimer <= 0) {
                this.finishReload();
            }
        }
    }

    startReload() {
        if (this.isReloading) return false;
        
        const weapon = this.getCurrentWeapon();
        const weaponState = this.getCurrentWeaponState();
        const player = gameState.player;
        
        const ammoNeeded = weapon.clipSize - weaponState.clipAmmo;
        if (ammoNeeded <= 0 || player.ammo <= 0) return false;
        
        this.isReloading = true;
        this.reloadTimer = weapon.reloadTime;
        this.burstCount = 0; // Stop any burst fire
        
        audioManager.play('reload');
        return true;
    }

    finishReload() {
        const weapon = this.getCurrentWeapon();
        const weaponState = this.getCurrentWeaponState();
        const player = gameState.player;
        
        const ammoNeeded = weapon.clipSize - weaponState.clipAmmo;
        const ammoToMove = Math.min(ammoNeeded, player.ammo);
        
        weaponState.clipAmmo += ammoToMove;
        player.ammo -= ammoToMove;
        
        this.isReloading = false;
    }

    switchWeapon(weaponType) {
        if (!this.weapons[weaponType] || !this.weapons[weaponType].owned) return false;
        
        this.currentWeapon = weaponType;
        this.burstCount = 0;
        this.fireTimer = 0;
        
        return true;
    }

    pickupWeapon(weaponType) {
        if (!WEAPON_TYPES[weaponType]) return false;
        
        const wasOwned = this.weapons[weaponType].owned;
        this.weapons[weaponType].owned = true;
        
        // If it's a new weapon, give it some ammo
        if (!wasOwned) {
            this.weapons[weaponType].clipAmmo = WEAPON_TYPES[weaponType].clipSize;
            this.switchWeapon(weaponType);
        }
        
        return true;
    }

    getAmmoDisplay() {
        const weaponState = this.getCurrentWeaponState();
        return `${weaponState.clipAmmo} / ${gameState.player.ammo}`;
    }

    getWeaponName() {
        return this.getCurrentWeapon().name;
    }

    getReloadProgress() {
        if (!this.isReloading) return 0;
        const weapon = this.getCurrentWeapon();
        return 1 - (this.reloadTimer / weapon.reloadTime);
    }
}

// Global weapon manager instance
const weaponManager = new WeaponManager();