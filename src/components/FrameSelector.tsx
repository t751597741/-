import { Frame, OutputAspect } from '@/types';
import { useAppStore } from '@/store/appStore';
import { Image as ImageIcon, Check, Upload, Wand2, KeyRound, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

export function FrameSelector() {
  const { frames, selectedFrame, setSelectedFrame, addCustomFrame, addGeneratedFrame, removeFrame, outputAspect, setOutputAspect } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('古风卷轴画框背景，留白充足，宣纸质感，木质卷轴，上下横杆，柔和阴影，淡雅配色，高清，平面设计');
  const [frameResolution, setFrameResolution] = useState<'1K' | '2K'>('2K');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorText, setErrorText] = useState('');

  const handleCustomFrameUpload = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    addCustomFrame(file);
  };

  useEffect(() => {
    const saved = localStorage.getItem('yunwu_api_key') || '';
    setApiKey(saved);
  }, []);

  const handleGenerateFrame = async () => {
    const key = apiKey.trim();
    const p = prompt.trim();
    if (!key) {
      setErrorText('请先填写 API Key');
      return;
    }
    if (!p) {
      setErrorText('请先输入提示词');
      return;
    }

    setErrorText('');
    setIsGenerating(true);
    localStorage.setItem('yunwu_api_key', key);

    try {
      const promptWithAspect = `${p}。画面比例：${outputAspect}，注意画框留白区域与整体比例一致。`;
      const preferredSize = buildPreferredSize(outputAspect, frameResolution);
      const json = await requestGenerateFrame(key, promptWithAspect, preferredSize).catch(async () => {
        return requestGenerateFrame(key, promptWithAspect, frameResolution);
      });

      const url: string | undefined = (json as { data?: Array<{ url?: string }> })?.data?.[0]?.url;
      if (!url) {
        throw new Error('未获取到图片 URL');
      }

      const normalized = await normalizeGeneratedFrame(url, outputAspect, frameResolution).catch(() => url);
      addGeneratedFrame(normalized, p, outputAspect, frameResolution);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : '生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2">
          <ImageIcon className="w-5 h-5" />
          选择画框
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-2 text-sm text-white hover:bg-amber-700"
          >
            <Upload className="h-4 w-4" />
            导入画框
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleCustomFrameUpload(event.target.files?.[0])}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-amber-100 bg-amber-50/50 p-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <Wand2 className="h-4 w-4" />
          通过提示词生成画框素材
        </div>
        <div className="grid grid-cols-1 gap-2">
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              placeholder="API Key（仅保存在本地浏览器）"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            />
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="输入提示词，生成画框背景图"
            className="w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm text-gray-700">画框比例</label>
              <select
                value={outputAspect}
                onChange={(e) => setOutputAspect(e.target.value as OutputAspect)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
              >
                <option value="9:16">9:16 竖屏</option>
                <option value="16:9">16:9 横屏</option>
                <option value="1:1">1:1 方图</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-gray-700">分辨率</label>
              <select
                value={frameResolution}
                onChange={(e) => setFrameResolution(e.target.value as '1K' | '2K')}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
              >
                <option value="1K">1K（更快）</option>
                <option value="2K">2K（更清晰）</option>
              </select>
            </div>
          </div>
          <div className="rounded-lg border border-dashed border-amber-200 bg-white/80 px-3 py-2 text-xs text-gray-500">
            比例决定 9:16/16:9/1:1 画面形状，1K/2K 决定生成分辨率。若生成源图不支持跨域，会自动回退为原 URL 以保证可用性。
          </div>
          <button
            type="button"
            onClick={handleGenerateFrame}
            disabled={isGenerating}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
              isGenerating ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-amber-600 text-white hover:bg-amber-700"
            )}
          >
            {isGenerating ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                生成中...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                生成画框
              </>
            )}
          </button>
          {errorText && <div className="text-sm text-red-600">{errorText}</div>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {frames.map((frame) => (
          <button
            key={frame.id}
            onClick={() => setSelectedFrame(frame)}
            className={cn(
              "relative p-3 rounded-lg border-2 transition-all",
              selectedFrame?.id === frame.id
                ? "border-amber-500 bg-amber-50"
                : "border-gray-200 hover:border-amber-300"
            )}
          >
            {(frame.source === 'custom' || frame.source === 'generated') && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeFrame(frame.id);
                }}
                className="absolute top-2 left-2 w-7 h-7 rounded-full bg-white/90 border border-gray-200 text-red-600 hover:bg-white flex items-center justify-center"
                aria-label="删除画框"
                title="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <div
              className="w-full bg-gradient-to-br from-amber-50 to-amber-100 rounded-md mb-2 overflow-hidden"
              style={{ aspectRatio: aspectRatioToCss(outputAspect) }}
            >
              <img
                src={frame.previewImage}
                alt={frame.nameZh}
                className="w-full h-full object-contain"
                loading="lazy"
              />
            </div>
            <p className="text-sm font-medium text-gray-700 text-center">{frame.nameZh}</p>
            {frame.source === 'custom' && (
              <p className="mt-1 text-center text-xs text-amber-700">已导入素材</p>
            )}
            {frame.source === 'generated' && (
              <p className="mt-1 text-center text-xs text-emerald-700">
                AI 生成{frame.generatedAspect ? ` · ${frame.generatedAspect}` : ''}{frame.generatedResolution ? ` · ${frame.generatedResolution}` : ''}
              </p>
            )}
            {selectedFrame?.id === frame.id && (
              <div className="absolute top-2 right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function aspectRatioToCss(aspect: OutputAspect) {
  if (aspect === '1:1') return '1 / 1';
  if (aspect === '16:9') return '16 / 9';
  return '9 / 16';
}

function getTargetFrameSize(aspect: OutputAspect, resolution: '1K' | '2K') {
  const longSide = resolution === '2K' ? 2048 : 1024;
  if (aspect === '1:1') return { width: longSide, height: longSide };
  if (aspect === '16:9') return { width: longSide, height: Math.round((longSide * 9) / 16) };
  return { width: Math.round((longSide * 9) / 16), height: longSide };
}

async function normalizeGeneratedFrame(url: string, aspect: OutputAspect, resolution: '1K' | '2K') {
  const img = await loadImage(url);
  const { width, height } = getTargetFrameSize(aspect, resolution);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return url;

  const scale = Math.max(width / img.width, height / img.height);
  const drawWidth = img.width * scale;
  const drawHeight = img.height * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(img, x, y, drawWidth, drawHeight);

  try {
    return canvas.toDataURL('image/png');
  } catch {
    return url;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  const cleanSrc = src.trim().replace(/[`"' ]/g, '');
  const create = (useCors: boolean) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      if (useCors) img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = cleanSrc;
    });
  return create(true).catch(() => create(false));
}

function buildPreferredSize(aspect: OutputAspect, resolution: '1K' | '2K') {
  const base = resolution === '2K' ? 2048 : 1024;
  if (aspect === '1:1') return `${base}x${base}`;
  if (aspect === '16:9') return `${base}x${Math.round((base * 9) / 16)}`;
  return `${Math.round((base * 9) / 16)}x${base}`;
}

async function requestGenerateFrame(apiKey: string, prompt: string, size: string) {
  const res = await fetch('https://yunwu.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'doubao-seedream-5-0-260128',
      prompt,
      size,
      output_format: 'png',
      response_format: 'url',
      watermark: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }

  return res.json();
}
