import { state } from './state.js';
import { APP_CONFIG } from './config.js';

let lastPrayTime = 0;

export function initMotion(elements) {
    const hands = new Hands({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }});
    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    hands.onResults((results) => {
        elements.canvasCtx.save();
        elements.canvasCtx.clearRect(0, 0, elements.canvasElement.width, elements.canvasElement.height);
        
        let currentIsPraying = false;

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            // 손 뼈대 그리기
            for (const landmarks of results.multiHandLandmarks) {
                drawConnectors(elements.canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
                drawLandmarks(elements.canvasCtx, landmarks, {color: '#FF0000', lineWidth: 1, radius: 2});
            }

            if (results.multiHandLandmarks.length >= 2) {
                const hand1 = results.multiHandLandmarks[0];
                const hand2 = results.multiHandLandmarks[1];
                
                const dx = hand1[0].x - hand2[0].x;
                const dy = hand1[0].y - hand2[0].y;
                const dz = hand1[0].z - hand2[0].z;
                const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);

                // 2손이 기준 거리 이내면 확실한 기도 상태
                if (distance < APP_CONFIG.PRAY.DISTANCE_THRESHOLD) {
                    currentIsPraying = true;
                    lastPrayTime = Date.now(); 
                }
            } else if (results.multiHandLandmarks.length === 1) {
                const hand = results.multiHandLandmarks[0];
                // 손목(0)과 중지(12)의 y좌표 차이로 수직 상태 확인 (수치가 높을수록 수직)
                const isVertical = (hand[0].y - hand[12].y) > 0.12; 
                // 손이 화면 중앙(x=0.5) 근처인지 확인
                const isCentered = Math.abs(hand[0].x - 0.5) < 0.2;

                // 최근에 2손 기도를 했고, 현재 1손이 수직 상태를 유지 중이라면
                if (isVertical && (Date.now() - lastPrayTime < APP_CONFIG.PRAY.GRACE_PERIOD_MS)) {
                    currentIsPraying = true;
                    // 만약 수직이면서 중앙에 있다면, 두 손이 겹쳐서 1손으로 보이는 '합장' 상태로 간주
                    // 이 경우 타이머를 계속 갱신하여 기도 상태를 무한 유지 가능하게 함
                    if (isCentered) {
                        lastPrayTime = Date.now();
                    }
                }
            }
        } else {
            // 아예 손이 안 보일 때만 잠깐의 유예 시간 적용
            if (Date.now() - lastPrayTime < APP_CONFIG.PRAY.FLICKER_PERIOD_MS) {
                currentIsPraying = true;
            }
        }

        if (currentIsPraying !== state.isPraying) {
            state.isPraying = currentIsPraying;
            if (state.isPraying) {
                elements.prayerStatus.innerHTML = "🙏 기도 감지됨!";
                elements.prayerStatus.style.color = "#000";
                elements.prayerStatus.style.background = "#0f0";
                elements.prayerStatus.style.borderColor = "#0f0";
                elements.prayerStatus.style.boxShadow = "0 0 15px #0f0";
            } else if (state.isPrayerRequired) {
                // 기도가 필요한데 안 하고 있는 경우만 안내
                elements.prayerStatus.innerHTML = "🖐️ 두 손을 모아주세요";
                elements.prayerStatus.style.color = "#ff0";
                elements.prayerStatus.style.background = "rgba(0,0,0,0.8)";
                elements.prayerStatus.style.borderColor = "#ff0";
                elements.prayerStatus.style.boxShadow = "none";
            } else {
                // 평소에는 조용히
                elements.prayerStatus.innerHTML = "👀 관찰 중...";
                elements.prayerStatus.style.color = "#888";
                elements.prayerStatus.style.background = "rgba(0,0,0,0.5)";
                elements.prayerStatus.style.borderColor = "#444";
                elements.prayerStatus.style.boxShadow = "none";
            }
        }
        
        if (elements.prayerStatus.innerHTML.includes("로딩중")) {
            elements.prayerStatus.innerHTML = "👀 관찰 중...";
            elements.prayerStatus.style.color = "#888";
        }

        elements.canvasCtx.restore();
    });

    return hands;
}
