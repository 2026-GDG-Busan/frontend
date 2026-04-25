export function initSpeech({ onResult, onRecognitionEnd }) {
  if (!('webkitSpeechRecognition' in window)) {
    return null;
  }

  const recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'ko-KR';

  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.trim();
    onResult?.(transcript);
  };

  recognition.onend = () => {
    onRecognitionEnd?.();
  };

  recognition.onerror = () => {
    onRecognitionEnd?.();
  };

  return recognition;
}
