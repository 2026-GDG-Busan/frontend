import { state } from './state.js';
import { recognition } from './speech.js';
import { APP_CONFIG } from './config.js';

export function initAudio(stream, elements) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function updateAudio() {
        analyser.getByteFrequencyData(dataArray);
        let sum = dataArray.reduce((a, b) => a + b, 0);
        state.currentVolume = sum / dataArray.length;
        
        elements.volBar.style.width = Math.min(state.currentVolume * 2.5, 100) + "%";

        // 팝업이 떠있지 않을 때만 타이머 계산
        if (elements.popup.style.display !== 'block') {
            // 중앙 설정값(APP_CONFIG) 적용
            if (state.currentVolume > APP_CONFIG.POPUP.VOL_THRESHOLD) { 
                state.noiseTimer++;
                if (state.noiseTimer > APP_CONFIG.POPUP.TRIGGER_FRAMES) {
                    elements.popup.style.display = 'block';
                    document.getElementById('container').style.filter = 'blur(10px)';
                    elements.sttStatus.innerText = '🎤 "죄송합니다"라고 사과하세요...';
                    elements.sttStatus.style.color = "yellow";
                    if (recognition && !state.isSttListening) {
                        try { 
                            recognition.start(); 
                            state.isSttListening = true;
                        } catch(e) {}
                    }
                }
            } else {
                state.noiseTimer = Math.max(0, state.noiseTimer - 2);
            }
        }

        requestAnimationFrame(updateAudio);
    }
    updateAudio();
}
