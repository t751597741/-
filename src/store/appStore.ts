import { create } from 'zustand';
import { Frame, Music, HistoryItem, AppState, OutputAspect } from '@/types';
import { frames } from '@/data/frames';
import { musicList } from '@/data/music';

const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const MUSIC_HISTORY_KEY = 'asuno_music_history_v1';

interface AppActions {
  setOriginalImage: (file: File | null, url: string | null) => void;
  setProcessedImage: (url: string | null) => void;
  setOutputAspect: (aspect: OutputAspect) => void;
  setImageScale: (scale: number) => void;
  setFrameScale: (scale: number) => void;
  moveImagePosition: (deltaX: number, deltaY: number) => void;
  resetImagePosition: () => void;
  rotateImageLeft: () => void;
  rotateFrameLeft: () => void;
  setSelectedFrame: (frame: Frame | null) => void;
  addCustomFrame: (file: File) => void;
  addGeneratedFrame: (url: string, prompt: string, generatedAspect?: OutputAspect, generatedResolution?: '1K' | '2K') => void;
  removeFrame: (id: string) => void;
  setMusicList: (musicList: Music[]) => void;
  setSelectedMusic: (music: Music | null) => void;
  setIsMusicPlaying: (playing: boolean) => void;
  setPreviewSnapshot: (dataUrl: string | null) => void;
  updateMusic: (id: string, patch: Partial<Music>) => void;
  removeMusic: (id: string) => void;
  setIsGenerating: (generating: boolean) => void;
  setGenerationProgress: (progress: number) => void;
  setGeneratedVideo: (url: string | null, blob?: Blob | null, mimeType?: string | null) => void;
  addToHistory: (item: Omit<HistoryItem, 'id' | 'timestamp'>) => void;
  removeFromHistory: (id: string) => void;
  resetWorkspace: () => void;
}

type AppStore = AppState & AppActions;

const loadStoredMusicList = (): Music[] => {
  try {
    const raw = localStorage.getItem(MUSIC_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item === 'object') as Music[];
  } catch {
    return [];
  }
};

