export type RemoveBackgroundMode = 'normal' | 'strong';

export function removeBackground(
  image: HTMLImageElement,
  options?: { mode?: RemoveBackgroundMode }
): string {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const width = canvas.width;
  const height = canvas.height;
  const mode: RemoveBackgroundMode = options?.mode ?? 'normal';
  const background = sampleBackgroundTone(data, width, height);
  const bgBrightness = (background.r + background.g + background.b) / 3;
  const tolerance = pickTolerance(data, width, height, background, mode);

  const bgMask = floodFillBackgroundMask(data, width, height, background, tolerance, bgBrightness);
  for (let i = 0; i < bgMask.length; i += 1) {
    if (!bgMask[i]) continue;
    data[i * 4 + 3] = 0;
  }

  stripPaperBackground(data, width, height, bgMask, background, tolerance, bgBrightness, mode);
  softenHalo(data, width, height, bgMask, background, tolerance, bgBrightness, mode);

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function sampleBackgroundTone(data: Uint8ClampedArray, width: number, height: number) {
  const sampleSize = Math.max(6, Math.floor(Math.min(width, height) * 0.08));
  const points = [
    { startX: 0, startY: 0 },
    { startX: width - sampleSize, startY: 0 },
    { startX: 0, startY: height - sampleSize },
    { startX: width - sampleSize, startY: height - sampleSize },
  ];
  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;

  for (const point of points) {
    for (let y = point.startY; y < point.startY + sampleSize; y += 1) {
      for (let x = point.startX; x < point.startX + sampleSize; x += 1) {
        const index = (y * width + x) * 4;
        totalR += data[index];
        totalG += data[index + 1];
        totalB += data[index + 2];
        count += 1;
      }
    }
  }

  return {
    r: totalR / count,
    g: totalG / count,
    b: totalB / count,
  };
}

function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function clampAlpha(value: number) {
  return Math.round(Math.max(0, Math.min(1, value)) * 255);
}

function pickTolerance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  background: { r: number; g: number; b: number },
  mode: RemoveBackgroundMode
) {
  const sampleSize = Math.max(6, Math.floor(Math.min(width, height) * 0.06));
  const points = [
    { startX: 0, startY: 0 },
    { startX: width - sampleSize, startY: 0 },
    { startX: 0, startY: height - sampleSize },
    { startX: width - sampleSize, startY: height - sampleSize },
  ];
  const distances: number[] = [];
  for (const point of points) {
    for (let y = point.startY; y < point.startY + sampleSize; y += 2) {
      for (let x = point.startX; x < point.startX + sampleSize; x += 2) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        distances.push(colorDistance(r, g, b, background.r, background.g, background.b));
      }
    }
  }
  distances.sort((a, b) => a - b);
  const p90 = distances[Math.floor(distances.length * 0.9)] ?? 40;
  const base = p90 * 1.8 + 12;
  const boost = mode === 'strong' ? 12 : 0;
  return Math.max(35, Math.min(105, base + boost));
}

function floodFillBackgroundMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  background: { r: number; g: number; b: number },
  tolerance: number,
  bgBrightness: number
) {
  const size = width * height;
  const mask = new Uint8Array(size);
  const visited = new Uint8Array(size);
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;

  const enqueue = (idx: number) => {
    if (visited[idx]) return;
    visited[idx] = 1;
    queue[tail] = idx;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + (width - 1));
  }

  while (head < tail) {
    const idx = queue[head];
    head += 1;
    const px = idx % width;
    const py = (idx - px) / width;
    const base = idx * 4;
    const a = data[base + 3];
    if (a === 0) continue;
    const r = data[base];
    const g = data[base + 1];
    const b = data[base + 2];
    const brightness = (r + g + b) / 3;
    const distance = colorDistance(r, g, b, background.r, background.g, background.b);
    const whiteness = Math.min(r, g, b) / Math.max(Math.max(r, g, b), 1);

    const isBg = distance < tolerance && brightness > bgBrightness - 32 && whiteness > 0.55;
    if (!isBg) continue;

    mask[idx] = 1;
    if (px > 0) enqueue(idx - 1);
    if (px < width - 1) enqueue(idx + 1);
    if (py > 0) enqueue(idx - width);
    if (py < height - 1) enqueue(idx + width);
  }

  return mask;
}

