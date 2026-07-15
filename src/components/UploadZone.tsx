import { useCallback, useRef } from 'react';
import { Upload } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';

export function UploadZone() {
  const { setOriginalImage } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setOriginalImage(file, url);
    }
  }, [setOriginalImage]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="space-y-4">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 cursor-pointer transition-all hover:border-amber-600 hover:bg-amber-50/50",
          "flex flex-col items-center justify-center gap-4 min-h-[200px]"
        )}
      >
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
          <Upload className="w-8 h-8 text-amber-600" />
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-gray-800">上传书法作品</p>
          <p className="text-sm text-gray-500 mt-1">点击或拖拽图片到这里</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>
    </div>
  );
}
