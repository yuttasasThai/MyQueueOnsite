// File: /src/services/soundAlarm.ts | Revision: Rev 21 | Version: 1.5.2 | Modified: 2026-11-16
// Audio Alarm & Speech Synthesis Service for Appointment (Before/Overdue), >2-Day Pending, Daily Queue & Warranty Alerts
// Supports repeat loop, Android Chrome user-gesture audio unlock, voice loading, and automatic timeout stop

class WarrantyAlarmService {
  private audioCtx: AudioContext | null = null;
  private isAlarmPlaying = false;
  private alarmInterval: number | null = null;
  private speechTimeout: number | null = null;
  private speakDispatchTimeout: number | null = null;
  private autoStopTimeout: number | null = null;
  private currentSpeechText = '';
  private gestureUnlockBound = false;
  private cachedThaiVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.refreshThaiVoice();
      try {
        window.speechSynthesis.addEventListener('voiceschanged', () => {
          this.refreshThaiVoice();
        });
      } catch {}
    }
  }

  private refreshThaiVoice(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      const voices = window.speechSynthesis.getVoices();
      const found = voices.find(
        (v) => v.lang === 'th-TH' || v.lang.startsWith('th') || v.name.includes('Thai')
      );
      if (found) {
        this.cachedThaiVoice = found;
      }
    } catch {}
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  public unlockAudio(): void {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    this.refreshThaiVoice();
  }

  private handleUserGestureUnlock = () => {
    this.unlockAudio();
    if (!this.isAlarmPlaying) return;
    this.playIteration();
    this.detachGestureUnlock();
  };

  private attachGestureUnlock(): void {
    if (typeof window === 'undefined' || this.gestureUnlockBound) return;
    this.gestureUnlockBound = true;
    window.addEventListener('pointerdown', this.handleUserGestureUnlock, { passive: true });
    window.addEventListener('touchstart', this.handleUserGestureUnlock, { passive: true });
    window.addEventListener('click', this.handleUserGestureUnlock, { passive: true });
    window.addEventListener('keydown', this.handleUserGestureUnlock, { passive: true });
  }

  private detachGestureUnlock(): void {
    if (typeof window === 'undefined' || !this.gestureUnlockBound) return;
    this.gestureUnlockBound = false;
    window.removeEventListener('pointerdown', this.handleUserGestureUnlock);
    window.removeEventListener('touchstart', this.handleUserGestureUnlock);
    window.removeEventListener('click', this.handleUserGestureUnlock);
    window.removeEventListener('keydown', this.handleUserGestureUnlock);
  }

  // Play a 3-tone alert chime
  private playAlertBeep(): void {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Tone 1: 880Hz (A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.2);

      // Tone 2: 1320Hz (E6)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1320, now + 0.12);
      gain2.gain.setValueAtTime(0.28, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.38);

      // Tone 3: 1760Hz (A6) high warning chirp
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(1760, now + 0.25);
      gain3.gain.setValueAtTime(0.22, now + 0.25);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.25);
      osc3.stop(now + 0.52);
    } catch (e) {
      console.warn('Unable to play alarm beep:', e);
    }
  }

  // Speak Thai announcement using Web Speech API (with safe cancel->speak gap for Android Chrome)
  private speakAnnouncement(text: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      if (this.speakDispatchTimeout) {
        window.clearTimeout(this.speakDispatchTimeout);
      }

      this.speakDispatchTimeout = window.setTimeout(() => {
        if (!this.isAlarmPlaying && text !== this.currentSpeechText) return;
        try {
          this.refreshThaiVoice();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'th-TH';
          utterance.rate = 0.95;
          utterance.pitch = 1.05;
          utterance.volume = 1.0;

          if (this.cachedThaiVoice) {
            utterance.voice = this.cachedThaiVoice;
          }

          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.warn('Speech synthesis speak error:', err);
        }
      }, 60);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  /**
   * Start repeated alarm loop:
   * 1. Beep alarm sound + Thai voice speech
   * 2. Repeat every 7.5 seconds until stopped or maxDurationMs expires
   */
  public startAlarm(
    announcementText: string,
    maxDurationMs?: number,
    onAutoStop?: () => void
  ): void {
    this.stopAlarm();
    this.currentSpeechText = announcementText;
    this.isAlarmPlaying = true;
    this.attachGestureUnlock();

    // Run first iteration immediately
    this.playIteration();

    // Loop every 7.5 seconds
    this.alarmInterval = window.setInterval(() => {
      if (!this.isAlarmPlaying) return;
      this.playIteration();
    }, 7500);

    // Optional automatic stop timer (e.g. 5 minutes = 300,000 ms)
    if (maxDurationMs && maxDurationMs > 0) {
      this.autoStopTimeout = window.setTimeout(() => {
        this.stopAlarm();
        if (onAutoStop) {
          onAutoStop();
        }
      }, maxDurationMs);
    }
  }

  private playIteration(): void {
    this.playAlertBeep();

    if (this.speechTimeout) {
      window.clearTimeout(this.speechTimeout);
    }
    this.speechTimeout = window.setTimeout(() => {
      if (this.isAlarmPlaying && this.currentSpeechText) {
        this.speakAnnouncement(this.currentSpeechText);
      }
    }, 550);
  }

  /**
   * Stop the alarm and speech synthesis immediately
   */
  public stopAlarm(): void {
    this.isAlarmPlaying = false;
    this.detachGestureUnlock();
    if (this.alarmInterval) {
      window.clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
    if (this.speechTimeout) {
      window.clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }
    if (this.speakDispatchTimeout) {
      window.clearTimeout(this.speakDispatchTimeout);
      this.speakDispatchTimeout = null;
    }
    if (this.autoStopTimeout) {
      window.clearTimeout(this.autoStopTimeout);
      this.autoStopTimeout = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  public playOnce(speechText?: string): void {
    this.unlockAudio();
    this.playAlertBeep();
    if (speechText) {
      window.setTimeout(() => {
        this.speakAnnouncement(speechText);
      }, 500);
    }
  }

  public isPlaying(): boolean {
    return this.isAlarmPlaying;
  }
}

export const warrantyAlarmService = new WarrantyAlarmService();
