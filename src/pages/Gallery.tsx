import { Video, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { Link } from 'react-router-dom';

export function Gallery() {
  const { history, removeFromHistory } = useAppStore();

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-green-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 font-serif">我的作品库</h1>
            <p className="text-gray-600 mt-1">查看和管理您生成的书法视频</p>
          </div>
          <Link
            to="/"
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            制作新视频
          </Link>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-16">
            <Video className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-medium text-gray-700 mb-2">还没有作品</h3>
            <p className="text-gray-500 mb-6">上传您的第一幅书法作品开始制作视频吧！</p>
            <Link
              to="/"
              className="inline-block px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              立即开始
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {history.map((item) => (
              <div key={item.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="aspect-video bg-gray-100 relative">
                  <img
                    src={item.thumbnailUrl}
                    alt={item.originalImageName}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Video className="w-12 h-12 text-white" />
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900">{item.originalImageName}</h3>
                      <p className="text-sm text-gray-500">画框: {item.frameName}</p>
                      <p className="text-sm text-gray-500">音乐: {item.musicName}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-xs text-gray-400">{formatDate(item.timestamp)}</p>
                    <div className="flex items-center gap-2">
                      <a
                        href={item.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-600 hover:text-amber-700"
                      >
                        <Video className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => removeFromHistory(item.id)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
