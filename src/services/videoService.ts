import { Frame, Music, OutputAspect } from '@/types';

type PreviewScene = {
  scaleStart: number;
  scaleEnd: number;
  offsetXStart: number;
  offsetXEnd: number;
  offsetYStart: number;
  offsetYEnd: number;
  rotationStart: number;
  rotationEnd: number;
};

const PREVIEW_SCENES: PreviewScene[] = [
  { scaleStart: 1.02, scaleEnd: 1.14, offsetXStart: -18, offsetXEnd: 10, offsetYStart: 8, offsetYEnd: -6, rotationStart: -0.015, rotationEnd: 0.01 },
  { scaleStart: 1.12, scaleEnd: 1.04, offsetXStart: 22, offsetXEnd: -24, offsetYStart: -10, offsetYEnd: 14, rotationStart: 0.012, rotationEnd: -0.008 },
  { scaleStart: 1.03, scaleEnd: 1.18, offsetXStart: -10, offsetXEnd: 0, offsetYStart: 12, offsetYEnd: -18, rotationStart: -0.01, rotationEnd: 0.018 },
];

export async function generateVideo(
  calligraphyImage: string,
  frame: Frame,
  music: Music,
  imageScale: number,
  frameScale: number,
  imageOffsetX: number,
  imageOffsetY: number,
  imageRotation: number,
  frameRotation: number,
  onProgress: (progress: number) => void,
  previewSnapshot?: string | null,
  outputAspect: OutputAspect = '9:16',
  duration: number = 15
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    if (typeof (canvas as HTMLCanvasElement & { captureStream?: unknown }).captureStream !== 'function') {
      reject(new Error('当前浏览器不支持画布录制（captureStream），请更换 Chrome/Edge'));
      return;
    }
    if (typeof (window as unknown as { MediaRecorder?: unknown }).MediaRecorder === 'undefined') {
      reject(new Error('当前浏览器不支持 MediaRecorder，无法生成视频，请更换 Chrome/Edge'));
      return;
    }
    const { width, height } = getCanvasSize(outputAspect);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    Promise.all([
      loadImage((previewSnapshot || calligraphyImage)),
      previewSnapshot ? Promise.resolve(null) : loadImage(frame.previewImage).catch(() => null),
      loadAudioForCapture(music.url).catch(() => null),
    ])
      .then(([img, frameImg, capturedAudio]) => {
      const canvasStream = canvas.captureStream(30);
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...(capturedAudio?.stream.getAudioTracks() ?? []),
      ]);
      const mimeType = pickMediaRecorderMimeType();
      const mediaRecorder = new MediaRecorder(combinedStream, mimeType ? { mimeType } : undefined);
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      mediaRecorder.onstop = () => {
        capturedAudio?.element.pause();
        capturedAudio?.element.remove();
        capturedAudio?.stream.getTracks().forEach((track) => track.stop());
        canvasStream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'video/webm' });
        resolve(blob);
      };
      
      mediaRecorder.start();
      if (capturedAudio) {
        capturedAudio.element.currentTime = 0;
        capturedAudio.element.play().catch(() => {});
      }
      
      let startTime = 0;
      
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const elapsed = (timestamp - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        
        ctx.fillStyle = '#f5f0e6';
        ctx.fillRect(0, 0, width, height);
        drawBackgroundAtmosphere(ctx, width, height, progress);

        if (previewSnapshot) {
          drawPreviewSnapshotVideo(ctx, img, width, height, progress);
        } else {
          if (frameImg) {
            drawScaledFrame(ctx, frameImg, width, height, frameScale, frameRotation);
          } else {
            drawFrameFallback(ctx, width, height, frame, frameScale, frameRotation);
          }
          const eased = easeInOutCubic(progress);
          const breathe = Math.sin(progress * Math.PI * 2.8) * 0.018;
          const floatY = Math.sin(progress * Math.PI * 2) * 10;
          const driftX = Math.cos(progress * Math.PI * 1.6) * 8;
          const rotation = Math.sin(progress * Math.PI * 1.4) * 0.02;
          const safeArea = getSafeArea(frame.category, width, height, frameScale, frameRotation, outputAspect);
          const imageFit = fitContain(img.width, img.height, safeArea.width, safeArea.height);
          const zoom = imageScale * (0.92 + eased * 0.08 + breathe);
          const imgWidth = imageFit.width * zoom;
          const imgHeight = imageFit.height * zoom;
          const x = safeArea.x + (safeArea.width - imgWidth) / 2 + imageOffsetX + driftX;
          const y = safeArea.y + (safeArea.height - imgHeight) / 2 + imageOffsetY + floatY;

          ctx.save();
          ctx.translate(x + imgWidth / 2, y + imgHeight / 2);
          ctx.rotate(rotation + toRadians(imageRotation));
          ctx.globalAlpha = Math.min(progress * 2.4, 1);
          ctx.shadowColor = 'rgba(72, 42, 14, 0.22)';
          ctx.shadowBlur = 24;
          ctx.shadowOffsetY = 12;
          ctx.drawImage(img, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
          ctx.restore();
          ctx.globalAlpha = 1;
          drawPaperHighlight(ctx, x, y, imgWidth, imgHeight, progress);
        }
        drawLightSweep(ctx, width, height, progress);
        drawVignette(ctx, width, height);

        onProgress(Math.floor(progress * 100));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          mediaRecorder.stop();
        }
      };
      
      requestAnimationFrame(animate);
      })
      .catch(() => {
        reject(new Error('Failed to load image'));
      });
  });
}