function softenHalo(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bgMask: Uint8Array,
  background: { r: number; g: number; b: number },
  tolerance: number,
  bgBrightness: number,
  mode: RemoveBackgroundMode
) {
  const getIndex = (x: number, y: number) => y * width + x;
  const isBg = (x: number, y: number) => bgMask[getIndex(x, y)] === 1;
  const limit = tolerance * (mode === 'strong' ? 1.55 : 1.35);
  const neighborThreshold = mode === 'strong' ? 3 : 4;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = getIndex(x, y);
      if (bgMask[idx]) continue;
      let bgNeighbors = 0;
      if (isBg(x - 1, y)) bgNeighbors += 1;
      if (isBg(x + 1, y)) bgNeighbors += 1;
      if (isBg(x, y - 1)) bgNeighbors += 1;
      if (isBg(x, y + 1)) bgNeighbors += 1;
      if (isBg(x - 1, y - 1)) bgNeighbors += 1;
      if (isBg(x + 1, y - 1)) bgNeighbors += 1;
      if (isBg(x - 1, y + 1)) bgNeighbors += 1;
      if (isBg(x + 1, y + 1)) bgNeighbors += 1;

      if (bgNeighbors < neighborThreshold) continue;
      const base = idx * 4;
      const r = data[base];
      const g = data[base + 1];
      const b = data[base + 2];
      const brightness = (r + g + b) / 3;
      if (brightness < bgBrightness - 24) continue;
      const distance = colorDistance(r, g, b, background.r, background.g, background.b);
      if (distance > limit) continue;
      const currentAlpha = data[base + 3];
      const divisor = tolerance * (mode === 'strong' ? 0.62 : 0.55);
      const nextAlpha = clampAlpha((distance - tolerance * 0.55) / divisor);
      data[base + 3] = Math.min(currentAlpha, nextAlpha);
    }
  }
}

function stripPaperBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bgMask: Uint8Array,
  background: { r: number; g: number; b: number },
  tolerance: number,
  bgBrightness: number,
  mode: RemoveBackgroundMode
) {
  const darkSamples: number[] = [];
  const colorSamples: number[] = [];

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const idx = y * width + x;
      if (bgMask[idx]) continue;
      const base = idx * 4;
      const r = data[base];
      const g = data[base + 1];
      const b = data[base + 2];
      const brightness = (r + g + b) / 3;
      const darkness = bgBrightness - brightness;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const distance = colorDistance(r, g, b, background.r, background.g, background.b);
      darkSamples.push(darkness);
      colorSamples.push(Math.max(chroma, distance * 0.7));
    }
  }

  darkSamples.sort((a, b) => a - b);
  colorSamples.sort((a, b) => a - b);
  const darkPivot = darkSamples[Math.floor(darkSamples.length * 0.68)] ?? 20;
  const colorPivot = colorSamples[Math.floor(colorSamples.length * 0.68)] ?? 18;
  const keepBoost = mode === 'strong' ? 1.35 : 1;
  const keepDarkness = Math.max(18, Math.min(86, (darkPivot + 8) * keepBoost));
  const keepColor = Math.max(14, Math.min(70, (colorPivot + 6) * keepBoost));
  const fadeDistance = tolerance * (mode === 'strong' ? 1.35 : 1.08);
  const edgeWeight = mode === 'strong' ? 0.68 : 0.45;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      if (bgMask[idx]) continue;
      const base = idx * 4;
      const currentAlpha = data[base + 3];
      if (currentAlpha === 0) continue;

      const r = data[base];
      const g = data[base + 1];
      const b = data[base + 2];
      const brightness = (r + g + b) / 3;
      const darkness = bgBrightness - brightness;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const distance = colorDistance(r, g, b, background.r, background.g, background.b);

      const darknessScore = clamp01(darkness / keepDarkness);
      const colorScore = clamp01(Math.max(chroma, distance * 0.72) / keepColor);
      const inkScore = Math.max(darknessScore, colorScore);
      const edgeScore = edgeStrength(data, width, height, x, y, brightness);
      const keepScore = Math.max(inkScore, edgeScore * edgeWeight);

      if (keepScore < (mode === 'strong' ? 0.24 : 0.18) && distance < fadeDistance) {
        data[base + 3] = 0;
        continue;
      }

      if (keepScore < (mode === 'strong' ? 0.78 : 0.72) && distance < fadeDistance * 1.15) {
        const softStart = mode === 'strong' ? 0.24 : 0.18;
        const softRange = mode === 'strong' ? 0.54 : 0.54;
        const softenedAlpha = clampAlpha((keepScore - softStart) / softRange);
        data[base + 3] = Math.min(currentAlpha, softenedAlpha);
      }
    }
  }
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function edgeStrength(data: Uint8ClampedArray, width: number, height: number, x: number, y: number, centerBrightness: number) {
  if (x <= 0 || y <= 0 || x >= width - 1 || y >= height - 1) return 0;
  const b = (xx: number, yy: number) => {
    const base = (yy * width + xx) * 4;
    return (data[base] + data[base + 1] + data[base + 2]) / 3;
  };
  const dx = Math.abs(b(x + 1, y) - b(x - 1, y));
  const dy = Math.abs(b(x, y + 1) - b(x, y - 1));
  const diag = Math.max(
    Math.abs(b(x + 1, y + 1) - b(x - 1, y - 1)),
    Math.abs(b(x + 1, y - 1) - b(x - 1, y + 1))
  );
  const strength = Math.max(dx, dy, diag);
  const normalized = strength / Math.max(36, Math.max(12, centerBrightness * 0.16));
  return clamp01(normalized);
}
