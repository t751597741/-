export interface Frame {
  id: string;
  name: string;
  nameZh: string;
  previewImage: string;
  category: 'scroll' | 'frame' | 'simple';
  source?: 'builtin' | 'custom' | 'generated';
  generatedAspect?: '9:16' | '16:9' | '1:1';
  generatedResolution?: '1K' | '2K';
}

export type OutputAspect = '9:16' | '16:9' | '1:1';

export interface Music {
  id: string;
  name: string;
  nameZh: string;
  duration: number;
  url: string;
  category: 'ancient' | 'light' | 'piano' | 'asuno';
  coverImage?: string;
  description?: string;
  taskId?: string;
  clipId?: string;
  taskStatus?: string;
}

export interface HistoryItem {
  id: string;
  originalImageName: string;
  frameId: string;
  frameName: string;
  musicId: string;
  musicName: string;
  thumbnailUrl: string;
  videoUrl: string;
  timestamp: number;
}

export interface AppState {
  originalImage: File | null;
  originalImageUrl: string | null;
  processedImage: string | null;
  outputAspect: OutputAspect;
  imageScale: number;
  frameScale: number;
  imageOffsetX: number;
  imageOffsetY: number;
  imageRotation: number;
  frameRotation: number;
  selectedFrame: Frame | null;
  frames: Frame[];
  selectedMusic: Music | null;
  musicList: Music[];
  isMusicPlaying: boolean;
  previewSnapshot: string | null;
  isGenerating: boolean;
  generationProgress: number;
  generatedVideo: string | null;
  generatedVideoBlob: Blob | null;
  generatedVideoMimeType: string | null;
  history: HistoryItem[];
}
