import { UploadZone } from '@/components/UploadZone';
import { BackgroundRemover } from '@/components/BackgroundRemover';
import { FrameSelector } from '@/components/FrameSelector';
import { MusicSelector } from '@/components/MusicSelector';
import { VideoGenerator } from '@/components/VideoGenerator';
import { PreviewPanel } from '@/components/PreviewPanel';

export function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-green-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 font-serif">
            书法作品视频生成器
          </h1>
          <p className="text-lg text-gray-600">
            上传您的书法作品，一键生成精美的展示视频
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <UploadZone />
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <BackgroundRemover />
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <FrameSelector />
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <MusicSelector />
            </div>

            <div className="bg-white rounded-xl shadow-sm border p-6">
              <VideoGenerator />
            </div>
          </div>

          <div className="lg:sticky lg:top-8 lg:self-start">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <PreviewPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