export async function renderPreviewSnapshot(
  calligraphyImage: string,
  frame: Frame,
  imageScale: number,
  frameScale: number,
  imageOffsetX: number,
  imageOffsetY: number,
  imageRotation: number,
  frameRotation: number,
  outputAspect: OutputAspect = '9:16'
): Promise<string | null> {
  const { width, height } = getCanvasSize(outputAspect);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const [img, frameImg] = await Promise.all([
    loadImage(calligraphyImage),
    loadImage(frame.previewImage).catch(() => null),
  ]);

  ctx.fillStyle = '#f5f0e6';
  ctx.fillRect(0, 0, width, height);
  drawBackgroundAtmosphere(ctx, width, height, 0);

  if (frameImg) {
    drawScaledFrame(ctx, frameImg, width, height, frameScale, frameRotation);
  } else {
    drawFrameFallback(ctx, width, height, frame, frameScale, frameRotation);
  }

  const safeArea = getSafeArea(frame.category, width, height, frameScale, frameRotation, outputAspect);
  const imageFit = fitContain(img.width, img.height, safeArea.width, safeArea.height);
  const imgWidth = imageFit.width * imageScale;
  const imgHeight = imageFit.height * imageScale;
  const x = safeArea.x + (safeArea.width - imgWidth) / 2 + imageOffsetX;
  const y = safeArea.y + (safeArea.height - imgHeight) / 2 + imageOffsetY;

  ctx.save();
  ctx.translate(x + imgWidth / 2, y + imgHeight / 2);
  ctx.rotate(toRadians(imageRotation));
  ctx.shadowColor = 'rgba(72, 42, 14, 0.22)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 12;
  ctx.drawImage(img, -imgWidth / 2, -imgHeight / 2, imgWidth, imgHeight);
  ctx.restore();
  drawPaperHighlight(ctx, x, y, imgWidth, imgHeight, 0);
  drawVignette(ctx, width, height);

  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function drawBackgroundAtmosphere(ctx: CanvasRenderingContext2D, width: number, height: number, progress: number) {
  const glow = ctx.createRadialGradient(width * 0.25, height * 0.2, 30, width * 0.25, height * 0.2, width * 0.5);
  glow.addColorStop(0, 'rgba(255, 242, 204, 0.55)');
  glow.addColorStop(1, 'rgba(255, 242, 204, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 16; i += 1) {
    const x = (i / 15) * width;
    const y = Math.sin(progress * 4 + i) * 10;
    ctx.fillStyle = i % 2 === 0 ? '#8c6a3d' : '#d6b98b';
    ctx.fillRect(x, y, 2, height);
  }
  ctx.restore();
}

function drawPaperHighlight(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, progress: number) {
  ctx.save();
  ctx.globalAlpha = 0.14;
  const gradient = ctx.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.1)');
  gradient.addColorStop(1, 'rgba(140,106,61,0.08)');
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, width, height);

  ctx.globalAlpha = 0.08 + progress * 0.04;
  ctx.strokeStyle = 'rgba(120, 82, 40, 0.35)';
  ctx.strokeRect(x + 4, y + 4, width - 8, height - 8);
  ctx.restore();
}

