"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Loader2,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  watermark?: string;
  className?: string;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SKIP = 10;
const HIDE_DELAY = 3000;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function VideoPlayer({ src, poster, watermark = "/icons/logo-main-transparent.png", className = "" }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seekRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHlsReady, setIsHlsReady] = useState(false);

  // Init HLS or native video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const isHls = src.endsWith(".m3u8") || src.includes("m3u8");
    let hls: Hls | null = null;

    if (isHls && typeof window !== "undefined") {
      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsHlsReady(true);
          setReady(true);
        });
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) setError("بارگذاری ویدیو ناموفق بود");
        });
        hlsRef.current = hls;
      } else {
        setError("مرورگر شما از پخش HLS پشتیبانی نمی‌کند");
      }
    } else if (!isHls) {
      video.src = src;
      setReady(true);
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [src]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => { if (!seeking) setCurrentTime(video.currentTime); };
    const onProgress = () => {
      if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1));
    };
    const onLoadedMetadata = () => {
      setDuration(video.duration);
      setVolume(video.volume);
      setMuted(video.muted);
    };
    const onPlay = () => { setPlaying(true); setEnded(false); };
    const onPause = () => setPlaying(false);
    const onEnded = () => { setPlaying(false); setEnded(true); };
    const onError = () => { if (video.error) setError("خطا در پخش ویدیو"); };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("progress", onProgress);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
    };
  }, [seeking]);

  // Auto-hide controls
  useEffect(() => {
    if (playing && !seeking) {
      const t = setTimeout(() => setShowControls(false), HIDE_DELAY);
      return () => clearTimeout(t);
    }
    setShowControls(true);
  }, [playing, seeking]);

  const poke = useCallback(() => {
    setShowControls(true);
  }, []);

  // Fullscreen change
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const video = videoRef.current;
      if (!video) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault(); togglePlay(); break;
        case "ArrowLeft":
          e.preventDefault(); seekTo(video.currentTime - SKIP); break;
        case "ArrowRight":
          e.preventDefault(); seekTo(video.currentTime + SKIP); break;
        case "ArrowUp":
          e.preventDefault(); adjustVolume(0.1); break;
        case "ArrowDown":
          e.preventDefault(); adjustVolume(-0.1); break;
        case "m":
          e.preventDefault(); toggleMute(); break;
        case "f":
          e.preventDefault(); toggleFullscreen(); break;
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          e.preventDefault();
          seekTo((Number(e.key) / 10) * (video.duration || 0));
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (ended) { video.currentTime = 0; setEnded(false); }
    if (video.paused) {
      video.play().catch(() => setError("امکان پخش ویدیو وجود ندارد"));
    } else {
      video.pause();
    }
  }

  function seekTo(time: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(time, video.duration || 0));
    setCurrentTime(video.currentTime);
  }

  function handleSeekStart() { setSeeking(true); }
  function handleSeekEnd(e: React.MouseEvent | React.TouchEvent) {
    setSeeking(false);
    const rect = seekRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    seekTo((Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))) * duration);
  }

  function handleSeekMove(e: React.MouseEvent | React.TouchEvent) {
    const rect = seekRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    setSeekPreview((Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))) * duration);
  }

  function adjustVolume(delta: number) {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.max(0, Math.min(1, video.volume + delta));
    video.volume = next;
    video.muted = next === 0;
    setVolume(next);
    setMuted(next === 0);
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current.requestFullscreen();
  }

  function setSpeed(rate: number) {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;
  const canPlay = ready || isHlsReady;
  const showBigPlay = !playing && !error && canPlay;

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className={`group relative isolate overflow-hidden rounded-2xl bg-black shadow-[0_20px_60px_-20px_rgba(3,0,75,0.55)] ring-1 ring-white/10 ${className}`}
      onMouseMove={poke}
    >
      {/* Video */}
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        poster={poster}
        playsInline
        preload="metadata"
        onClick={togglePlay}
      />

      {/* Brand watermark */}
      {watermark && (
        <img
          src={watermark}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-3 z-30 h-9 w-auto opacity-80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
        />
      )}

      {/* Ambient gradient for depth */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(255,222,171,0.06),transparent_55%)]" />

      {/* Top progress hairline */}
      <div className="absolute inset-x-0 top-0 z-20 h-0.5 bg-white/10">
        <div
          className="h-full bg-secondary-fixed shadow-[0_0_8px_rgba(255,222,171,0.8)] transition-[width] duration-200 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/85 p-6 text-center backdrop-blur-sm">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-error-container/20 text-error">
            <AlertTriangle size={28} />
          </span>
          <p className="text-sm font-bold text-white">{error}</p>
          <button
            onClick={(e) => { e.stopPropagation(); setError(null); setReady(false); setIsHlsReady(false); window.location.reload(); }}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2 text-xs font-bold text-white transition hover:bg-white/10"
          >
            <RotateCcw size={14} />
            تلاش مجدد
          </button>
        </div>
      )}

      {/* Buffering */}
      {!error && !canPlay && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-secondary-fixed/20" />
            <Loader2 className="animate-spin text-secondary-fixed" size={34} />
          </div>
        </div>
      )}

      {/* Big Play Button */}
      {showBigPlay && (
        <button
          type="button"
          aria-label="پخش"
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          className="group/play absolute inset-0 z-10 flex cursor-pointer items-center justify-center focus-visible:outline-none"
        >
          <div className="relative flex h-24 w-24 items-center justify-center transition-transform duration-300 group-hover/play:scale-110 md:h-28 md:w-28">
            {/* Glass circle */}
            <div className="absolute inset-0 rounded-full border border-white/30 bg-primary/35 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-300 group-hover/play:border-white/50 group-hover/play:bg-primary/55" />
            {/* Inner hairline */}
            <div className="absolute inset-2 rounded-full border border-white/15 transition-colors duration-300 group-hover/play:border-white/30" />
            {/* Play triangle */}
            <svg viewBox="0 0 24 24" className="relative ml-0.5 h-9 w-9 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
              <path d="M7.5 5.2v13.6a1 1 0 0 0 1.53.85l11-6.8a1 1 0 0 0 0-1.7l-11-6.8a1 1 0 0 0-1.53.85Z" fill="currentColor" />
            </svg>
          </div>
        </button>
      )}

      {/* Controls Overlay */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-3 pb-3 pt-14 transition-all duration-300 ${showControls ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Seek Bar */}
        <div
          ref={seekRef}
          className="group/seek relative mx-1 mb-3 flex h-4 cursor-pointer items-center"
          onMouseDown={handleSeekStart}
          onMouseUp={handleSeekEnd}
          onMouseMove={handleSeekMove}
          onMouseLeave={() => setSeekPreview(null)}
          onTouchStart={handleSeekStart}
          onTouchEnd={handleSeekEnd}
          onTouchMove={handleSeekMove}
        >
          <div className="relative h-1.5 w-full overflow-visible rounded-full bg-white/20 transition-all duration-200 group-hover/seek:h-2">
            {/* Buffered */}
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/25" style={{ width: `${bufferedProgress}%` }} />
            {/* Played */}
            <div className="absolute inset-y-0 left-0 rounded-full bg-secondary-fixed shadow-[0_0_10px_rgba(255,222,171,0.7)]" style={{ width: `${progress}%` }} />
            {/* Thumb */}
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-secondary-fixed shadow-[0_0_0_4px_rgba(255,222,171,0.25),0_2px_6px_rgba(0,0,0,0.4)] transition-transform duration-150 group-hover/seek:scale-125"
              style={{ left: `${progress}%`, marginLeft: "-7px" }}
            />
          </div>
          {seekPreview !== null && (
            <div className="pointer-events-none absolute -top-8 z-10 -translate-x-1/2 rounded-lg bg-black/85 px-2 py-1 text-[11px] font-bold tabular-nums text-secondary-fixed shadow-lg ring-1 ring-white/10" style={{ left: `${(seekPreview / Math.max(duration, 1)) * 100}%` }}>
              {formatTime(seekPreview)}
            </div>
          )}
        </div>

        {/* Controls Row */}
        <div className="flex items-center gap-1 text-white">
          <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="rounded-xl p-2.5 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-fixed" aria-label={playing ? "مکث" : "پخش"}>
            {playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}
          </button>

          <button onClick={(e) => { e.stopPropagation(); seekTo(currentTime - SKIP); }} className="rounded-xl p-2.5 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-fixed" aria-label={`${SKIP} ثانیه عقب`}>
            <SkipBack size={16} />
          </button>

          <button onClick={(e) => { e.stopPropagation(); seekTo(currentTime + SKIP); }} className="rounded-xl p-2.5 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-fixed" aria-label={`${SKIP} ثانیه جلو`}>
            <SkipForward size={16} />
          </button>

          <span dir="ltr" className="mr-1 shrink-0 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-bold tabular-nums text-white/95">
            {formatTime(currentTime)} <span className="mx-0.5 text-white/40">/</span> {formatTime(duration)}
          </span>

          <span className="flex-1" />

          {/* Volume */}
          <div className="group/vol flex items-center">
            <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="rounded-xl p-2.5 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-fixed" aria-label={muted ? "صدا" : "بی‌صدا"}>
              {muted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                const video = videoRef.current;
                if (video) { video.volume = v; video.muted = v === 0; }
                setVolume(v);
                setMuted(v === 0);
              }}
              className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/30 opacity-0 transition-all duration-200 accent-secondary-fixed group-hover/vol:w-16 group-hover/vol:opacity-100 focus-visible:w-16 focus-visible:opacity-100 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-secondary-fixed"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Speed */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); }}
              className="rounded-xl px-2.5 py-2.5 text-[11px] font-black tabular-nums transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-fixed"
              aria-label="سرعت پخش"
            >
              {playbackRate}x
            </button>
            {showSpeedMenu && (
              <div dir="rtl" className="absolute bottom-full right-0 mb-2 w-28 overflow-hidden rounded-xl bg-[#0d0a38]/95 p-1 shadow-2xl ring-1 ring-white/10 backdrop-blur-md">
                {SPEEDS.map((rate) => (
                  <button
                    key={rate}
                    onClick={(e) => { e.stopPropagation(); setSpeed(rate); }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-center text-xs font-bold transition hover:bg-white/10 ${rate === playbackRate ? "text-secondary-fixed" : "text-white/75"}`}
                  >
                    {rate}x
                    {rate === playbackRate && <span className="h-1.5 w-1.5 rounded-full bg-secondary-fixed" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fullscreen */}
          <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="rounded-xl p-2.5 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-fixed" aria-label="تمام‌صفحه">
            {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
          </button>
        </div>
      </div>
    </div>
  );
}