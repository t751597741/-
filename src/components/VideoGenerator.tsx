import { Video, Download, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { generateVideo } from '@/services/videoService';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';

export function VideoGenerator() {
  const {
    originalImageUrl,
    processedImage,
    outputAspect,
    imageScale,
    frameScale,
    imageOffsetX,
    imageOffsetY,
    imageRotation,
    frameRotation,
    selectedFrame,
    selectedMusic,
    previewSnapshot,
    isGenerating,
    generationProgress,
    generatedVideo,
    generatedVideoBlob,
    generatedVideoMimeType,
    setIsGenerating,
    setGenerationProgress,
    setGeneratedVideo,
    addToHistory,
  } = useAppStore();
  const [convertError, setConvertError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const requirementIssues = [
    !originalImageUrl ? '请先上传书法作品' : '',
    !selectedFrame ? '请先选择画框' : '',
    !selectedMusic ? '请先生成并选择背景音乐' : '',
    selectedMusic && !selectedMusic.url ? '背景音乐还在生成中，请等音频可试听后再生成视频' : '',
  ].filter(Boolean);

  useEffect(() => {
    if (!generatedVideo || !videoRef.current) return;
    videoRef.current.load();
  }, [generatedVideo]);

  const handleGenerate = async () => {
    if (!originalImageUrl || !selectedFrame || !selectedMusic?.url) {
      setConvertError(requirementIssues.join('；') || '当前条件不足，无法生成视频');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setConvertError('');
    setGeneratedVideo(null, null, null);

    try {
      const imageToUse = processedImage || originalImageUrl;
      const videoBlob = await generateVideo(
        imageToUse,
        selectedFrame,
        selectedMusic,
        imageScale,
        frameScale,
        imageOffsetX,
        imageOffsetY,
        imageRotation,
        frameRotation,
        (progress) => setGenerationProgress(progress),
        previewSnapshot,
        outputAspect
      );
      setGenerationProgress(92);
      let finalBlob: Blob | null = null;
      try {
        finalBlob = await convertWebmToMp4(videoBlob);
      } catch (e) {
        finalBlob = null;
        const message = e instanceof Error ? e.message : 'MP4 转码失败';
        setConvertError(`${message}，已回退为 WebM 预览/下载`);
      }
      const playableBlob = finalBlob ?? videoBlob;
      setGenerationProgress(100);
      const videoUrl = URL.createObjectURL(playableBlob);
      setGeneratedVideo(videoUrl, playableBlob, playableBlob.type || null);

      addToHistory({
        originalImageName: '书法作品',
        frameId: selectedFrame.id,
        frameName: selectedFrame.nameZh,
        musicId: selectedMusic.id,
        musicName: selectedMusic.nameZh,
        thumbnailUrl: imageToUse,
        videoUrl,
      });
    } catch (error) {
      console.error('Failed to generate video:', error);
      setConvertError(error instanceof Error ? error.message : '视频生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadMp4 = () => {
    if (!generatedVideo || !generatedVideoBlob) return;
    const a = document.createElement('a');
    a.href = generatedVideo;
    a.download = `书法作品视频.mp4`;
    a.click();
  };

  const canGenerate = !isGenerating;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className={cn(
            "w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all",
            canGenerate
              ? "bg-gradient-to-r from-amber-600 to-amber-700 text-white hover:from-amber-700 hover:to-amber-800"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          )}
        >
          {isGenerating ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              生成 15 秒视频中... {generationProgress}%
            </>
          ) : (
            <>
              <Video className="w-5 h-5" />
              生成视频
            </>
          )}
        </button>

        {isGenerating && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-amber-500 to-amber-600 h-2 rounded-full transition-all"
              style={{ width: `${generationProgress}%` }}
            />
          </div>
        )}
        {!isGenerating && requirementIssues.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            生成前还需要：{requirementIssues.join('；')}
          </div>
        )}
        {convertError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {convertError}
          </div>
        )}
        {selectedMusic && !selectedMusic.url && (
          <div className="text-xs text-gray-500">
            请先生成并等待背景音乐完成，否则视频无法带入声音。
          </div>
        )}
        <div className="text-xs text-gray-500">
          生成逻辑会基于当前实时预览快照输出 15 秒成片，并自动转为 MP4 供预览和下载。
        </div>
      </div>

      {generatedVideo && (
        <div className="space-y-3">
          <h3 className="text-lg font-medium text-gray-800">预览视频</h3>
          <div className="border rounded-lg overflow-hidden aspect-video bg-black">
            <video
              key={generatedVideo}
              ref={videoRef}
              src={generatedVideo}
              controls
              playsInline
              preload="auto"
              className="w-full h-full"
            />
          </div>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={handleDownloadMp4}
              className="w-full py-2 px-4 rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              下载 MP4
            </button>
          </div>
          <div className="text-xs text-gray-500">
            当前预览直接使用生成后的 MP4 文件，重新生成后会自动刷新播放器。
          </div>
        </div>
      )}
    </div>
  );
}

async function convertWebmToMp4(blob: Blob) {
  if (blob.type.includes('video/mp4')) {
    return blob;
  }

  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

  const ffmpeg = new FFmpeg();
  const localBase = `${window.location.origin}/ffmpeg`;
  const coreBaseURLs = [
    localBase,
    'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist',
    'https://unpkg.com/@ffmpeg/core@0.12.6/dist',
  ];

  let loaded = false;
  let lastError: unknown = null;
  for (const baseURL of coreBaseURLs) {
    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
      });
      loaded = true;
      break;
    } catch (e) {
      lastError = e;
    }
  }

  if (!loaded) {
    const message = lastError instanceof Error ? lastError.message : String(lastError || '');
    const hint = message.includes('Failed to fetch')
      ? '无法加载 FFmpeg 核心文件（本地 /ffmpeg 或 CDN 拉取失败）。请先执行 npm install（会自动复制 ffmpeg-core 到 public/ffmpeg），或检查网络/代理是否屏蔽 unpkg/jsdelivr。'
      : `FFmpeg 初始化失败：${message || 'unknown error'}`;
    throw new Error(hint);
  }

  await ffmpeg.writeFile('input.webm', await fetchFile(blob));
  await ffmpeg.exec([
    '-i',
    'input.webm',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    'output.mp4',
  ]);
  const data = await ffmpeg.readFile('output.mp4');
  return new Blob([data], { type: 'video/mp4' });
}
