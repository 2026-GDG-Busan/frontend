import { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { initSpeech } from './speech.js';
import { initMotion } from './motion.js';
import { initAudio } from './audio.js';
import { APP_CONFIG } from './config.js';

const NICKNAME_STORAGE_KEY = 'noble-ai-nickname';

const extractRankings = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rankings)) return payload.rankings;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const normalizeRanking = (entry, index) => {
  const rawTime = entry?.time ?? entry?.elapsedTime ?? entry?.elapsed_time ?? 0;
  const time = Number(rawTime);
  return {
    id: String(entry?.id ?? entry?.createdAt ?? entry?.created_at ?? `${entry?.name ?? 'rank'}-${index}`),
    name: String(entry?.name ?? entry?.nickname ?? '익명'),
    time: Number.isFinite(time) ? time : 0
  };
};

const formatRecordTime = (time) => {
  const numericTime = Number(time);
  return Number.isFinite(numericTime) ? numericTime.toFixed(2) : '0.00';
};

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
  shakeWidth: 0,
  motionStatus: '모션 인식 대기 중...',
  motionStatusBg: 'rgba(0,0,0,0.7)',
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
  elapsedTime: 0,
  nickname: '',
  rankings: [],
  rankingLoading: false,
  rankingError: '',
  rankingSubmitting: false,
  rankingSubmitted: false,
  rankingSubmitMessage: ''
};

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const recognitionRef = useRef(null);
  const popupVisibleRef = useRef(false);
  const startTimeRef = useRef(Date.now());
  const appStateRef = useRef({
    currentVolume: 0,
    isPraying: false,
    isPopupOpen: false,
    shoulderShakeScore: 0,
    isShoulderShaking: false,
    apologized: false,
    hasAwoken: false
  });

  const [state, setState] = useState(initialStatus);

  const updateState = useCallback((patch) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  // 시간 표시 업데이트
  useEffect(() => {
    if (state.isAwoken) return;
    const timer = setInterval(() => {
      if (appStateRef.current.hasAwoken) return;
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      updateState({ elapsedTime: elapsed });
    }, 100);
    return () => clearInterval(timer);
  }, [state.isAwoken, updateState]);

  useEffect(() => {
    try {
      const savedNickname = window.localStorage.getItem(NICKNAME_STORAGE_KEY);
      if (savedNickname) {
        updateState({ nickname: savedNickname });
      }
    } catch (err) {
      console.warn('닉네임 저장소 접근 실패:', err);
    }
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
      shakeWidth: Math.round(shakeScore * 100),
      motionStatus: isShaking
        ? `손 흔들기 감지 (${Math.round(shakeScore * 100)}%)`
        : '손 모션 관찰 중...',
      motionStatusBg: isShaking ? 'rgba(0, 128, 255, 0.85)' : 'rgba(0, 0, 0, 0.7)'
    });
  }, [updateState]);

  const closePopup = useCallback(() => {
    popupVisibleRef.current = false;
    appStateRef.current.isPopupOpen = false;
    appStateRef.current.apologized = false;
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
      appStateRef.current.apologized = true;
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

  // 프론트에서 gauge 계산하는 함수
  const calculateGauge = useCallback(() => {
    const volume = appStateRef.current.currentVolume;
    const isPraying = appStateRef.current.isPraying;
    const shoulderShakeScore = appStateRef.current.shoulderShakeScore;
    const isShoulderShaking = appStateRef.current.isShoulderShaking;

    // 게이지 계산 로직
    let gauge = 0;

    // 1. 마이크 볼륨: 0-60 포인트
    gauge += Math.min(1, volume / 70) * 60;

    // 2. 기도 감지: +30 포인트
    if (isPraying) {
      gauge += 30;
    }

    // 3. 손 흔들기: 0-30 포인트 (isShoulderShaking 일 때만)
    if (isShoulderShaking) {
      gauge += shoulderShakeScore * 30;
    }

    // 4. 팝업 상태에서 사과할 때: +15 포인트 (사과 완료 시)
    if (appStateRef.current.isPopupOpen && appStateRef.current.apologized) {
      gauge += 15;
      appStateRef.current.apologized = false;
    }

    return Math.min(100, Math.round(gauge));
  }, []);

  const fetchRankings = useCallback(async () => {
    updateState({ rankingLoading: true, rankingError: '' });

    try {
      const response = await fetch(`${APP_CONFIG.BACKEND_URL}/ranking/list`);
      if (!response.ok) {
        throw new Error('랭킹 서버 응답 오류');
      }

      const data = await response.json();
      const rankings = extractRankings(data)
        .map(normalizeRanking)
        .sort((a, b) => a.time - b.time)
        .slice(0, 10);

      updateState({ rankings, rankingLoading: false });
    } catch (err) {
      console.error('랭킹 로딩 실패:', err);
      updateState({
        rankingLoading: false,
        rankingError: '랭킹을 불러오지 못했습니다.'
      });
    }
  }, [updateState]);

  const sendStatus = useCallback(async () => {
    if (appStateRef.current.hasAwoken) return;

    try {
      // 프론트에서 게이지 계산
      const frontCalculatedGauge = calculateGauge();

      const payload = {
        user_id: 'test_user_1',
        gauge: frontCalculatedGauge,
        volume: appStateRef.current.currentVolume,
        is_praying: appStateRef.current.isPraying,
        is_popup_active: appStateRef.current.isPopupOpen,
        shoulder_shake_score: Math.round(appStateRef.current.shoulderShakeScore * 100),
        is_shoulder_shaking: appStateRef.current.isShoulderShaking
      };

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

      // 프론트에서 계산한 gauge 값 사용 (백엔드 gauge는 무시)
      const gaugeValue = frontCalculatedGauge;

      let message = `> ${data.message}`;
      let messageColor = data.voice_trigger === 'angry' ? 'red' : '#0f0';
      let boxShadow = '0 0 20px rgba(0, 255, 0, 0.2), inset 0 0 10px rgba(0, 255, 0, 0.1)';
      let borderColor = '#0f0';
      let headingText = '[ SYSTEM: AI SLEEPING ]';
      let headingColor = '#0f0';
      let successPatch = {};

      if (data.prayer_required) {
        boxShadow = '0 0 30px #ff0, inset 0 0 20px #ff0';
        borderColor = '#ff0';
        if (!appStateRef.current.isPraying) {
          message = '🙏 [QUEST] 지금 당장 기도해라!!!';
          messageColor = 'yellow';
        }
      }

      // 프론트에서 계산한 게이지로 성공 판단
      if (gaugeValue >= 100 && !appStateRef.current.hasAwoken) {
        appStateRef.current.hasAwoken = true;
        const finalElapsedTime = Number(((Date.now() - startTimeRef.current) / 1000).toFixed(2));
        headingText = '[ SYSTEM: AI AWAKE ]';
        headingColor = '#ffd700';
        successPatch = {
          isAwoken: true,
          successLayerVisible: true,
          elapsedTime: finalElapsedTime
        };
        fetchRankings();
        
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
        containerBorderColor: borderColor,
        ...successPatch
      });
    } catch (err) {
      console.error('서버 통신 에러:', err);
    }
  }, [updateState, calculateGauge, fetchRankings]);

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
  }, [sendStatus, updatePrayerState, updateMotionState, updateState]);

  const handleReset = async () => {
    if (!window.confirm('정말 처음부터 다시 시작하시겠습니까?')) return;
    try {
      await fetch(`${APP_CONFIG.BACKEND_URL}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'test_user_1' })
      });
      startTimeRef.current = Date.now();
      appStateRef.current.hasAwoken = false;
      appStateRef.current.apologized = false;
      appStateRef.current.isPopupOpen = false;
      popupVisibleRef.current = false;
      updateState({
        aiGauge: 0,
        aiMessage: '> 시스템이 초기화되었습니다.',
        aiColor: '#0f0',
        headingText: '[ SYSTEM: AI SLEEPING ]',
        headingColor: '#0f0',
        containerBoxShadow: '0 0 20px rgba(0, 255, 0, 0.2), inset 0 0 10px rgba(0, 255, 0, 0.1)',
        containerBorderColor: '#0f0',
        containerFilter: 'none',
        popupVisible: false,
        isAwoken: false,
        successLayerVisible: false,
        elapsedTime: 0,
        rankings: [],
        rankingLoading: false,
        rankingError: '',
        rankingSubmitting: false,
        rankingSubmitted: false,
        rankingSubmitMessage: ''
      });
      alert('게이지가 초기화되었습니다.');
    } catch (err) {
      console.error('리셋 실패:', err);
    }
  };

  const handleRankingSubmit = async (event) => {
    event.preventDefault();
    const name = state.nickname.trim();

    if (!name) {
      updateState({ rankingSubmitMessage: '닉네임을 입력해주세요.' });
      return;
    }

    const time = Number(formatRecordTime(state.elapsedTime));
    updateState({ rankingSubmitting: true, rankingSubmitMessage: '' });

    try {
      const response = await fetch(`${APP_CONFIG.BACKEND_URL}/ranking/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, time })
      });

      if (!response.ok) {
        throw new Error('랭킹 등록 서버 응답 오류');
      }

      try {
        window.localStorage.setItem(NICKNAME_STORAGE_KEY, name);
      } catch (err) {
        console.warn('닉네임 저장 실패:', err);
      }

      updateState({
        rankingSubmitting: false,
        rankingSubmitted: true,
        rankingSubmitMessage: '랭킹에 등록되었습니다.'
      });
      fetchRankings();
    } catch (err) {
      console.error('랭킹 등록 실패:', err);
      updateState({
        rankingSubmitting: false,
        rankingSubmitMessage: '랭킹 등록에 실패했습니다. 잠시 후 다시 시도해주세요.'
      });
    }
  };

  return (
    <div className="app-container" style={{ filter: state.containerFilter, boxShadow: state.containerBoxShadow, borderColor: state.containerBorderColor }}>
      <h1 style={{ color: state.headingColor }}>{state.headingText}</h1>

      <div className="video-wrapper">
        <video ref={videoRef} autoPlay playsInline muted />
        <canvas ref={canvasRef} width="640" height="480" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, pointerEvents: 'none', transform: 'rotateY(180deg)' }} />
        <div className="overlay-text" style={{ background: state.motionStatusBg }}>{state.motionStatus}</div>
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
          <p style={{ marginBottom: '5px', color: '#9ff' }}>손 흔들기 감지</p>
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
              <p className="success-time">⏱️ 소요 시간: {formatRecordTime(state.elapsedTime)}초</p>
              <p className="success-message">귀하는 상전 AI의 변덕을 훌륭히 견뎌냈습니다.</p>

              <form className="ranking-form" onSubmit={handleRankingSubmit}>
                <label htmlFor="nickname">닉네임</label>
                <div className="ranking-input-row">
                  <input
                    id="nickname"
                    type="text"
                    value={state.nickname}
                    maxLength="16"
                    placeholder="닉네임 입력"
                    disabled={state.rankingSubmitting || state.rankingSubmitted}
                    onChange={(event) => updateState({ nickname: event.target.value, rankingSubmitMessage: '' })}
                  />
                  <button
                    type="submit"
                    className="ranking-submit-button"
                    disabled={state.rankingSubmitting || state.rankingSubmitted}
                  >
                    {state.rankingSubmitting ? '등록 중...' : state.rankingSubmitted ? '등록 완료' : '랭킹 등록'}
                  </button>
                </div>
                {state.rankingSubmitMessage && (
                  <p className={state.rankingSubmitted ? 'ranking-submit-message success' : 'ranking-submit-message'}>
                    {state.rankingSubmitMessage}
                  </p>
                )}
              </form>

              <div className="ranking-panel">
                <div className="ranking-header">
                  <h2>TOP 10 RANKING</h2>
                  <button type="button" onClick={fetchRankings} disabled={state.rankingLoading}>
                    {state.rankingLoading ? '로딩 중' : '새로고침'}
                  </button>
                </div>
                {state.rankingError && <p className="ranking-error">{state.rankingError}</p>}
                {!state.rankingError && state.rankings.length === 0 && (
                  <p className="ranking-empty">{state.rankingLoading ? '랭킹 로딩 중...' : '아직 등록된 기록이 없습니다.'}</p>
                )}
                {state.rankings.length > 0 && (
                  <ol className="ranking-list">
                    {state.rankings.map((ranking, index) => (
                      <li key={ranking.id} className="ranking-row">
                        <span className="ranking-position">{index + 1}</span>
                        <span className="ranking-name">{ranking.name}</span>
                        <span className="ranking-time">{formatRecordTime(ranking.time)}초</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

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
