import { useAppStore } from '@/store/appStore';
import { Eye, Image as ImageIcon, Scaling, Frame, RotateCcw, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, LocateFixed } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { renderPreviewSnapshot } from '@/services/videoService';

export function PreviewPanel() {
  const {
    originalImageUrl,
    processedImage,
    selectedFrame,
    outputAspect,
    setOutputAspect,
    imageScale,
    setImageScale,
    frameScale,
    setFrameScale,
    imageOffsetX,
    imageOffsetY,
    moveImagePosition,
    resetImagePosition,
    imageRotation,
    frameRotation,
    rotateImageLeft,
    rotateFrameLeft,
    previewSnapshot,
    setPreviewSnapshot,
  } = useAppStore();
  const imageToShow = processedImage || originalImageUrl;
  const [isRendering, setIsRendering] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    const update = () => {
      setViewportSize({
        width: node.clientWidth || 1,
        height: node.clientHeight || 1,
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!imageToShow || !selectedFrame) {
        setPreviewSnapshot(null);
        return;
      }
      setIsRendering(true);
      try {
        const snapshot = await renderPreviewSnapshot(
          imageToShow,
          selectedFrame,
          imageScale,
          frameScale,
          imageOffsetX,
          imageOffsetY,
          imageRotation,
          frameRotation,
          outputAspect
        );
        if (!cancelled) {
          setPreviewSnapshot(snapshot);
        }
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [imageToShow, selectedFrame, imageScale, frameScale, imageOffsetX, imageOffsetY, imageRotation, frameRotation, outputAspect, setPreviewSnapshot]);

  const rotationFitScale = useMemo(() => {
    const ratio = Math.min(
      viewportSize.width / viewportSize.height,
      viewportSize.height / viewportSize.width
    );
    return {
      image: imageRotation % 180 === 0 ? 1 : ratio,
      frame: frameRotation % 180 === 0 ? 1 : ratio,
    };
  }, [viewportSize.width, viewportSize.height, imageRotation, frameRotation]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2">
        <Eye className="w-5 h-5" />
        实时预览
      </h3>

      <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-3">
        <div className="mb-2 flex items-center justify-between text-sm text-gray-700">
          <div className="flex items-center gap-2">
            <Scaling className="h-4 w-4" />
            原图大小适配
          </div>
          <span>{Math.round(imageScale * 100)}%</span>
        </div>
        <input
          type="range"
          min="60"
          max="140"
          step="1"
          value={Math.round(imageScale * 100)}
          onChange={(e) => setImageScale(Number(e.target.value) / 100)}
          className="w-full accent-amber-600"
        />
        <div className="mt-1 text-xs text-gray-500">
          调整书法原图在卷轴中的占比，让留白和装裱比例更自然。
        </div>
      </div>

      <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-3">
        <div className="mb-2 flex items-center justify-between text-sm text-gray-700">
          <span>画面比例</span>
          <span>{outputAspect}</span>
        </div>
        <select
          value={outputAspect}
          onChange={(e) => setOutputAspect(e.target.value as typeof outputAspect)}
          className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
        >
          <option value="9:16">9:16 竖屏</option>
          <option value="16:9">16:9 横屏</option>
          <option value="1:1">1:1 方图</option>
        </select>
        <div className="mt-1 text-xs text-gray-500">
          会同步影响实时预览快照、导出视频画面，以及 AI 画框生成的默认比例。
        </div>
      </div>

      <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-3">
        <div className="mb-2 flex items-center justify-between text-sm text-gray-700">
          <div className="flex items-center gap-2">
            <Frame className="h-4 w-4" />
            画框大小适配
          </div>
          <span>{Math.round(frameScale * 100)}%</span>
        </div>
        <input
          type="range"
          min="70"
          max="130"
          step="1"
          value={Math.round(frameScale * 100)}
          onChange={(e) => setFrameScale(Number(e.target.value) / 100)}
          className="w-full accent-amber-600"
        />
        <div className="mt-1 text-xs text-gray-500">
          调整画框在预览中的整体占比，让上传图片和画框位置更贴合。
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={rotateImageLeft}
          className="inline-flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-3 text-sm text-gray-700 hover:bg-amber-50"
        >
          <span className="inline-flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            原图向左旋转
          </span>
          <span>{imageRotation}deg</span>
        </button>
        <button
          type="button"
          onClick={rotateFrameLeft}
          className="inline-flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-3 text-sm text-gray-700 hover:bg-amber-50"
        >
          <span className="inline-flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            画框向左旋转
          </span>
          <span>{frameRotation}deg</span>
        </button>
      </div>

      <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-3">
        <div className="mb-3 flex items-center justify-between text-sm text-gray-700">
          <div className="flex items-center gap-2">
            <LocateFixed className="h-4 w-4" />
            原图位置微调
          </div>
          <span>{imageOffsetX}px / {imageOffsetY}px</span>
        </div>
        <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto">
          <div />
          <button
            type="button"
            onClick={() => moveImagePosition(0, -12)}
            className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-white px-3 py-2 text-gray-700 hover:bg-amber-50"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <div />
          <button
            type="button"
            onClick={() => moveImagePosition(-12, 0)}
            className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-white px-3 py-2 text-gray-700 hover:bg-amber-50"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={resetImagePosition}
            className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-amber-50"
          >
            归位
          </button>
          <button
            type="button"
            onClick={() => moveImagePosition(12, 0)}
            className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-white px-3 py-2 text-gray-700 hover:bg-amber-50"
          >
            <ArrowRight className="h-4 w-4" />
          </button>
          <div />
          <button
            type="button"
            onClick={() => moveImagePosition(0, 12)}
            className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-white px-3 py-2 text-gray-700 hover:bg-amber-50"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <div />
        </div>
        <div className="mt-2 text-xs text-gray-500">
          可用上下左右按钮微调原图在画框留白区域中的落点，预览和导出会保持一致。
        </div>
      </div>

      <div
        ref={viewportRef}
        className="min-h-[460px] rounded-lg border overflow-hidden bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center p-4 sm:min-h-[520px] lg:min-h-[620px]"
      >
        {previewSnapshot ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={previewSnapshot}
              alt="Preview"
              className="max-h-full max-w-full object-contain"
              style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.12))' }}
            />
            {isRendering && (
              <div className="absolute bottom-3 right-3 rounded-md bg-black/50 px-2 py-1 text-xs text-white">
                渲染中…
              </div>
            )}
          </div>
        ) : imageToShow ? (
          <div className="relative w-full h-full flex items-center justify-center">
            {selectedFrame && (
              <div className="absolute inset-0 pointer-events-none">
                <img
                  src={selectedFrame.previewImage}
                  alt={selectedFrame.nameZh}
                  className="w-full h-full object-contain"
                  loading="lazy"
                  style={{
                    transform: `scale(${frameScale * rotationFitScale.frame}) rotate(${frameRotation}deg)`,
                    transformOrigin: 'center center',
                  }}
                />
              </div>
            )}
            <img
              src={imageToShow}
              alt="Preview"
              className="max-h-full max-w-full object-contain"
              style={{
                filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.12))',
                transform: `translate(${imageOffsetX}px, ${imageOffsetY}px) scale(${imageScale * rotationFitScale.image}) rotate(${imageRotation}deg)`,
                transformOrigin: 'center center',
              }}
            />
            <div className="absolute bottom-3 left-3 rounded-md bg-black/50 px-2 py-1 text-xs text-white">
              预览使用直渲染模式（画轴素材不支持跨域读取）
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-400">
            <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>上传图片后在此预览</p>
          </div>
        )}
      </div>
    </div>
  );
}
