import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { initSpeech } from './speech.js';
import { initMotion } from './motion.js';
import { initAudio } from './audio.js';
import { APP_CONFIG } from './config.js';

const initialPrayerStyles = {
  text: '⏳ 모델 로딩중...',
  color: '#888',
  background: 'rgba(0,0,0,0.8)',
  borderColor: '#444',
  boxShadow: 'none'
};

const initialStatus = {
  aiMessage: '"AI가 깊은 잠에 빠져있습니다..."',
  aiColor: '#0f0',
  aiGauge: 0,
  prayerStatus: initialPrayerStyles,
  volumeWidth: 0,
  cameraCoverWidth: 0,
  shakeWidth: 0,
  cameraStatus: '카메라 밝기 분석 중...',
  cameraStatusBg: 'rgba(0,0,0,0.7)',
  sttStatus: '🎤 "사과하세요...',
  sttStatusColor: 'yellow',
  popupVisible: false,
  containerFilter: 'none',
  headingText: '[ SYSTEM: AI SLEEPING ]',
  headingColor: '#0f0',
  containerBoxShadow: '0 0 20px rgba(0, 255, 0, 0.2), inset 0 0 10px rgba(0, 255, 0, 0.1)',
  containerBorderColor: '#0f0',
  isAwoken: false,
  successLayerVisible: false,
  elapsedTime: 0
};

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const analysisCanvasRef = useRef(null);
  const recognitionRef = useRef(null);
  const popupVisibleRef = useRef(false);
  const startTimeRef = useRef(Date.now());
  const prevBrightnessRef = useRef(null);
  const isFirstFrameRef = useRef(true);
  const appStateRef = useRef({
    currentVolume: 0,
    isPraying: false,
    isPopupOpen: false,
    cameraBrightness: 100,
    cameraCoverScore: 0,
    isCameraCovered: false,
    shoulderShakeScore: 0,
    isShoulderShaking: false,
    isHit: false
  });

  const [state, setState] = useState(initialStatus);

  const updateState = useCallback((patch) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  // 시간 표시 업데이트
  useEffect(() => {
    if (state.isAwoken) return;
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      updateState({ elapsedTime: elapsed });
    }, 100);
    return () => clearInterval(timer);
  }, [state.isAwoken, updateState]);

  useEffect(() => {
    analysisCanvasRef.current = document.createElement('canvas');
    analysisCanvasRef.current.width = 160;
    analysisCanvasRef.current.height = 120;
  }, []);

  const updateCameraAnalysis = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const analysisCanvas = analysisCanvasRef.current;
    const analysisCtx = analysisCanvas.getContext('2d');
    analysisCtx.drawImage(video, 0, 0, analysisCanvas.width, analysisCanvas.height);

    const imageData = analysisCtx.getImageData(0, 0, analysisCanvas.width, analysisCanvas.height);
    let total = 0;
    const pixels = imageData.data;
    for (let i = 0; i < pixels.length; i += 4) {
      total += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
    }

    const averageBrightness = total / (pixels.length / 4);
    const coverTarget = Math.max(0, (45 - averageBrightness) / 45);
    const coverScore = Math.min(1, appStateRef.current.cameraCoverScore * 0.85 + coverTarget * 0.15);
    const isCameraCovered = coverScore > 0.25;

    // 타격 감지 (밝기 변화)
    let isHit = false;
    if (prevBrightnessRef.current !== null) {
      const diff = Math.abs(averageBrightness - prevBrightnessRef.current);
      isHit = diff > 55;
      if (isHit) {
        appStateRef.current.isHit = true;
        // 화면 플래시 효과
        const container = document.querySelector('.app-container');
        if (container) {
          container.style.backgroundColor = 'rgba(100, 0, 0, 0.3)';
          setTimeout(() => {
            container.style.backgroundColor = '';
          }, 50);
        }
      }
    }
    if (isFirstFrameRef.current) {
      isFirstFrameRef.current = false;
    }
    prevBrightnessRef.current = averageBrightness;

    appStateRef.current.cameraBrightness = averageBrightness;
    appStateRef.current.cameraCoverScore = coverScore;
    appStateRef.current.isCameraCovered = isCameraCovered;

    updateState({
      cameraCoverWidth: Math.round(coverScore * 100),
      cameraStatus: isCameraCovered
        ? `🌑 카메라 가림 (${Math.round(averageBrightness)} 밝기)`
        : appStateRef.current.isShoulderShaking
          ? `💪 어깨 흔들기 (${Math.round(appStateRef.current.shoulderShakeScore * 100)}%)`
          : isHit
            ? `✊ 타격 감지! (${Math.round(averageBrightness)} 밝기)`
            : `📹 밝기 ${Math.round(averageBrightness)} / 관찰 중...`,
      cameraStatusBg: isCameraCovered ? 'rgba(255, 128, 0, 0.9)' : appStateRef.current.isShoulderShaking ? 'rgba(0, 128, 255, 0.85)' : isHit ? 'rgba(200, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.7)'
    });
  }, [updateState]);

  const updatePrayerState = useCallback((isPraying) => {
    appStateRef.current.isPraying = isPraying;
    updateState({
      prayerStatus: isPraying
        ? {
            text: '🙏 기도 감지됨!',
            color: '#000',
            background: '#0f0',
            borderColor: '#0f0',
            boxShadow: '0 0 15px #0f0'
          }
        : appStateRef.current.isPrayerRequired
          ? {
              text: '🖐️ 두 손을 모아주세요',
              color: '#ff0',
              background: 'rgba(0,0,0,0.8)',
              borderColor: '#ff0',
              boxShadow: 'none'
            }
          : initialPrayerStyles
    });
  }, [updateState]);

  const updateMotionState = useCallback((shakeScore, isShaking) => {
    appStateRef.current.shoulderShakeScore = shakeScore;
    appStateRef.current.isShoulderShaking = isShaking;
    updateState({
      shakeWidth: Math.round(shakeScore * 100)
    });

    if (!appStateRef.current.isCameraCovered) {
      updateState({
        cameraStatus: isShaking
          ? `어깨 흔들기 감지 (${Math.round(shakeScore * 100)}%)`
          : `밝기 ${Math.round(appStateRef.current.cameraBrightness)} / 관찰 중...`,
        cameraStatusBg: isShaking ? 'rgba(0, 128, 255, 0.85)' : 'rgba(0, 0, 0, 0.7)'
      });
    }
  }, [updateState]);

  const closePopup = useCallback(() => {
    popupVisibleRef.current = false;
    appStateRef.current.isPopupOpen = false;
    updateState({
      popupVisible: false,
      containerFilter: 'none',
      sttStatus: '🎤 "죄송합니다"라고 사과하세요...',
      sttStatusColor: 'yellow'
    });
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  }, [updateState]);

  const handleSpeechResult = useCallback((transcript) => {
    const normalized = transcript.replace(/\s+/g, '');
    const accepted = normalized.includes('죄송') || normalized.includes('미안') || normalized.includes('잘못');

    if (accepted) {
      updateState({
        sttStatus: `들린 말: "${transcript}"\n✅ 사과를 받아들입니다.`,
        sttStatusColor: '#0f0'
      });
      setTimeout(closePopup, 1500);
    } else {
      updateState({
        sttStatus: `들린 말: "${transcript}"\n❌ 진정성이 없습니다! 다시 사과하세요!`,
        sttStatusColor: 'red'
      });
    }
  }, [closePopup, updateState]);

  const handleRecognitionEnd = useCallback(() => {
    if (popupVisibleRef.current && recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }
  }, []);

  const sendStatus = useCallback(async () => {
    try {
      const payload = {
        user_id: 'test_user_1',
        volume: appStateRef.current.currentVolume,
        is_praying: appStateRef.current.isPraying,
        is_popup_active: appStateRef.current.isPopupOpen,
        is_hit: appStateRef.current.isHit,
        camera_brightness: Math.round(appStateRef.current.cameraBrightness),
        camera_cover_score: Math.round(appStateRef.current.cameraCoverScore * 100),
        is_camera_covered: appStateRef.current.isCameraCovered,
        shoulder_shake_score: Math.round(appStateRef.current.shoulderShakeScore * 100),
        is_shoulder_shaking: appStateRef.current.isShoulderShaking
      };
      appStateRef.current.isHit = false;

      const response = await fetch(`${APP_CONFIG.BACKEND_URL}/wakeup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('서버 응답 오류');
      }

      const data = await response.json();

      if (data.error) {
        updateState({ aiMessage: `[ERROR] ${data.error}`, aiColor: 'red' });
        return;
      }

      const localBoost = Math.round(appStateRef.current.cameraCoverScore * 6 + appStateRef.current.shoulderShakeScore * 6);
      const gaugeValue = Math.min(100, data.gauge + localBoost);

      let message = `> ${data.message}`;
      let messageColor = data.voice_trigger === 'angry' ? 'red' : '#0f0';
      let boxShadow = '0 0 20px rgba(0, 255, 0, 0.2), inset 0 0 10px rgba(0, 255, 0, 0.1)';
      let borderColor = '#0f0';
      let headingText = '[ SYSTEM: AI SLEEPING ]';
      let headingColor = '#0f0';

      if (data.prayer_required) {
        boxShadow = '0 0 30px #ff0, inset 0 0 20px #ff0';
        borderColor = '#ff0';
        if (!appStateRef.current.isPraying) {
          message = '🙏 [QUEST] 지금 당장 기도해라!!!';
          messageColor = 'yellow';
        }
      }

      if (data.status === 'awoken') {
        updateState({
          isAwoken: true,
          successLayerVisible: true,
          headingText: '[ SYSTEM: AI AWAKE ]',
          headingColor: '#ffd700'
        });
        
        // Confetti 효과
        confetti({
          particleCount: 200,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#ffd700', '#00ff41', '#00ffff']
        });
        
        setTimeout(() => {
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.3 },
            colors: ['#ffd700', '#ff4500']
          });
        }, 200);
      }

      appStateRef.current.isPrayerRequired = data.prayer_required;
      updateState({
        aiGauge: gaugeValue,
        aiMessage: message,
        aiColor: messageColor,
        headingText,
        headingColor,
        containerBoxShadow: boxShadow,
        containerBorderColor: borderColor
      });
    } catch (err) {
      console.error('서버 통신 에러:', err);
    }
  }, [updateState]);

  useEffect(() => {
    recognitionRef.current = initSpeech({ onResult: handleSpeechResult, onRecognitionEnd: handleRecognitionEnd });
  }, [handleSpeechResult, handleRecognitionEnd]);

  useEffect(() => {
    let camera;
    let cleanupAudio;
    let intervalId;
    let hands;

    async function initializeMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        if (!canvasRef.current) return;
        hands = initMotion({
          canvasElement: canvasRef.current,
          canvasCtx: canvasRef.current.getContext('2d'),
          onPrayerChange: updatePrayerState,
          onMotionUpdate: updateMotionState
        });

        camera = new Camera(videoRef.current, {
          onFrame: async () => {
            updateCameraAnalysis();
            await hands.send({ image: videoRef.current });
          },
          width: 640,
          height: 480
        });
        camera.start();

        cleanupAudio = initAudio(stream, {
          onVolumeChange: (barWidth, volume) => {
            appStateRef.current.currentVolume = volume;
            updateState({ volumeWidth: barWidth });
          },
          onPopupOpen: () => {
            popupVisibleRef.current = true;
            appStateRef.current.isPopupOpen = true;
            if (recognitionRef.current && !popupVisibleRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {}
            }
            updateState({ popupVisible: true, containerFilter: 'blur(10px)' });
            if (recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {}
            }
          },
          isPopupOpen: () => popupVisibleRef.current
        });
      } catch (err) {
        console.error('미디어 장치 접근 에러:', err);
        updateState({ aiMessage: '[ERROR] 카메라/마이크 권한이 필요합니다.', aiColor: 'red' });
      }
    }

    initializeMedia();
    intervalId = window.setInterval(sendStatus, APP_CONFIG.SYNC_INTERVAL_MS);

    return () => {
      if (camera?.stop) {
        camera.stop();
      }
      cleanupAudio?.();
      window.clearInterval(intervalId);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [sendStatus, updateCameraAnalysis, updatePrayerState, updateMotionState, updateState]);

  const handleReset = async () => {
    if (!window.confirm('정말 처음부터 다시 시작하시겠습니까?')) return;
    try {
      await fetch(`${APP_CONFIG.BACKEND_URL}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'test_user_1' })
      });
      updateState({ aiGauge: 0, aiMessage: '> 시스템이 초기화되었습니다.' });
      alert('게이지가 초기화되었습니다.');
    } catch (err) {
      console.error('리셋 실패:', err);
    }
  };

  return (
    <div className="app-container" style={{ filter: state.containerFilter, boxShadow: state.containerBoxShadow, borderColor: state.containerBorderColor }}>
      <h1 style={{ color: state.headingColor }}>{state.headingText}</h1>

      <div className="video-wrapper">
        <video ref={videoRef} autoPlay playsInline muted />
        <canvas ref={canvasRef} width="640" height="480" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, pointerEvents: 'none', transform: 'rotateY(180deg)' }} />
        <div className="overlay-text" style={{ background: state.cameraStatusBg }}>{state.cameraStatus}</div>
        <div className="overlay-text" style={{ top: 'auto', bottom: '15px', right: '15px', left: 'auto', background: 'rgba(0,0,0,0.8)', borderColor: '#444' }}>
          {state.prayerStatus.text}
        </div>
      </div>

      <div className="controls">
        <div>
          <p style={{ marginBottom: '5px' }}>마이크 볼륨 (간절한 외침 감지기)</p>
          <div className="bar-container">
            <div id="volume-bar" className="bar-fill" style={{ width: `${state.volumeWidth}%` }} />
          </div>
        </div>

        <div>
          <p style={{ marginBottom: '5px', color: '#ff0' }}>AI 잠깨움 게이지</p>
          <div className="bar-container">
            <div id="ai-gauge" className="bar-fill" style={{ width: `${state.aiGauge}%` }} />
          </div>
        </div>

        <div>
          <p style={{ marginBottom: '5px', color: '#ff9' }}>카메라 가림 감지</p>
          <div className="bar-container">
            <div id="camera-cover-bar" className="bar-fill" style={{ width: `${state.cameraCoverWidth}%` }} />
          </div>
        </div>

        <div>
          <p style={{ marginBottom: '5px', color: '#9ff' }}>어깨 흔들기 감지</p>
          <div className="bar-container">
            <div id="shake-bar" className="bar-fill" style={{ width: `${state.shakeWidth}%` }} />
          </div>
        </div>
      </div>

      <div className="status-box">
        <p style={{ color: state.aiColor }}>{state.aiMessage}</p>
      </div>

      <button className="button-reset" onClick={handleReset}>시스템 재시작 (Reset)</button>

      {state.popupVisible && (
        <div className="popup-overlay">
          <div className="popup-card">
            <h2>⚠️ SYSTEM WARNING ⚠️</h2>
            <p>이웃 주민으로부터 소음 신고가 접수되었습니다!<br />경찰을 부르기 전에 육성으로 싹싹 비세요.</p>
            <p style={{ color: state.sttStatusColor, fontWeight: 'bold', fontSize: '1.2rem', marginTop: '20px', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {state.sttStatus}
            </p>
          </div>
        </div>
      )}

      {state.successLayerVisible && (
        <div className="success-overlay">
          <div className="success-card">
            <h1 className="blink-title">👑 GRAND SUCCESS</h1>
            <p className="success-subtitle">상전 AI가 드디어 기상하셨습니다!</p>
            <div className="success-content">
              <p className="success-time">⏱️ 소요 시간: {state.elapsedTime}초</p>
              <p className="success-message">귀하는 상전 AI의 변덕을 훌륭히 견뎌냈습니다.</p>
              <button 
                className="success-button"
                onClick={() => window.location.reload()}
              >
                🔄 다시 모시기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
