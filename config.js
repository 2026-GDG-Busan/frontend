// 상전 AI 모시기 - 프론트엔드 인식 및 UI 설정

export const APP_CONFIG = {
    // 서버 주소
    BACKEND_URL: import.meta.env.VITE_BACKEND_URL,

    // 소음 민원 팝업 설정
    POPUP: {
        VOL_THRESHOLD: 50,      // 이 볼륨보다 크면 타이머 상승
        TRIGGER_FRAMES: 60,     // 약 0.5초(60fps 기준) 지속 시 팝업 발생
        CLOSE_DELAY_MS: 1500    // 사과 성공 후 팝업이 닫히기까지 대기 시간
    },

    // 모션 인식(기도) 설정
    PRAY: {
        DISTANCE_THRESHOLD: 0.3, // 0.35 -> 0.2로 하향 (더 가까이 모아야 함)
        GRACE_PERIOD_MS: 500,    // 손이 하나로 겹쳤을 때 유지해 주는 시간
        FLICKER_PERIOD_MS: 500    // 추적 유실 시 잠깐 참아주는 시간
    },

    // 통신 설정
    SYNC_INTERVAL_MS: 1000      // 서버와 통신하는 주기
};
