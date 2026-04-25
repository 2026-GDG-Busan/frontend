export function initMotion({ canvasElement, canvasCtx, onPrayerChange, onMotionUpdate }) {
  let lastPrayTime = 0;
  let lastHandCenterX = null;
  let lastHandTime = Date.now();
  let shakeAccumulator = 0;
  let lastPrayState = false;

  const hands = new Hands({ locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  }});

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  hands.onResults((results) => {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    let currentIsPraying = false;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      for (const landmarks of results.multiHandLandmarks) {
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
        drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 1, radius: 2 });
      }

      if (results.multiHandLandmarks.length >= 2) {
        const hand1 = results.multiHandLandmarks[0];
        const hand2 = results.multiHandLandmarks[1];
        const dx = hand1[0].x - hand2[0].x;
        const dy = hand1[0].y - hand2[0].y;
        const dz = hand1[0].z - hand2[0].z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (distance < 0.3) {
          currentIsPraying = true;
          lastPrayTime = Date.now();
        }
      } else if (results.multiHandLandmarks.length === 1) {
        const hand = results.multiHandLandmarks[0];
        const isVertical = (hand[0].y - hand[12].y) > 0.12;
        const isCentered = Math.abs(hand[0].x - 0.5) < 0.2;

        if (isVertical && (Date.now() - lastPrayTime < 500)) {
          currentIsPraying = true;
          if (isCentered) {
            lastPrayTime = Date.now();
          }
        }
      }

      const handCenter = results.multiHandLandmarks.reduce((acc, landmarks) => {
        acc.x += landmarks[0].x;
        acc.y += landmarks[0].y;
        return acc;
      }, { x: 0, y: 0 });
      handCenter.x /= results.multiHandLandmarks.length;
      handCenter.y /= results.multiHandLandmarks.length;

      const now = Date.now();
      const dx = lastHandCenterX === null ? 0 : Math.abs(handCenter.x - lastHandCenterX);
      lastHandCenterX = handCenter.x;
      lastHandTime = now;

      if (handCenter.y > 0.2 && handCenter.y < 0.65 && dx > 0.05) {
        shakeAccumulator = Math.min(1, shakeAccumulator + Math.min(0.25, dx * 4));
      } else {
        shakeAccumulator *= 0.92;
      }
    } else {
      shakeAccumulator *= 0.85;
      if (Date.now() - lastPrayTime < 500) {
        currentIsPraying = true;
      }
    }

    shakeAccumulator = Math.max(0, Math.min(shakeAccumulator, 1));
    onMotionUpdate?.(shakeAccumulator, shakeAccumulator > 0.3);

    if (currentIsPraying !== lastPrayState) {
      lastPrayState = currentIsPraying;
      onPrayerChange?.(currentIsPraying);
    }

    canvasCtx.restore();
  });

  return hands;
}
