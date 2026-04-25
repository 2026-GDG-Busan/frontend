import { state } from './state.js';

export let recognition;

export function initSpeech(elements) {
    if ('webkitSpeechRecognition' in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'ko-KR';

        recognition.onresult = function(event) {
            const transcript = event.results[event.results.length - 1][0].transcript.trim();
            
            if (transcript.includes('죄송') || transcript.includes('미안') || transcript.includes('잘못')) {
                elements.sttStatus.innerText = `들린 말: "${transcript}"\n✅ 사과를 받아들입니다.`;
                elements.sttStatus.style.color = "#0f0";
                setTimeout(() => {
                    elements.popup.style.display = 'none';
                    document.getElementById('container').style.filter = 'none';
                    state.noiseTimer = 0;
                    recognition.stop();
                    state.isSttListening = false;
                }, 1500);
            } else {
                elements.sttStatus.innerText = `들린 말: "${transcript}"\n❌ 진정성이 없습니다! 다시 사과하세요!`;
                elements.sttStatus.style.color = "red";
            }
        };

        recognition.onend = function() {
            // 팝업이 떠있는데 꺼졌다면 다시 실행 (지속적으로 듣기 위함)
            if (elements.popup.style.display === 'block') {
                recognition.start();
            } else {
                state.isSttListening = false;
            }
        };
    }
}
