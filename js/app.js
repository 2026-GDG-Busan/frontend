import { state } from './state.js';
import { initSpeech } from './speech.js';
import { initMotion } from './motion.js';
import { initAudio } from './audio.js';
import { APP_CONFIG } from './config.js';

const elements = {
    video: document.getElementById('webcam'),
    canvasElement: document.getElementById('output_canvas'),
    canvasCtx: document.getElementById('output_canvas').getContext('2d'),
    prayerStatus: document.getElementById('prayer-status'),
    aiGauge: document.getElementById('ai-gauge'),
    volBar: document.getElementById('volume-bar'),
    aiMessage: document.getElementById('ai-message'),
    popup: document.getElementById('popup'),
    sttStatus: document.getElementById('stt-status')
};

// 1. 음성 인식(STT) 초기화
initSpeech(elements);

// 2. 모션 인식(MediaPipe) 초기화
const hands = initMotion(elements);

// 3. 미디어 캡처(카메라, 마이크) 설정
async function setupMedia() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: true });
        elements.video.srcObject = stream;

        // 카메라 프레임을 MediaPipe로 전송
        const camera = new Camera(elements.video, {
            onFrame: async () => {
                await hands.send({ image: elements.video });
            },
            width: 640,
            height: 480
        });
        camera.start();

        // 오디오 분석기 초기화
        initAudio(stream, elements);
    } catch (err) {
        console.error("미디어 장치 접근 에러:", err);
        elements.aiMessage.innerText = "[ERROR] 카메라/마이크 권한이 필요합니다.";
        elements.aiMessage.style.color = "red";
    }
}

// 4. 백엔드(FastAPI) 상태 전송 로직
async function sendStatus() {
    try {
        const response = await fetch(`${APP_CONFIG.BACKEND_URL}/wakeup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                user_id: "test_user_1",
                volume: state.currentVolume,
                is_praying: state.isPraying,
                is_popup_active: elements.popup.style.display === 'block'
            })
        });

        if (!response.ok) throw new Error("서버 응답 오류");

        const data = await response.json();

        if (data.error) {
            elements.aiMessage.innerText = `[ERROR] ${data.error}`;
            elements.aiMessage.style.color = "red";
            return;
        }

        // 상태 업데이트 반영
        elements.aiGauge.style.width = data.gauge + "%";
        elements.aiMessage.innerText = `> ${data.message}`;
        elements.aiMessage.style.color = (data.voice_trigger === 'angry') ? "red" : "#0f0";

        // AI 요구 사항(기도 필요 여부) 시각화 및 상태 동기화
        state.isPrayerRequired = data.prayer_required;
        if (data.prayer_required) {
            document.getElementById('container').style.boxShadow = "0 0 30px #ff0, inset 0 0 20px #ff0";
            document.getElementById('container').style.borderColor = "#ff0";
            if (!state.isPraying) {
                elements.aiMessage.innerText = "🙏 [QUEST] 지금 당장 기도해라!!!";
                elements.aiMessage.style.color = "yellow";
            }
        } else {
            document.getElementById('container').style.boxShadow = "0 0 20px rgba(0, 255, 0, 0.2), inset 0 0 10px rgba(0, 255, 0, 0.1)";
            document.getElementById('container').style.borderColor = "#0f0";
        }

        if (data.status === "awoken") {
            document.querySelector('h1').innerText = "[ SYSTEM: AI AWAKE ]";
            document.querySelector('h1').style.color = "#ff0";
            setTimeout(() => {
                alert("성공! AI가 일어났습니다. (하지만 곧 다시 잡니다)");
            }, 500);
        } else {
            document.querySelector('h1').innerText = "[ SYSTEM: AI SLEEPING ]";
            document.querySelector('h1').style.color = "#0f0";
        }
    } catch (err) {
        console.error("서버 통신 에러:", err);
    }
}

// 5. 리셋 기능
document.getElementById('reset-btn').addEventListener('click', async () => {
    if (!confirm("정말 처음부터 다시 시작하시겠습니까?")) return;

    try {
        const response = await fetch(`${APP_CONFIG.BACKEND_URL}/reset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: "test_user_1" })
        });
        const data = await response.json();
        elements.aiGauge.style.width = "0%";
        elements.aiMessage.innerText = "> 시스템이 초기화되었습니다.";
        alert("게이지가 초기화되었습니다.");
    } catch (err) {
        console.error("리셋 실패:", err);
    }
});

// 애플리케이션 시작점
setupMedia();
setInterval(sendStatus, APP_CONFIG.SYNC_INTERVAL_MS); // 설정된 주기에 따라 서버와 동기화
