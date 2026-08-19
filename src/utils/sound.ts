// Lightweight Web Audio API Sound Synthesizer for Silicon Valley Life Reboot
import { safeStorage } from './safeStorage';
import { STORAGE_KEYS } from '../constants/gameConstants';

class SoundManager {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;
  private warnedOnce: boolean = false;

  constructor() {
    // Load mute preference safely
    const savedMute = safeStorage.getItem(STORAGE_KEYS.SOUND_MUTED);
    if (savedMute !== null) {
      this.isMuted = savedMute === 'true';
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
      // resume() is async and returns a Promise. Don't leave it floating — on
      // older Safari without a user gesture it rejects, producing an unhandled
      // rejection. Sounds are also scheduled a few ms ahead (see `play`) so the
      // first sample after unlocking isn't stranded in the past.
      this.audioCtx.resume().catch(() => {});
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    safeStorage.setItem(STORAGE_KEYS.SOUND_MUTED, String(this.isMuted));
    if (!this.isMuted) {
      this.play('click');
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public play(type: 'click' | 'coin' | 'achievement' | 'alert' | 'win' | 'gameover' | 'promo' | 'cash_burst' | 'damage' | 'heal' | 'layoff') {
    if (this.isMuted) return;

    try {
      this.initCtx();
      if (!this.audioCtx) return;
      const ctx = this.audioCtx;
      // Schedule slightly ahead of the current clock. When the context has just
      // resumed from 'suspended' (the first sound after a user gesture, common on
      // iOS Safari), ctx.currentTime can lag; scheduling exactly at the current
      // time drops the sound. A small lookahead keeps the start reliably future.
      const now = ctx.currentTime + 0.03;

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

        case 'cash_burst': {
          // Rapid sparkling cascading coins (C6 -> E6 -> G6 -> C7)
          const notes = [1046.50, 1318.51, 1567.98, 2093.00];
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = now + i * 0.06;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(0.22, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(start);
            osc.stop(start + 0.3);
          });
          break;
        }

        case 'promo': {
          // Grand heroic trumpet arpeggio fanfare (F4 -> A4 -> C5 -> F5 -> A5)
          const notes = [349.23, 440.00, 523.25, 698.46, 880.00];
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = now + i * 0.09;

            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(0.18, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(start);
            osc.stop(start + 0.45);
          });
          break;
        }

        case 'heal': {
          // Warm soothing ascending chime (D5 -> G5 -> B5)
          const notes = [587.33, 783.99, 987.77];
          notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = now + i * 0.08;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(0.2, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(start);
            osc.stop(start + 0.4);
          });
          break;
        }

        case 'damage': {
          // Heavy punch / bass impact
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(160, now);
          osc.frequency.exponentialRampToValueAtTime(45, now + 0.25);

          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 0.25);
          break;
        }

        case 'layoff': {
          // Heavy dramatic buzzer (Low dissonant minor second)
          [130.81, 138.59].forEach((freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now);
            osc.frequency.linearRampToValueAtTime(freq * 0.8, now + 0.45);

            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.45);
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
    } catch (e) {
      // AudioContext might be blocked or uninitialized. Log once so the failure
      // isn't completely invisible during development, but never spam.
      if (!this.warnedOnce) {
        this.warnedOnce = true;
        console.warn('[sound] audio playback failed', e);
      }
    }
  }
}

export const sound = new SoundManager();
