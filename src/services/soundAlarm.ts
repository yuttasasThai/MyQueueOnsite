// Audio Alarm & Speech Synthesis Service for Expired Warranty Alerts
// Plays an urgent sound pattern (Web Audio API) and speaks Job Number + Customer Name + Product Details in Thai (SpeechSynthesis)

class WarrantyAlarmService {
  private audioCtx: AudioContext | null = null;
  private isAlarmPlaying = false;
  private alarmInterval: number | null = null;
  private speechTimeout: number | null = null;
  private currentSpeechText = '';

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
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

  // Play a 2-tone alert chime (beep-boop alert sound)
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

  // Speak Thai announcement using Web Speech API
  private speakAnnouncement(text: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'th-TH';
      utterance.rate = 0.95; // Clear natural tempo
      utterance.pitch = 1.05; // Slightly high urgency
      utterance.volume = 1.0;

      // Select Thai voice if available
      const voices = window.speechSynthesis.getVoices();
      const thaiVoice = voices.find(
        (v) => v.lang === 'th-TH' || v.lang.startsWith('th') || v.name.includes('Thai')
      );
      if (thaiVoice) {
        utterance.voice = thaiVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  /**
   * Start repeated alarm loop:
   * 1. Beep alarm sound
   * 2. Speak: "แจ้งเตือนงานหมดประกัน คิวงาน {queueNumber} ลูกค้า {customerName} รายการ {product}"
   * 3. Repeat every 7 seconds until stopped by user acknowledging
   */
  public startAlarm(announcementText: string): void {
    this.currentSpeechText = announcementText;
    this.isAlarmPlaying = true;

    // Run first iteration immediately
    this.playIteration();

    // Loop every 7.5 seconds
    if (this.alarmInterval) {
      window.clearInterval(this.alarmInterval);
    }
    this.alarmInterval = window.setInterval(() => {
      if (!this.isAlarmPlaying) return;
      this.playIteration();
    }, 7500);
  }

  private playIteration(): void {
    // 1. Play beep chime
    this.playAlertBeep();

    // 2. Play speech after 600ms chime delay
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
    if (this.alarmInterval) {
      window.clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
    if (this.speechTimeout) {
      window.clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  public isPlaying(): boolean {
    return this.isAlarmPlaying;
  }
}

export const warrantyAlarmService = new WarrantyAlarmService();