function drawLightSweep(ctx: CanvasRenderingContext2D, width: number, height: number, progress: number) {
  ctx.save();
  ctx.globalAlpha = 0.15;
  const sweepWidth = width * 0.18;
  const sweepX = -sweepWidth + (width + sweepWidth * 2) * progress;
  const gradient = ctx.createLinearGradient(sweepX, 0, sweepX + sweepWidth, 0);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(sweepX, 0, sweepWidth, height);
  ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const vignette = ctx.createRadialGradient(width / 2, height / 2, height * 0.18, width / 2, height / 2, height * 0.8);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(56,34,12,0.18)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

function drawPreviewSnapshotVideo(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
  progress: number
) {
  const scenes = PREVIEW_SCENES;
  const sceneCount = scenes.length;
  const scaledProgress = progress * sceneCount;
  const sceneIndex = Math.min(Math.floor(scaledProgress), sceneCount - 1);
  const localProgress = scaledProgress - sceneIndex;
  const scene = scenes[sceneIndex];
  const transitionWindow = 0.2;
  const transitionStart = 1 - transitionWindow;

  if (localProgress <= transitionStart || sceneIndex === sceneCount - 1) {
    const current = interpolateScene(scene, localProgress);
    drawKenBurnsFrame(ctx, img, width, height, current, 1);
    return;
  }

  const nextProgress = (localProgress - transitionStart) / transitionWindow;
  const easedTransition = easeInOutCubic(nextProgress);
  const current = interpolateScene(scene, localProgress);
  const nextScene = scenes[sceneIndex + 1];
  const next = interpolateScene(nextScene, nextProgress * 0.35);

  drawKenBurnsFrame(ctx, img, width, height, current, 1);
  drawTransitionOverlay(ctx, width, height, easedTransition);
  drawKenBurnsFrame(ctx, img, width, height, next, easedTransition);
}

function interpolateScene(
  scene: PreviewScene,
  progress: number
) {
  const eased = easeInOutCubic(progress);
  return {
    scale: lerp(scene.scaleStart, scene.scaleEnd, eased),
    offsetX: lerp(scene.offsetXStart, scene.offsetXEnd, eased),
    offsetY: lerp(scene.offsetYStart, scene.offsetYEnd, eased),
    rotation: lerp(scene.rotationStart, scene.rotationEnd, eased),
  };
}

function drawKenBurnsFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
  transform: { scale: number; offsetX: number; offsetY: number; rotation: number },
  alpha: number
) {
  const fit = fitCover(img.width, img.height, width, height);
  const drawWidth = fit.width * transform.scale;
  const drawHeight = fit.height * transform.scale;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(width / 2 + transform.offsetX, height / 2 + transform.offsetY);
  ctx.rotate(transform.rotation);
  ctx.shadowColor = 'rgba(72, 42, 14, 0.18)';
  ctx.shadowBlur = 24;
  ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

function drawTransitionOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, progress: number) {
  ctx.save();
  const eased = easeInOutCubic(progress);
  const sweepWidth = width * 0.24;
  const sweepX = -sweepWidth + (width + sweepWidth * 2) * eased;
  const gradient = ctx.createLinearGradient(sweepX, 0, sweepX + sweepWidth, 0);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.18)');
  gradient.addColorStop(0.5, 'rgba(255,248,228,0.92)');
  gradient.addColorStop(0.65, 'rgba(255,255,255,0.18)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = gradient;
  ctx.fillRect(sweepX, 0, sweepWidth, height);

  const veil = ctx.createLinearGradient(0, 0, 0, height);
  veil.addColorStop(0, 'rgba(255,250,235,0.02)');
  veil.addColorStop(0.5, `rgba(255,250,235,${0.08 * eased})`);
  veil.addColorStop(1, 'rgba(86,56,22,0.05)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const cleanSrc = src.trim().replace(/[`"' ]/g, '');
  const isLocal = cleanSrc.startsWith('data:') || cleanSrc.startsWith('blob:');

  const create = (useCors: boolean) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      if (!isLocal && useCors) {
        img.crossOrigin = 'anonymous';
      }
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = cleanSrc;
    });

  if (isLocal) return create(false);

  return create(true).catch(() => create(false));
}

