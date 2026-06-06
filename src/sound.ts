// Web Audio API Procedural Sound Synthesizer for Retro Zombie FPS 3D
// This allows high-quality, instant, non-blocking sounds without loading heavy files.

class SoundSystem {
  private ctx: AudioContext | null = null;
  private masterVolume: GainNode | null = null;

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterVolume = this.ctx.createGain();
      this.masterVolume.gain.setValueAtTime(0.3, this.ctx.currentTime); // default comfortable volume
      this.masterVolume.connect(this.ctx.destination);
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  private getContext(): AudioContext | null {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  setVolume(volume: number) {
    if (!this.masterVolume) this.init();
    if (this.masterVolume && this.ctx) {
      this.masterVolume.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), this.ctx.currentTime, 0.05);
    }
  }

  // 1. WEAPON DISCHARGES
  playShoot(isPackAPunched: boolean, delayCoef: number = 1.0) {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;

    const dest = this.masterVolume;
    const now = ctx.currentTime;

    // Create primary oscillator for bullet punch
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(dest);

    if (isPackAPunched) {
      // Futuristic sci-fi laser sound
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.15 * delayCoef);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18 * delayCoef);

      osc.start(now);
      osc.stop(now + 0.2);

      // Add high-pitch laser modulation
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "square";
      osc2.frequency.setValueAtTime(1760, now);
      osc2.frequency.exponentialRampToValueAtTime(440, now + 0.1);
      gain2.gain.setValueAtTime(0.2, now);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc2.connect(gain2);
      gain2.connect(dest);
      osc2.start(now);
      osc2.stop(now + 0.12);
    } else {
      // Kinetic gunshot combining noise and oscillator
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.1);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12 * delayCoef);

      osc.start(now);
      osc.stop(now + 0.15);

      // Noise generator for muzzle flash explosion
      try {
        const bufferSize = ctx.sampleRate * (0.15 * delayCoef);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noiseNode = ctx.createBufferSource();
        noiseNode.buffer = buffer;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = "bandpass";
        noiseFilter.frequency.setValueAtTime(1000, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.12);
        noiseFilter.Q.setValueAtTime(1.0, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.6, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15 * delayCoef);

        noiseNode.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(dest);

        noiseNode.start(now);
      } catch (err) {}
    }
  }

  // 2. RELOAD MECHANICAL CLICKS
  playReload() {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;

    const dest = this.masterVolume;
    const now = ctx.currentTime;

    // First click (magazine release/out)
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = "triangle";
    o1.frequency.setValueAtTime(600, now);
    o1.frequency.setValueAtTime(1200, now + 0.05);
    g1.gain.setValueAtTime(0.15, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    o1.connect(g1);
    g1.connect(dest);
    o1.start(now);
    o1.stop(now + 0.09);

    // Second click (magazine slam in)
    const delay = 0.35;
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = "sine";
    o2.frequency.setValueAtTime(800, now + delay);
    o2.frequency.setValueAtTime(300, now + delay + 0.05);
    g2.gain.setValueAtTime(0.2, now + delay);
    g2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.15);
    o2.connect(g2);
    g2.connect(dest);
    o2.start(now + delay);
    o2.stop(now + delay + 0.2);

    // Third click (slide racking)
    const d3 = 0.65;
    const o3 = ctx.createOscillator();
    const g3 = ctx.createGain();
    o3.type = "sawtooth";
    o3.frequency.setValueAtTime(1000, now + d3);
    o3.frequency.exponentialRampToValueAtTime(200, now + d3 + 0.1);
    g3.gain.setValueAtTime(0.1, now + d3);
    g3.gain.exponentialRampToValueAtTime(0.001, now + d3 + 0.12);
    o3.connect(g3);
    g3.connect(dest);
    o3.start(now + d3);
    o3.stop(now + d3 + 0.15);
  }

  // 3. OUT OF AMMO CLICK
  playOutOfAmmo() {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;

    const dest = this.masterVolume;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.setValueAtTime(900, now + 0.02);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // 4. CASH REGISTER PING (Wall buy / Door buy)
  playBuy() {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;

    const dest = this.masterVolume;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1500, now);
    osc.frequency.setValueAtTime(1800, now + 0.05);
    osc.frequency.setValueAtTime(2100, now + 0.1);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  // Double fail dry sound for locked doors / not enough points
  playFail() {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;

    const dest = this.masterVolume;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(130, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc1.connect(gain1);
    gain1.connect(dest);
    osc1.start(now);
    osc1.stop(now + 0.13);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sawtooth";
    osc2.frequency.setValueAtTime(130, now + 0.1);
    gain2.gain.setValueAtTime(0.15, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

    osc2.connect(gain2);
    gain2.connect(dest);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.24);
  }

  playWoodBoardUp() {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;

    const dest = this.masterVolume;
    const now = ctx.currentTime;

    // Deep woody impact (triangle wave)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.15);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.18);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.2);

    // High snap (click) of hammer striking nail/wood
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = "sine";
    click.frequency.setValueAtTime(1500, now);
    click.frequency.exponentialRampToValueAtTime(400, now + 0.05);

    clickGain.gain.setValueAtTime(0.12, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    click.connect(clickGain);
    clickGain.connect(dest);
    click.start(now);
    click.stop(now + 0.07);
  }

  playWoodTearDown() {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;

    const dest = this.masterVolume;
    const now = ctx.currentTime;

    // Crunchy breaking wood rip (sawtooth)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(50, now + 0.25);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.25);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.28);

    // Crackle scatter sound
    for (let i = 0; i < 3; i++) {
      const crackTime = now + 0.05 + i * 0.06;
      const crack = ctx.createOscillator();
      const crackGain = ctx.createGain();
      crack.type = "triangle";
      crack.frequency.setValueAtTime(120 + Math.random() * 80, crackTime);
      crackGain.gain.setValueAtTime(0.12, crackTime);
      crackGain.gain.exponentialRampToValueAtTime(0.001, crackTime + 0.04);

      crack.connect(crackGain);
      crackGain.connect(dest);
      crack.start(crackTime);
      crack.stop(crackTime + 0.05);
    }
  }

  // 5. ZOMBIE GROWL (Procedural synthesis)
  playZombieGrowl(intensity: number = 0.5) {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;

    const dest = this.masterVolume;
    const now = ctx.currentTime;

    // Pitch sweep starting low and shaking
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    const startFreq = 80 + Math.random() * 50;
    osc.frequency.setValueAtTime(startFreq, now);

    // LFO to shake the growl pitch
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(12 + Math.random() * 8, now); // vibrato rate
    lfoGain.gain.setValueAtTime(25, now); // vibrato depth

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(now);
    lfo.stop(now + 1.2);

    // Bandpass sweep to simulate snarling vocal filter
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(250, now);
    filter.frequency.exponentialRampToValueAtTime(600, now + 0.5);
    filter.frequency.linearRampToValueAtTime(150, now + 1.1);
    filter.Q.setValueAtTime(2.0, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.20 + intensity * 0.15, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.1);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 1.2);
  }

  playDistantScream() {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;

    const dest = this.masterVolume;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
    osc.frequency.exponentialRampToValueAtTime(400, now + 1.5);

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(800, now);
    filter.Q.setValueAtTime(4.0, now);

    // Reverb simulation / Echo
    const delay = ctx.createDelay();
    delay.delayTime.value = 0.4;
    const delayGain = ctx.createGain();
    delayGain.gain.value = 0.3;
    delay.connect(delayGain);
    delayGain.connect(filter);
    
    // Very quiet
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.04, now + 0.2);
    gain.gain.linearRampToValueAtTime(0, now + 2.0);

    osc.connect(filter);
    filter.connect(delay);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + 2.5);
  }

  // Squelch wet hit when shooting a zombie
  playZombieHit(isKill: boolean) {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;

    const dest = this.masterVolume;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.1);

    if (isKill) {
      // Extra heavy splat impact
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sawtooth";
      osc2.frequency.setValueAtTime(70, now);
      osc2.frequency.exponentialRampToValueAtTime(20, now + 0.15);
      gain2.gain.setValueAtTime(0.25, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc2.connect(gain2);
      gain2.connect(dest);
      osc2.start(now);
      osc2.stop(now + 0.2);
    }
  }

  // 6. PERK PURCHASE MUSIC JINGLE
  playPerkPurchase(perkId: string) {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;

    const dest = this.masterVolume;
    const now = ctx.currentTime;

    // Fast 8-bit classic chord jangles custom-tailored per perk
    const notes: number[] = [];
    if (perkId === "juggernog") {
      // Heroic triumphant Juggernog tune: major root tri-tone
      notes.push(261.63, 329.63, 392.00, 523.25, 392.00, 523.25, 659.25); // C4 - E4 - G4 - C5 - G4 - C5 - E5
    } else if (perkId === "speed_cola") {
      // Speedy fast arpeggio
      notes.push(293.66, 349.23, 440.00, 587.33, 440.00, 587.33, 698.46, 880.00); // Dm chord super quick
    } else if (perkId === "double_tap") {
      // Heavy rock vibe
      notes.push(311.13, 233.08, 311.13, 370.00, 466.16, 622.25); // Heavy metal style D#
    } else {
      // Stamin' up: running happy scale
      notes.push(329.63, 415.30, 493.88, 659.25, 493.88, 659.25, 830.61); // E Major
    }

    const noteDuration = 0.08;
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = index % 2 === 0 ? "square" : "triangle";
      osc.frequency.setValueAtTime(freq, now + index * noteDuration);

      gain.gain.setValueAtTime(0.08, now + index * noteDuration);
      gain.gain.setValueAtTime(0.08, now + index * noteDuration + noteDuration * 0.75);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * noteDuration + noteDuration);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now + index * noteDuration);
      osc.stop(now + index * noteDuration + noteDuration + 0.05);
    });
  }

  // 7. POWER UP DROPS PICKUP SOUND
  playPowerUp(type: string) {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;

    const dest = this.masterVolume;
    const now = ctx.currentTime;

    // Eerie, magical sci-fi chime
    const baseFreq = 523.25; // C5
    const multi = type === "nuke" ? 0.75 : type === "insta_kill" ? 1.5 : type === "double_points" ? 1.25 : 1.0;

    const synthScale = [baseFreq * multi, baseFreq * 1.25 * multi, baseFreq * 1.5 * multi, baseFreq * 2.0 * multi];

    synthScale.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.1);

      gain.gain.setValueAtTime(0.12, now + idx * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.4);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now + idx * 0.1);
      osc.stop(now + idx * 0.1 + 0.45);
    });

    // If NUKE, play additional booming base echo!
    if (type === "nuke") {
      const lowOsc = ctx.createOscillator();
      const lowGain = ctx.createGain();
      lowOsc.type = "sawtooth";
      lowOsc.frequency.setValueAtTime(100, now);
      lowOsc.frequency.exponentialRampToValueAtTime(20, now + 0.8);
      lowGain.gain.setValueAtTime(0.6, now);
      lowGain.gain.exponentialRampToValueAtTime(0.01, now + 0.9);
      lowOsc.connect(lowGain);
      lowGain.connect(dest);
      lowOsc.start(now);
      lowOsc.stop(now + 1.0);
    }
  }

  // 8. CO-OP ROUND START HORNS (Dark brass bass cluster)
  playRoundStart() {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;

    const dest = this.masterVolume;
    const now = ctx.currentTime;

    // 3 parallel low sawtooth waves slightly detuned to sound incredibly fat and terrifying
    const frequencies = [73.42, 73.80, 110.00]; // detuned D2/A2 chords
    frequencies.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq * 0.9, now + 1.2);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.15);
      gain.gain.setValueAtTime(0.2, now + 0.9);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(now);
      osc.stop(now + 1.35);
    });

    // High ominous chime overlay
    const highOsc = ctx.createOscillator();
    const highGain = ctx.createGain();
    highOsc.type = "sine";
    highOsc.frequency.setValueAtTime(440, now + 0.1);
    highOsc.frequency.setValueAtTime(415, now + 0.5); // ominous descending minor key flat
    highGain.gain.setValueAtTime(0.1, now + 0.1);
    highGain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    highOsc.connect(highGain);
    highGain.connect(dest);
    highOsc.start(now + 0.1);
    highOsc.stop(now + 1.1);
  }

  playRoundEnd() {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;

    const dest = this.masterVolume;
    const now = ctx.currentTime;

    // Distant chime/bell decaying
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(466.16, now); // A#4
    osc.frequency.setValueAtTime(349.23, now + 0.3); // F4
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 1.6);
  }

  // 9. POWER SWITCH ON (Hum up and metallic clang latch)
  playPowerOn() {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;

    const dest = this.masterVolume;
    const now = ctx.currentTime;

    // Humming sound rising
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(60, now);
    osc.frequency.linearRampToValueAtTime(180, now + 1.0);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.95);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.05);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 1.1);

    // Clang sound on 1.0s mark
    const delay = 0.95;
    const clang = ctx.createOscillator();
    const clangGain = ctx.createGain();
    clang.type = "sawtooth";
    clang.frequency.setValueAtTime(80, now + delay);
    clangGain.gain.setValueAtTime(0.35, now + delay);
    clangGain.gain.exponentialRampToValueAtTime(0.005, now + delay + 0.5);

    clang.connect(clangGain);
    clangGain.connect(dest);
    clang.start(now + delay);
    clang.stop(now + delay + 0.6);
  }

  // 10. PACK-A-PUNCH UPGRADE PROCESS (Sci-fi electrical sweep into major chord ring)
  playPackAPunch() {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;

    const dest = this.masterVolume;
    const now = ctx.currentTime;

    // Rising siren / processing spinner
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(1000, now + 1.5);

    gain.gain.setValueAtTime(0.02, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 1.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 1.55);

    // Dynamic bells on finish
    const chimeTimes = [1.5, 1.6, 1.7];
    const chimeFreqs = [523.25, 659.25, 783.99]; // C Major
    chimeTimes.forEach((time, index) => {
      const chime = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      chime.type = "sine";
      chime.frequency.setValueAtTime(chimeFreqs[index], now + time);
      chimeGain.gain.setValueAtTime(0.2, now + time);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, now + time + 0.8);
      chime.connect(chimeGain);
      chimeGain.connect(dest);
      chime.start(now + time);
      chime.stop(now + time + 0.85);
    });
  }

  private ambientDroneGain: GainNode | null = null;
  private ambientDroneOsc: OscillatorNode | null = null;

  startAmbientDrone() {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;
    if (this.ambientDroneOsc) return; // already playing
    
    this.ambientDroneOsc = ctx.createOscillator();
    this.ambientDroneGain = ctx.createGain();
    
    // Very low, eerie frequency
    this.ambientDroneOsc.type = "sine";
    this.ambientDroneOsc.frequency.setValueAtTime(35, ctx.currentTime);
    
    // LFO to create slow pulsating tension
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(0.1, ctx.currentTime); // 10 second cycle
    lfoGain.gain.setValueAtTime(5, ctx.currentTime); // 5Hz modulation
    lfo.connect(lfoGain);
    lfoGain.connect(this.ambientDroneOsc.frequency);
    lfo.start();
    
    this.ambientDroneGain.gain.setValueAtTime(0, ctx.currentTime);
    this.ambientDroneOsc.connect(this.ambientDroneGain);
    this.ambientDroneGain.connect(this.masterVolume);
    this.ambientDroneOsc.start();
  }

  setAmbientDroneIntensity(intensity: number) {
    if (!this.ambientDroneGain || !this.ctx) return;
    // intensity 0 to 1
    const targetGain = 0.02 + 0.15 * Math.max(0, Math.min(1, intensity));
    this.ambientDroneGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 2.0);
  }

  playHeartbeat() {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;
    const now = ctx.currentTime;
    
    // Deep thump
    const thump = (time: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(50, time);
      osc.frequency.exponentialRampToValueAtTime(30, time + 0.1);
      
      gain.gain.setValueAtTime(0.4, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
      
      osc.connect(gain);
      gain.connect(this.masterVolume!);
      osc.start(time);
      osc.stop(time + 0.25);
    };
    
    thump(now);
    thump(now + 0.25); // the "lub-dub"
  }

  private ambientWindGain: GainNode | null = null;
  private ambientWindBufferSource: AudioBufferSourceNode | null = null;

  startAmbientWind() {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;
    if (this.ambientWindBufferSource) return;

    // Create a noise buffer
    const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise 
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        // Brown noise approximation (low frequencies)
        let lastOut = 0;
        const white = Math.random() * 2 - 1;
        const out = (lastOut + (0.02 * white)) / 1.02;
        lastOut = out;
        data[i] = out * 3.5; 
    }

    this.ambientWindBufferSource = ctx.createBufferSource();
    this.ambientWindBufferSource.buffer = buffer;
    this.ambientWindBufferSource.loop = true;

    // Filter to sweep the wind
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(200, ctx.currentTime);
    
    // Animate filter frequency
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(0.05, ctx.currentTime);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(150, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    this.ambientWindGain = ctx.createGain();
    this.ambientWindGain.gain.setValueAtTime(0.04, ctx.currentTime); // very quiet

    this.ambientWindBufferSource.connect(filter);
    filter.connect(this.ambientWindGain);
    this.ambientWindGain.connect(this.masterVolume);
    this.ambientWindBufferSource.start();
  }

  playPlayerHurt() {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;

    const dest = this.masterVolume;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.linearRampToValueAtTime(40, now + 0.15);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  // 12. GAME OVER SONG (Chooky minor key piano descent)
  playGameOver() {
    const ctx = this.getContext();
    if (!ctx || !this.masterVolume) return;

    const dest = this.masterVolume;
    const now = ctx.currentTime;

    const melody = [220.00, 207.65, 196.00, 185.00, 174.61, 164.81]; // A3 - Ab3 - G3 - F#3 - F3 - E3 (mournful descent)
    melody.forEach((freq, index) => {
      const noteTime = now + index * 0.4;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.15, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.7);

      osc.connect(gain);
      gain.connect(dest);
      osc.start(noteTime);
      osc.stop(noteTime + 0.75);
    });
  }
}

export const sfx = new SoundSystem();
export default sfx;