const persistMusicList = (list: Music[]) => {
  try {
    localStorage.setItem(MUSIC_HISTORY_KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
  }
};

const storedMusicList = typeof window !== 'undefined' ? loadStoredMusicList() : [];
const initialMusicList = storedMusicList.length > 0 ? storedMusicList : musicList;

const initialState: AppState = {
  originalImage: null,
  originalImageUrl: null,
  processedImage: null,
  outputAspect: '9:16',
  imageScale: 1,
  frameScale: 1,
  imageOffsetX: 0,
  imageOffsetY: 0,
  imageRotation: 0,
  frameRotation: 0,
  selectedFrame: frames[0],
  frames,
  selectedMusic: initialMusicList[0] ?? null,
  musicList: initialMusicList,
  isMusicPlaying: false,
  previewSnapshot: null,
  isGenerating: false,
  generationProgress: 0,
  generatedVideo: null,
  generatedVideoBlob: null,
  generatedVideoMimeType: null,
  history: [],
};

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,

  setOriginalImage: (file, url) => {
    const prevUrl = get().originalImageUrl;
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    const prevVideoUrl = get().generatedVideo;
    if (prevVideoUrl) URL.revokeObjectURL(prevVideoUrl);
    set({
      originalImage: file,
      originalImageUrl: url,
      processedImage: null,
      generatedVideo: null,
      generatedVideoBlob: null,
      generatedVideoMimeType: null,
      imageScale: 1,
      frameScale: 1,
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageRotation: 0,
      frameRotation: 0,
      previewSnapshot: null,
    });
  },

  setProcessedImage: (url) => set({ processedImage: url }),

  setOutputAspect: (aspect) => set({ outputAspect: aspect }),

  setImageScale: (scale) => set({ imageScale: scale }),

  setFrameScale: (scale) => set({ frameScale: scale }),

  moveImagePosition: (deltaX, deltaY) => set((state) => ({
    imageOffsetX: clampOffset(state.imageOffsetX + deltaX),
    imageOffsetY: clampOffset(state.imageOffsetY + deltaY),
  })),

  resetImagePosition: () => set({ imageOffsetX: 0, imageOffsetY: 0 }),

  rotateImageLeft: () => set((state) => ({ imageRotation: normalizeRotation(state.imageRotation - 90) })),

  rotateFrameLeft: () => set((state) => ({ frameRotation: normalizeRotation(state.frameRotation - 90) })),

  setSelectedFrame: (frame) => set({ selectedFrame: frame }),

  addCustomFrame: (file) => {
    const objectUrl = URL.createObjectURL(file);
    const customFrame: Frame = {
      id: generateId(),
      name: file.name,
      nameZh: file.name.replace(/\.[^.]+$/, ''),
      previewImage: objectUrl,
      category: 'frame',
      source: 'custom',
    };

    set((state) => ({
      frames: [customFrame, ...state.frames],
      selectedFrame: customFrame,
    }));
  },

  addGeneratedFrame: (url, prompt, generatedAspect, generatedResolution) => {
    const cleanedUrl = url.trim().replace(/[`"' ]/g, '');
    const cleanedPrompt = prompt.trim();
    const generatedFrame: Frame = {
      id: generateId(),
      name: cleanedPrompt || 'Generated Frame',
      nameZh: cleanedPrompt ? `生成：${cleanedPrompt.slice(0, 10)}${cleanedPrompt.length > 10 ? '…' : ''}` : '生成画框',
      previewImage: cleanedUrl,
      category: 'frame',
      source: 'generated',
      generatedAspect,
      generatedResolution,
    };

    set((state) => ({
      frames: [generatedFrame, ...state.frames],
      selectedFrame: generatedFrame,
    }));
  },

  removeFrame: (id) => set((state) => {
    const target = state.frames.find((f) => f.id === id);
    if (target?.previewImage?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(target.previewImage);
      } catch {
      }
    }
    const nextFrames = state.frames.filter((f) => f.id !== id);
    const nextSelected = state.selectedFrame?.id === id ? (nextFrames[0] ?? null) : state.selectedFrame;
    return { frames: nextFrames, selectedFrame: nextSelected };
  }),

  setMusicList: (nextMusicList) => set((state) => {
    persistMusicList(nextMusicList);
    return {
      musicList: nextMusicList,
      selectedMusic: nextMusicList.length > 0 ? (state.selectedMusic && nextMusicList.some((item) => item.id === state.selectedMusic?.id) ? state.selectedMusic : nextMusicList[0]) : null,
    };
  }),

  setSelectedMusic: (music) => set({ selectedMusic: music }),

  setIsMusicPlaying: (playing) => set({ isMusicPlaying: playing }),

  setPreviewSnapshot: (dataUrl) => set({ previewSnapshot: dataUrl }),

  updateMusic: (id, patch) => set((state) => {
    const nextList = state.musicList.map((m) => (m.id === id ? { ...m, ...patch } : m));
    const nextSelected = state.selectedMusic?.id === id ? { ...state.selectedMusic, ...patch } : state.selectedMusic;
    persistMusicList(nextList);
    return { musicList: nextList, selectedMusic: nextSelected };
  }),

  removeMusic: (id) => set((state) => {
    const nextList = state.musicList.filter((m) => m.id !== id);
    const nextSelected = state.selectedMusic?.id === id ? (nextList[0] ?? null) : state.selectedMusic;
    persistMusicList(nextList);
    return { musicList: nextList, selectedMusic: nextSelected };
  }),

  setIsGenerating: (generating) => set({ isGenerating: generating }),

  setGenerationProgress: (progress) => set({ generationProgress: progress }),

  setGeneratedVideo: (url, blob = null, mimeType = null) => {
    const prevUrl = get().generatedVideo;
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    set({ generatedVideo: url, generatedVideoBlob: blob, generatedVideoMimeType: mimeType, isGenerating: false, generationProgress: 0 });
  },

  addToHistory: (item) => {
    const newItem: HistoryItem = {
      ...item,
      id: generateId(),
      timestamp: Date.now(),
    };
    set((state) => ({ history: [newItem, ...state.history] }));
  },

  removeFromHistory: (id) => set((state) => ({ history: state.history.filter((h) => h.id !== id) })),

  resetWorkspace: () => set((state) => ({
    originalImage: null,
    originalImageUrl: null,
    processedImage: null,
    imageScale: 1,
    frameScale: 1,
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageRotation: 0,
    frameRotation: 0,
    selectedFrame: state.frames[0],
    selectedMusic: state.musicList[0] ?? null,
    previewSnapshot: null,
    isGenerating: false,
    generationProgress: 0,
    generatedVideo: null,
    generatedVideoBlob: null,
    generatedVideoMimeType: null,
  })),
}));

function normalizeRotation(value: number) {
  const next = value % 360;
  return next < 0 ? next + 360 : next;
}

function clampOffset(value: number) {
  return Math.max(-220, Math.min(220, value));
}
