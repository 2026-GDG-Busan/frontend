export function initAudio(stream, { onVolumeChange, onPopupOpen, isPopupOpen }) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  analyser.fftSize = 256;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  let noiseTimer = 0;
  let rafId;

  function updateAudio() {
    analyser.getByteFrequencyData(dataArray);
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const volume = sum / dataArray.length;
    onVolumeChange?.(Math.min(volume * 2.5, 100), volume);

    if (!isPopupOpen?.()) {
      if (volume > 70) {
        noiseTimer += 1;
        if (noiseTimer > 60) {
          onPopupOpen?.();
        }
      } else {
        noiseTimer = Math.max(0, noiseTimer - 2);
      }
    }

    rafId = requestAnimationFrame(updateAudio);
  }

  updateAudio();

  return () => {
    cancelAnimationFrame(rafId);
    source.disconnect();
    if (audioContext.state !== 'closed') {
      audioContext.close();
    }
  };
}
