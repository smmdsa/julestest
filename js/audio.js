class AudioManager {
    constructor() {
        this.audioCtx = null;
        this.sounds = {};
        this.isMuted = false;
        this.initialized = false;
    }

    init() {
        if (!this.initialized) {
            try {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                this.initialized = true;
                console.log('Audio initialized');
            } catch (e) {
                console.warn('Audio not supported:', e);
            }
        }
    }

    // --- Sound Generation ---

    createSound(name, generator) {
        this.sounds[name] = generator;
    }

    play(name) {
        if (this.isMuted || !this.sounds[name] || !this.audioCtx) return;
        try {
            const sound = this.sounds[name](this.audioCtx);
            sound.source.start(0);
        } catch (e) {
            console.warn('Audio play error:', e);
        }
    }

    startLoFiSound() {
        if (this.isMuted || !this.audioCtx) return;
        const audioCtx = this.audioCtx;
        const bufferSize = 4096;
        const noise = audioCtx.createScriptProcessor(bufferSize, 1, 1);
        let lastOut = 0.0;
        noise.onaudioprocess = (e) => {
            const output = e.outputBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                output[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = output[i];
                output[i] *= 3.5; // (roughly) compensate for gain
            }
        };
        const gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        noise.connect(gainNode);
        gainNode.connect(audioCtx.destination);
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
    }
}

const audioManager = new AudioManager();

// --- SFX Definitions ---

audioManager.createSound('shot', (audioCtx) => {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

    oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

    return { source: oscillator };
});

audioManager.createSound('enemy_damage', (audioCtx) => {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);

    oscillator.frequency.exponentialRampToValueAtTime(220, audioCtx.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

    return { source: oscillator };
});

audioManager.createSound('player_damage', (audioCtx) => {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);

    oscillator.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.2);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);

    return { source: oscillator };
});

audioManager.createSound('step', (audioCtx) => {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(100, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);

    oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

    return { source: oscillator };
});

audioManager.createSound('pickup', (audioCtx) => {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);

    oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

    return { source: oscillator };
});

audioManager.createSound('reload', (audioCtx) => {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(110, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);

    oscillator.frequency.exponentialRampToValueAtTime(55, audioCtx.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

    return { source: oscillator };
});
