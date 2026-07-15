# 书法作品视频生成器

一个基于 React + TypeScript + Vite 的书法视频生成平台，支持上传作品、去除背景、选择或生成画框、生成国风音乐，并导出带动效的视频。

## 功能概览

- 上传书法图片并进行背景去除
- 选择内置画框、导入画框或通过提示词生成画框
- 调整画面比例：`9:16`、`16:9`、`1:1`
- 调整原图大小、位置、旋转和画框大小
- 生成音乐并保留历史音乐库
- 基于实时预览导出 15 秒视频

## 技术栈

- React 18
- TypeScript
- Vite
- Zustand
- Tailwind CSS
- FFmpeg.wasm

## 本地启动

```bash
npm install
npm run dev
```

## 构建与检查

```bash
npm run check
npm run build
```

## 目录结构

```text
src/
  components/   页面组件
  pages/        页面入口
  services/     图片与视频处理逻辑
  store/        Zustand 状态管理
  data/         内置画框和音乐数据
```

## 说明

- 首次安装依赖后会自动复制 `ffmpeg-core` 到 `public/ffmpeg/`
- 如果 MP4 转码失败，前端会尝试回退为可预览的 WebM
