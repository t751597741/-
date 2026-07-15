import { useState } from 'react';
import { Eraser, Image as ImageIcon } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { removeBackground } from '@/services/imageService';
import { cn } from '@/lib/utils';

export function BackgroundRemover() {
  const { originalImageUrl, processedImage, setProcessedImage } = useAppStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [strongMode, setStrongMode] = useState(() => {
    try {
      return localStorage.getItem('bg_remove_strong') === '1';
    } catch {
      return false;
    }
  });

  const handleRemoveBackground = () => {
    if (!originalImageUrl) return;

    setIsProcessing(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const result = removeBackground(img, { mode: strongMode ? 'strong' : 'normal' });
      setProcessedImage(result);
      setIsProcessing(false);
    };
    img.onerror = () => {
      setIsProcessing(false);
    };
    img.src = originalImageUrl;
  };

  if (!originalImageUrl) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-800">背景去除</h3>
        <button
          onClick={handleRemoveBackground}
          disabled={isProcessing}
          className={cn(
            "px-4 py-2 rounded-lg flex items-center gap-2 transition-all",
            isProcessing
              ? "bg-gray-200 text-gray-500 cursor-not-allowed"
              : "bg-green-600 text-white hover:bg-green-700"
          )}
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              处理中...
            </>
          ) : (
            <>
              <Eraser className="w-4 h-4" />
              {processedImage ? "重新去除" : "去除背景"}
            </>
          )}
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={strongMode}
          onChange={(e) => {
            const next = e.target.checked;
            setStrongMode(next);
            try {
              localStorage.setItem('bg_remove_strong', next ? '1' : '0');
            } catch {
            }
          }}
          className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
        />
        强力去纸张（更干净，但可能会吃掉很浅的笔画）
      </label>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            原图
          </p>
          <div className="border rounded-lg overflow-hidden aspect-video bg-gray-100">
            <img src={originalImageUrl} alt="Original" className="w-full h-full object-contain" />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <Eraser className="w-4 h-4" />
            处理后
          </p>
          <div className="border rounded-lg overflow-hidden aspect-video bg-gray-100 flex items-center justify-center">
            {processedImage ? (
              <img src={processedImage} alt="Processed" className="w-full h-full object-contain" />
            ) : (
              <p className="text-gray-400 text-sm">点击上方按钮去除背景</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
