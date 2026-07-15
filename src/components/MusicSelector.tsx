import { useEffect, useRef, useState } from 'react';
import { Music as MusicIcon, Check, RefreshCw, KeyRound, Sparkles, Play, Pause, RotateCcw, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import type { Music } from '@/types';
import { cn } from '@/lib/utils';

export function MusicSelector() {
  const { musicList, selectedMusic, setSelectedMusic, setIsMusicPlaying, setMusicList, updateMusic, removeMusic } = useAppStore();
  const [token, setToken] = useState('');
  const [model, setModel] = useState('chirp-v5');
  const [prompt, setPrompt] = useState('写一首适合书法展示视频的国风纯净配乐，情绪平和，有留白感和书卷气。');
  const [makeInstrumental, setMakeInstrumental] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem('asuno_token') || '');
  }, []);

  const handleSelectMusic = (music: Music) => {
    setSelectedMusic(music);
    setIsMusicPlaying(false);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const handleDeleteMusic = (music: Music) => {
    if (selectedMusic?.id === music.id) {
      setIsPlaying(false);
      setIsMusicPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
    removeMusic(music.id);
  };

  const buildAuthorizationValue = (value: string) => {
    const cleaned = value.trim();
    if (!cleaned) return '';
    if (cleaned.startsWith('Bearer ')) return cleaned;
    if (cleaned.startsWith('Bearersk-')) return cleaned.replace(/^Bearersk-/, 'Bearer sk-');
    if (cleaned.startsWith('sk-')) return `Bearer ${cleaned}`;
    return cleaned;
  };

  const cleanText = (value: string) => value.trim().replace(/[`\"' ]/g, '');

  const pickFirstString = (input: unknown, matcher: (value: string) => boolean): string | undefined => {
    if (typeof input === 'string') {
      const cleaned = cleanText(input);
      return matcher(cleaned) ? cleaned : undefined;
    }
    if (Array.isArray(input)) {
      for (const item of input) {
        const hit = pickFirstString(item, matcher);
        if (hit) return hit;
      }
      return undefined;
    }
    if (input && typeof input === 'object') {
      for (const value of Object.values(input as Record<string, unknown>)) {
        const hit = pickFirstString(value, matcher);
        if (hit) return hit;
      }
    }
    return undefined;
  };

  const extractAudioFromTask = (input: unknown) => {
    const url = pickFirstString(input, (value) => /^https?:\/\/.+\.(mp3|wav|m4a)(\?.*)?$/i.test(value));
    const clipId = pickFirstString(input, (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));
    const title = pickFirstString(input, () => true);
    return { url, clipId, title };
  };

  const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const pollMusicResult = async (authorizationValue: string, localMusicId: string, taskId: string) => {
    const maxAttempts = 40;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const res = await fetch(`https://yunwu.ai/suno/fetch/${taskId}`, {
        headers: {
          Authorization: authorizationValue,
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `查询任务失败：HTTP ${res.status}`);
      }

      let json: unknown = {};
      try {
        json = await res.json();
      } catch {
        json = {};
      }

      const status = pickFirstString(json, (value) => ['NOT_START', 'SUBMITTED', 'QUEUED', 'IN_PROGRESS', 'FAILURE', 'SUCCESS'].includes(value)) || '';
      updateMusic(localMusicId, { taskStatus: status || 'IN_PROGRESS' });

      const { url, clipId } = extractAudioFromTask(json);
      if (url) {
        updateMusic(localMusicId, {
          url,
          clipId,
          taskStatus: status || 'SUCCESS',
        });
        return url;
      }

      if (status === 'FAILURE') {
        throw new Error(pickFirstString(json, () => true) || '音频生成失败');
      }

      await wait(3000);
    }

    throw new Error('音频生成超时，请稍后重试');
  };

  const handleSubmitMusic = async () => {
    const value = token.trim();
    if (!value) {
      setErrorText('请先填写 Asuno Token');
      return;
    }
    if (!prompt.trim()) {
      setErrorText('请先填写音乐灵感描述');
      return;
    }

    setIsLoading(true);
    setErrorText('');
    setSuccessText('');
    localStorage.setItem('asuno_token', value);

    try {
      const authorizationValue = buildAuthorizationValue(value);
      const res = await fetch('https://yunwu.ai/suno/submit/music', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authorizationValue,
        },
        body: JSON.stringify({
          mv: model,
          gpt_description_prompt: prompt.trim(),
          make_instrumental: makeInstrumental,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }

      let json: unknown = {};
      try {
        json = await res.json();
      } catch {
        json = {};
      }

      if (typeof json === 'object' && json && 'code' in json) {
        const code = (json as { code?: number | string }).code;
        if (code !== 200 && code !== '200' && code !== 'success') {
          throw new Error((json as { msg?: string; message?: string }).msg || (json as { msg?: string; message?: string }).message || '音乐提交失败');
        }
      }

      const submittedMusic: Music = {
        id: `asuno_${Date.now()}`,
        name: model,
        nameZh: makeInstrumental ? '纯音乐方案' : '人声配乐方案',
        duration: 0,
        url: '',
        category: 'asuno',
        description: prompt.trim(),
        taskId: '',
        taskStatus: 'SUBMITTED',
      };

      const taskId = typeof json === 'object' && json && 'data' in json ? String((json as { data?: unknown }).data ?? '') : '';
      const withTask: Music = { ...submittedMusic, taskId: taskId || undefined };
      setMusicList([withTask, ...musicList]);
      setSelectedMusic(withTask);
      setIsMusicPlaying(false);
      setSuccessText(`音乐生成任务已提交${taskId ? `，任务ID：${taskId}` : ''}，正在自动拉取音频...`);

      if (!taskId) {
        throw new Error('未获取到任务 ID');
      }

      const audioUrl = await pollMusicResult(authorizationValue, withTask.id, taskId);
      updateMusic(withTask.id, { taskStatus: 'SUCCESS', url: audioUrl });
      setSuccessText('音频已生成并自动绑定，可以直接生成视频。');
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : '提交音乐失败');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlay = async () => {
    if (!selectedMusic?.url) return;
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-800 flex items-center gap-2">
        <MusicIcon className="w-5 h-5" />
        选择音乐
      </h3>

      <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <KeyRound className="h-4 w-4" />
          Asuno 音乐生成
        </div>
        <div className="relative">
          <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="填写 sk-... 或 Bearer sk-...（若填 Bearersk-... 会自动修正）"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
          <div className="space-y-1">
            <label className="text-sm text-gray-700">模型版本</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            >
              <option value="chirp-v5">chirp-v5</option>
              <option value="chirp-v4">chirp-v4</option>
              <option value="chirp-v4-5">chirp-v4-5</option>
              <option value="chirp-v5-5">chirp-v5-5</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-700">灵感描述词</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 200))}
              rows={3}
              placeholder="写一段配乐需求，例如：古风、留白感、适合书法展示、器乐为主"
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            />
            <div className="text-right text-xs text-gray-400">{prompt.length}/200</div>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={makeInstrumental}
            onChange={(e) => setMakeInstrumental(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
          />
          生成纯音乐（无歌词、无人声）
        </label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleSubmitMusic}
            disabled={isLoading}
            className={cn(
              "w-full rounded-lg px-3 py-2 text-sm font-medium",
              isLoading ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-amber-600 text-white hover:bg-amber-700"
            )}
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                生成中…
              </span>
            ) : (
              '生成音乐'
            )}
          </button>
          <button
            type="button"
            onClick={handleSubmitMusic}
            disabled={isLoading}
            className={cn(
              "w-full rounded-lg px-3 py-2 text-sm font-medium",
              isLoading ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-gray-900 text-white hover:bg-black"
            )}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <RotateCcw className="h-4 w-4" />
              重新生成
            </span>
          </button>
        </div>
        <div className="text-xs text-gray-500">
          点击一次即可自动提交并轮询音频结果，成功后会自动绑定到当前方案。
        </div>
        {errorText && <div className="text-sm text-red-600">{errorText}</div>}
        {successText && <div className="text-sm text-emerald-700">{successText}</div>}
      </div>

      {selectedMusic?.url && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-gray-800">试听</div>
              <div className="text-xs text-gray-500 break-all">{selectedMusic.url}</div>
            </div>
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? '暂停' : '播放'}
            </button>
          </div>
          <audio
            ref={audioRef}
            src={selectedMusic.url}
            onEnded={() => setIsPlaying(false)}
            controls
            className="w-full"
          />
        </div>
      )}

      <div className="space-y-2">
        {musicList.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
            还没有已提交的配乐方案，请先填写参数并点击“提交音乐生成”。
          </div>
        )}
        {musicList.map((music) => (
          <button
            key={music.id}
            onClick={() => handleSelectMusic(music)}
            className={cn(
              "w-full p-3 rounded-lg border-2 transition-all flex items-center gap-3",
              selectedMusic?.id === music.id
                ? "border-amber-500 bg-amber-50"
                : "border-gray-200 hover:border-amber-300"
            )}
          >
            <div className="h-14 w-14 overflow-hidden rounded-lg bg-gray-100 shrink-0">
              {music.coverImage ? (
                <img src={music.coverImage} alt={music.nameZh} className="h-full w-full object-cover" />
              ) : (
                <div className={cn(
                  "flex h-full w-full items-center justify-center",
                  selectedMusic?.id === music.id ? "bg-amber-500" : "bg-gray-200"
                )}>
                  <Sparkles className={cn("w-5 h-5", selectedMusic?.id === music.id ? "text-white" : "text-gray-700")} />
                </div>
              )}
            </div>
            <div className="flex-1 text-left">
              <p className="font-medium text-gray-800">{music.nameZh}</p>
              <p className="text-sm text-gray-500">{music.name}</p>
              {music.description && (
                <p className="mt-1 line-clamp-2 text-xs text-gray-500">{music.description}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {music.url ? '已生成音频，可直接用于视频' : `状态：${music.taskStatus || '处理中'}`}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteMusic(music);
              }}
              className="text-red-500 hover:text-red-600"
              aria-label="删除音乐"
              title="删除"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            {selectedMusic?.id === music.id && (
              <Check className="w-5 h-5 text-green-500" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
