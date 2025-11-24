let audioCtx: AudioContext | null = null;
let isMuted = false;

const initAudio = () => {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.error("Web Audio API not supported", e);
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

export const toggleMute = () => {
  isMuted = !isMuted;
  return isMuted;
};

export const setMuted = (muted: boolean) => {
  isMuted = muted;
}

export const getMutedState = () => isMuted;

const playTone = (freq: number, type: OscillatorType, duration: number, vol: number = 0.1, startTime: number = 0) => {
  if (isMuted) return;
  initAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime + startTime);
  
  // Envelope
  gain.gain.setValueAtTime(0, audioCtx.currentTime + startTime);
  gain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + startTime + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(audioCtx.currentTime + startTime);
  osc.stop(audioCtx.currentTime + startTime + duration);
};

export const playEatSound = () => {
  // High cheerful ping
  playTone(523.25, 'sine', 0.1, 0.1); // C5
  playTone(659.25, 'sine', 0.1, 0.1, 0.05); // E5
};

export const playGameOverSound = () => {
  // Descending breakdown
  playTone(300, 'sawtooth', 0.2, 0.2); 
  playTone(200, 'sawtooth', 0.3, 0.2, 0.15);
  playTone(100, 'sawtooth', 0.5, 0.2, 0.3);
};

export const playStartSound = () => {
  // Ascending futuristic sequence
  playTone(440, 'square', 0.1, 0.05);
  playTone(554, 'square', 0.1, 0.05, 0.1);
  playTone(659, 'square', 0.2, 0.05, 0.2);
};
