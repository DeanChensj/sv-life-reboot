// Lightweight Web Audio API Sound Synthesizer for Silicon Valley Life Reboot

class SoundManager {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Load mute preference from localStorage if available
    if (typeof localStorage !== 'undefined') {
      const savedMute = localStorage.getItem('sv_sound_muted');
      if (savedMute !== null) {
        this.isMuted = savedMute === 'true';
      }
    }
  }

  private initCtx() {
    if (typeof window === 'undefined') return;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sv_sound_muted', String(this.isMuted));
    }
    if (!this.isMuted) {
      this.play('click');
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public play(type: 'click' | 'coin' | 'achievement' | 'alert' | 'win' | 'gameover') {
    if (this.isMuted) return;

    try {
      this.initCtx();
      if (!this.audioCtx) return;
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      switch (type) {
        case 'click': {
          // Soft pop click
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);

          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 0.05);
          break;
        }

        case 'coin': {
          // Bright double-tone chime (E6 -> B6)
          const notes = [1318.51, 1975.53];
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = now + i * 0.08;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(0.2, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(start);
            osc.stop(start + 0.25);
          });
          break;
        }

        case 'achievement': {
          // Arpeggio fanfare (C5 -> E5 -> G5 -> C6)
          const notes = [523.25, 659.25, 783.99, 1046.50];
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = now + i * 0.07;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(0.25, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(start);
            osc.stop(start + 0.35);
          });
          break;
        }

        case 'alert': {
          // Low warning pulse
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.linearRampToValueAtTime(120, now + 0.3);

          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 0.3);
          break;
        }

        case 'win': {
          // Victory Chord Sequence (C Major -> F Major -> G Major -> C Major High)
          const chords = [
            [523.25, 659.25, 783.99],
            [587.33, 698.46, 880.00],
            [659.25, 783.99, 1046.50],
            [1046.50, 1318.51, 1567.98]
          ];
          chords.forEach((chord, step) => {
            const start = now + step * 0.18;
            chord.forEach(freq => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();

              osc.type = 'triangle';
              osc.frequency.setValueAtTime(freq, start);

              gain.gain.setValueAtTime(0.2, start);
              gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);

              osc.connect(gain);
              gain.connect(ctx.destination);

              osc.start(start);
              osc.stop(start + 0.4);
            });
          });
          break;
        }

        case 'gameover': {
          // Sad descending minor notes
          const notes = [440, 415.30, 392, 349.23];
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = now + i * 0.15;

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(0.18, start);
            gain.gain.exponentialRampToValueAtTime(0.01, start + 0.3);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(start);
            osc.stop(start + 0.3);
          });
          break;
        }
      }
    } catch {
      // AudioContext might be blocked or uninitialized
    }
  }
}

export const sound = new SoundManager();
