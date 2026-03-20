const TEMPO = 112;
const STEPS_PER_BAR = 16;

export class AudioEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.musicBus = null;
    this.sfxBus = null;
    this.compressor = null;
    this.musicDelay = null;
    this.musicDelayFeedback = null;
    this.musicDelayFilter = null;
    this.musicDelayWet = null;
    this.noiseBuffer = null;
    this.enabled = true;
    this.unlocked = false;
    this.schedulerId = null;
    this.nextMusicTime = 0;
    this.musicStep = 0;
    this.tempo = TEMPO;
    this.progression = [
      {
        root: 45,
        pad: [57, 60, 64, 67],
        arp: [69, 72, 76, 79]
      },
      {
        root: 41,
        pad: [53, 57, 60, 64],
        arp: [65, 69, 72, 76]
      },
      {
        root: 48,
        pad: [60, 64, 67, 71],
        arp: [72, 76, 79, 83]
      },
      {
        root: 43,
        pad: [55, 59, 62, 67],
        arp: [67, 71, 74, 79]
      }
    ];
    this.bassPattern = [0, null, 7, null, 12, null, 7, null, 0, null, 7, null, 12, null, 7, 10];
    this.arpPattern = [0, 2, 1, 3, 2, 1, 3, 1];
  }

  async unlock() {
    if (!this.context) {
      this._createGraph();
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    this.unlocked = true;
    this._syncEnabledState();
  }

  toggle() {
    this.enabled = !this.enabled;
    this._syncEnabledState();
    return this.enabled;
  }

  playSelect() {
    const now = this._now();
    if (now == null) {
      return;
    }

    this._pluck(this._midiToFreq(79), now, {
      duration: 0.14,
      gain: 0.035,
      type: "triangle",
      destination: this.sfxBus,
      brightness: 3400,
      pan: -0.2
    });
    this._pluck(this._midiToFreq(83), now + 0.025, {
      duration: 0.12,
      gain: 0.028,
      type: "triangle",
      destination: this.sfxBus,
      brightness: 3800,
      pan: 0.2
    });
  }

  playPlace() {
    const now = this._now();
    if (now == null) {
      return;
    }

    this._kick(now, 0.24, 122);
    this._pluck(this._midiToFreq(52), now + 0.02, {
      duration: 0.2,
      gain: 0.04,
      type: "square",
      destination: this.sfxBus,
      brightness: 1600,
      pan: 0
    });
    this._noiseBurst(now + 0.01, {
      duration: 0.05,
      gain: 0.012,
      filterFrequency: 2600,
      filterType: "bandpass",
      q: 1.2,
      destination: this.sfxBus
    });
  }

  playClear(lineCount, comboDepth) {
    const now = this._now();
    if (now == null) {
      return;
    }

    const accent = Math.max(1, Math.min(lineCount, 4));
    const root = 74 + accent * 2 + Math.min(comboDepth, 3);
    this._kick(now, 0.34 + accent * 0.06, 132);
    this._pluck(this._midiToFreq(root), now + 0.04, {
      duration: 0.22,
      gain: 0.055,
      type: "triangle",
      destination: this.sfxBus,
      brightness: 3200,
      pan: -0.15
    });
    this._pluck(this._midiToFreq(root + 4), now + 0.08, {
      duration: 0.24,
      gain: 0.05,
      type: "triangle",
      destination: this.sfxBus,
      brightness: 3600,
      pan: 0.15
    });
    this._pluck(this._midiToFreq(root + 7), now + 0.12, {
      duration: 0.26,
      gain: 0.045,
      type: "sawtooth",
      destination: this.sfxBus,
      brightness: 2800,
      pan: 0
    });
    this._noiseBurst(now + 0.02, {
      duration: 0.12,
      gain: 0.014 + accent * 0.004,
      filterFrequency: 1800 + accent * 250,
      filterType: "bandpass",
      q: 0.9,
      destination: this.sfxBus
    });
  }

  playCascade(comboDepth) {
    const now = this._now();
    if (now == null) {
      return;
    }

    const root = 71 + Math.min(comboDepth, 4);
    this._pluck(this._midiToFreq(root), now, {
      duration: 0.16,
      gain: 0.032,
      type: "triangle",
      destination: this.sfxBus,
      brightness: 3000,
      pan: -0.22
    });
    this._pluck(this._midiToFreq(root + 4), now + 0.04, {
      duration: 0.16,
      gain: 0.028,
      type: "triangle",
      destination: this.sfxBus,
      brightness: 3200,
      pan: 0.22
    });
    this._pluck(this._midiToFreq(root + 7), now + 0.08, {
      duration: 0.18,
      gain: 0.03,
      type: "triangle",
      destination: this.sfxBus,
      brightness: 3400,
      pan: 0
    });
  }

  playCombo(comboDepth) {
    const now = this._now();
    if (now == null) {
      return;
    }

    const chord = [81, 84, 88];
    this._pad(chord, now, 1.6, 0.026 + comboDepth * 0.003);
    this._kick(now + 0.04, 0.42, 138);
    this._kick(now + 0.22, 0.2, 122);
  }

  playGameOver() {
    const now = this._now();
    if (now == null) {
      return;
    }

    this._bass(45, now, 0.34, 0.09);
    this._bass(41, now + 0.18, 0.34, 0.08);
    this._bass(38, now + 0.36, 0.42, 0.075);
    this._noiseBurst(now + 0.08, {
      duration: 0.3,
      gain: 0.014,
      filterFrequency: 700,
      filterType: "lowpass",
      q: 0.7,
      destination: this.sfxBus
    });
  }

  _createGraph() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioCtx();

    this.master = this.context.createGain();
    this.master.gain.value = 0.0001;

    this.musicBus = this.context.createGain();
    this.musicBus.gain.value = 0.42;

    this.sfxBus = this.context.createGain();
    this.sfxBus.gain.value = 0.78;

    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 14;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.18;

    this.musicDelay = this.context.createDelay(0.5);
    this.musicDelay.delayTime.value = 0.23;

    this.musicDelayFilter = this.context.createBiquadFilter();
    this.musicDelayFilter.type = "lowpass";
    this.musicDelayFilter.frequency.value = 2400;

    this.musicDelayWet = this.context.createGain();
    this.musicDelayWet.gain.value = 0.28;

    this.musicDelayFeedback = this.context.createGain();
    this.musicDelayFeedback.gain.value = 0.24;

    this.musicBus.connect(this.compressor);
    this.sfxBus.connect(this.compressor);
    this.compressor.connect(this.master);
    this.master.connect(this.context.destination);

    this.musicBus.connect(this.musicDelay);
    this.musicDelay.connect(this.musicDelayFilter);
    this.musicDelayFilter.connect(this.musicDelayWet);
    this.musicDelayWet.connect(this.master);
    this.musicDelayFilter.connect(this.musicDelayFeedback);
    this.musicDelayFeedback.connect(this.musicDelay);

    this.noiseBuffer = this._createNoiseBuffer();
  }

  _syncEnabledState() {
    if (!this.context || !this.master) {
      return;
    }

    const now = this.context.currentTime;
    const target = this.enabled && this.unlocked ? 0.8 : 0.0001;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(Math.max(this.master.gain.value, 0.0001), now);
    this.master.gain.exponentialRampToValueAtTime(target, now + 0.18);

    if (this.enabled && this.unlocked) {
      this._startMusic();
    } else {
      this._stopMusic();
    }
  }

  _startMusic() {
    if (!this._ready() || this.schedulerId) {
      return;
    }

    this.musicStep = 0;
    this.nextMusicTime = this.context.currentTime + 0.06;
    this.schedulerId = window.setInterval(() => this._tickMusic(), 120);
  }

  _stopMusic() {
    if (this.schedulerId) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
  }

  _tickMusic() {
    if (!this._ready()) {
      return;
    }

    const scheduleAhead = 0.45;
    const secondsPerStep = 60 / this.tempo / 4;
    while (this.nextMusicTime < this.context.currentTime + scheduleAhead) {
      this._scheduleMusicStep(this.musicStep, this.nextMusicTime);
      this.nextMusicTime += secondsPerStep;
      this.musicStep = (this.musicStep + 1) % (STEPS_PER_BAR * this.progression.length);
    }
  }

  _scheduleMusicStep(step, time) {
    const barIndex = Math.floor(step / STEPS_PER_BAR) % this.progression.length;
    const stepInBar = step % STEPS_PER_BAR;
    const chord = this.progression[barIndex];
    const bassInterval = this.bassPattern[stepInBar];

    if (stepInBar === 0) {
      this._pad(chord.pad, time, 3.2, 0.028);
    }

    if (stepInBar === 0 || stepInBar === 4 || stepInBar === 8 || stepInBar === 12) {
      this._kick(time, 0.2, 116);
    }

    if (stepInBar === 2 || stepInBar === 6 || stepInBar === 10 || stepInBar === 14) {
      this._hat(time, false);
    }

    if (stepInBar === 7 || stepInBar === 15) {
      this._hat(time, true);
    }

    if (bassInterval != null) {
      const bassGain = bassInterval === 12 ? 0.09 : 0.075;
      const bassDuration = bassInterval === 12 ? 0.34 : 0.22;
      this._bass(chord.root + bassInterval, time, bassDuration, bassGain);
    }

    if (stepInBar % 2 === 1) {
      const arpIndex = this.arpPattern[(stepInBar - 1) / 2];
      const note = chord.arp[arpIndex];
      this._pluck(this._midiToFreq(note), time, {
        duration: 0.16,
        gain: 0.024,
        type: "triangle",
        destination: this.musicBus,
        brightness: 2600,
        pan: Math.sin(step * 0.55) * 0.34
      });
    }
  }

  _kick(time, gainValue, peakFrequency) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(peakFrequency, time);
    osc.frequency.exponentialRampToValueAtTime(44, time + 0.18);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(gainValue, time + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxBus);

    osc.start(time);
    osc.stop(time + 0.24);

    this._noiseBurst(time, {
      duration: 0.025,
      gain: 0.007,
      filterFrequency: 3000,
      filterType: "bandpass",
      q: 1.1,
      destination: this.sfxBus
    });
  }

  _hat(time, open) {
    this._noiseBurst(time, {
      duration: open ? 0.12 : 0.05,
      gain: open ? 0.01 : 0.008,
      filterFrequency: open ? 7200 : 8600,
      filterType: "highpass",
      q: 0.8,
      destination: this.musicBus,
      pan: open ? 0.18 : -0.12
    });
  }

  _bass(midi, time, duration, gainValue) {
    const frequency = this._midiToFreq(midi);
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(520, time);
    filter.frequency.exponentialRampToValueAtTime(340, time + duration);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(gainValue, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    filter.connect(gain);
    gain.connect(this.musicBus);

    for (const [type, detune, volume] of [
      ["triangle", 0, 1],
      ["sine", -2, 0.7]
    ]) {
      const osc = this.context.createOscillator();
      const oscGain = this.context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency, time);
      osc.detune.value = detune;
      oscGain.gain.value = volume;
      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start(time);
      osc.stop(time + duration + 0.04);
    }
  }

  _pad(midiNotes, time, duration, gainValue) {
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const pan = this.context.createStereoPanner();

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1600, time);
    filter.frequency.exponentialRampToValueAtTime(950, time + duration);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(gainValue, time + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    pan.pan.value = -0.08;

    filter.connect(gain);
    gain.connect(pan);
    pan.connect(this.musicBus);

    for (const midi of midiNotes) {
      for (const [type, detune, level] of [
        ["triangle", 0, 0.65],
        ["sawtooth", 7, 0.22]
      ]) {
        const osc = this.context.createOscillator();
        const oscGain = this.context.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(this._midiToFreq(midi), time);
        osc.detune.value = detune;
        oscGain.gain.value = level;
        osc.connect(oscGain);
        oscGain.connect(filter);
        osc.start(time);
        osc.stop(time + duration + 0.08);
      }
    }
  }

  _pluck(frequency, time, options) {
    const {
      duration = 0.16,
      gain = 0.03,
      type = "triangle",
      destination = this.sfxBus,
      brightness = 2400,
      pan = 0
    } = options;

    const osc = this.context.createOscillator();
    const oscGain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    const gainNode = this.context.createGain();
    const panner = this.context.createStereoPanner();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, time);
    osc.detune.value = (Math.random() - 0.5) * 8;

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(brightness, time);
    filter.frequency.exponentialRampToValueAtTime(Math.max(500, brightness * 0.45), time + duration);

    oscGain.gain.value = 1;

    gainNode.gain.setValueAtTime(0.0001, time);
    gainNode.gain.exponentialRampToValueAtTime(gain, time + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    panner.pan.value = pan;

    osc.connect(oscGain);
    oscGain.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(destination);

    osc.start(time);
    osc.stop(time + duration + 0.04);
  }

  _noiseBurst(time, options) {
    const {
      duration = 0.06,
      gain = 0.008,
      filterFrequency = 5200,
      filterType = "highpass",
      q = 0.8,
      destination = this.sfxBus,
      pan = 0
    } = options;

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gainNode = this.context.createGain();
    const panner = this.context.createStereoPanner();

    source.buffer = this.noiseBuffer;
    filter.type = filterType;
    filter.frequency.value = filterFrequency;
    filter.Q.value = q;

    gainNode.gain.setValueAtTime(0.0001, time);
    gainNode.gain.exponentialRampToValueAtTime(gain, time + 0.004);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    panner.pan.value = pan;

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(destination);

    source.start(time);
    source.stop(time + duration + 0.02);
  }

  _createNoiseBuffer() {
    const buffer = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  _midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  _now() {
    if (!this._ready()) {
      return null;
    }
    return this.context.currentTime;
  }

  _ready() {
    return this.enabled && this.unlocked && this.context && this.master;
  }
}