async function loadAudioForCapture(src: string): Promise<{ element: HTMLAudioElement; stream: MediaStream } | null> {
  const cleanSrc = src.trim().replace(/[`"' ]/g, '');
  if (!cleanSrc) return null;

  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    const audioWithCapture = audio as HTMLAudioElement & {
      captureStream?: () => MediaStream;
      mozCaptureStream?: () => MediaStream;
    };

    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.src = cleanSrc;
    audio.style.display = 'none';
    document.body.appendChild(audio);

    const cleanup = () => {
      audio.oncanplaythrough = null;
      audio.onerror = null;
    };

    audio.oncanplaythrough = () => {
      cleanup();
      const stream = audioWithCapture.captureStream?.() ?? audioWithCapture.mozCaptureStream?.();
      if (!stream) {
        audio.remove();
        resolve(null);
        return;
      }
      resolve({ element: audio, stream });
    };

    audio.onerror = () => {
      cleanup();
      audio.remove();
      reject(new Error('Failed to load audio'));
    };
  });
}

function pickMediaRecorderMimeType() {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a',
    'video/mp4',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
  ];
  for (const candidate of candidates) {
    if ((window as unknown as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder?.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return '';
}

function fitContain(sourceWidth: number, sourceHeight: number, maxWidth: number, maxHeight: number) {
  const ratio = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
  return {
    width: sourceWidth * ratio,
    height: sourceHeight * ratio,
  };
}

function fitCover(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  const ratio = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  return {
    width: sourceWidth * ratio,
    height: sourceHeight * ratio,
  };
}

function getSafeArea(
  category: Frame['category'],
  width: number,
  height: number,
  frameScale: number,
  frameRotation: number,
  outputAspect: OutputAspect
) {
  const baseArea = category === 'scroll'
    ? {
        x: width * 0.24,
        y: height * 0.14,
        width: width * 0.52,
        height: height * 0.72,
      }
    : {
        x: width * 0.15,
        y: height * 0.13,
        width: width * 0.7,
        height: height * 0.74,
      };

  const scaled = scaleRectFromCenter(baseArea, width / 2, height / 2, frameScale);
  const rotatedRect = isQuarterTurn(frameRotation) ? swapRectAroundCenter(scaled) : scaled;
  const targetRatio = getAspectRatio(outputAspect);
  return fitRectToAspect(rotatedRect, targetRatio);
}

function drawFrameFallback(ctx: CanvasRenderingContext2D, width: number, height: number, frame: Frame, frameScale: number, frameRotation: number) {
  const quarterTurn = isQuarterTurn(frameRotation);
  const fitted = fitContain(
    width,
    height,
    quarterTurn ? height * frameScale : width * frameScale,
    quarterTurn ? width * frameScale : height * frameScale
  );
  const scaledWidth = fitted.width;
  const scaledHeight = fitted.height;
  const padding = 80;
  const offsetX = -scaledWidth / 2;
  const offsetY = -scaledHeight / 2;

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(toRadians(frameRotation));
  ctx.strokeStyle = '#c19a6b';
  ctx.lineWidth = 3;
  ctx.strokeRect(offsetX + padding, offsetY + padding, scaledWidth - padding * 2, scaledHeight - padding * 2);
  
  ctx.strokeStyle = '#2c5f2d';
  ctx.lineWidth = 1;
  ctx.strokeRect(offsetX + padding + 10, offsetY + padding + 10, scaledWidth - padding * 2 - 20, scaledHeight - padding * 2 - 20);
  
  if (frame.category === 'scroll') {
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(offsetX + padding - 20, offsetY + padding - 20, 20, 30);
    ctx.fillRect(offsetX + padding - 20, offsetY + scaledHeight - padding - 10, 20, 30);
    ctx.fillRect(offsetX + scaledWidth - padding, offsetY + padding - 20, 20, 30);
    ctx.fillRect(offsetX + scaledWidth - padding, offsetY + scaledHeight - padding - 10, 20, 30);
  }
  ctx.restore();
}

function drawScaledFrame(
  ctx: CanvasRenderingContext2D,
  frameImg: HTMLImageElement,
  width: number,
  height: number,
  frameScale: number,
  frameRotation: number
) {
  const quarterTurn = isQuarterTurn(frameRotation);
  const fitted = fitContain(
    frameImg.width,
    frameImg.height,
    quarterTurn ? height * frameScale : width * frameScale,
    quarterTurn ? width * frameScale : height * frameScale
  );
  const drawWidth = fitted.width;
  const drawHeight = fitted.height;
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(toRadians(frameRotation));
  ctx.drawImage(frameImg, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

function scaleRectFromCenter(
  rect: { x: number; y: number; width: number; height: number },
  centerX: number,
  centerY: number,
  scale: number
) {
  const rectCenterX = rect.x + rect.width / 2;
  const rectCenterY = rect.y + rect.height / 2;
  const scaledWidth = rect.width * scale;
  const scaledHeight = rect.height * scale;
  const offsetCenterX = centerX + (rectCenterX - centerX) * scale;
  const offsetCenterY = centerY + (rectCenterY - centerY) * scale;

  return {
    x: offsetCenterX - scaledWidth / 2,
    y: offsetCenterY - scaledHeight / 2,
    width: scaledWidth,
    height: scaledHeight,
  };
}

function swapRectAroundCenter(rect: { x: number; y: number; width: number; height: number }) {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  return {
    x: centerX - rect.height / 2,
    y: centerY - rect.width / 2,
    width: rect.height,
    height: rect.width,
  };
}

function isQuarterTurn(rotation: number) {
  const normalized = normalizeRotation(rotation);
  return normalized === 90 || normalized === 270;
}

function normalizeRotation(value: number) {
  const next = value % 360;
  return next < 0 ? next + 360 : next;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function getCanvasSize(aspect: OutputAspect) {
  if (aspect === '1:1') return { width: 1080, height: 1080 };
  if (aspect === '16:9') return { width: 1280, height: 720 };
  return { width: 720, height: 1280 };
}

function getAspectRatio(aspect: OutputAspect) {
  if (aspect === '1:1') return 1;
  if (aspect === '16:9') return 16 / 9;
  return 9 / 16;
}

function fitRectToAspect(rect: { x: number; y: number; width: number; height: number }, ratio: number) {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  const rectRatio = rect.width / rect.height;
  if (Math.abs(rectRatio - ratio) < 0.0001) return rect;

  if (rectRatio > ratio) {
    const nextWidth = rect.height * ratio;
    return {
      x: centerX - nextWidth / 2,
      y: rect.y,
      width: nextWidth,
      height: rect.height,
    };
  }

  const nextHeight = rect.width / ratio;
  return {
    x: rect.x,
    y: centerY - nextHeight / 2,
    width: rect.width,
    height: nextHeight,
  };
}
