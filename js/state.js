// 전역 상태 관리 모듈
export const state = {
    isPraying: false,
    currentVolume: 0,
    noiseTimer: 0,
    isSttListening: false,
    isPrayerRequired: false, // AI의 요구 상태 저장
    cameraBrightness: 100,
    cameraCoverScore: 0,
    isCameraCovered: false,
    shoulderShakeScore: 0,
    isShoulderShaking: false
};
