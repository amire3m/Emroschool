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
} from "lucide-react";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
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

export default function VideoPlayer({ src, poster, title, className = "" }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const seekRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
          if (data.fatal) {
            setError("بارگذاری ویدیو ناموفق بود");
          }
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

    const onTimeUpdate = () => {
      if (!seeking) setCurrentTime(video.currentTime);
    };
    const onProgress = () => {
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onLoadedMetadata = () => {
      setDuration(video.duration);
      setVolume(video.volume);
      setMuted(video.muted);
    };
    const onPlay = () => { setPlaying(true); setEnded(false); };
    const onPause = () => setPlaying(false);
    const onEnded = () => { setPlaying(false); setEnded(true); };
    const onError = () => {
      if (!video.error) return;
      setError("خطا در پخش ویدیو");
    };

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
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => {
        if (!seeking) setShowControls(false);
      }, HIDE_DELAY);
    }
  }, [playing, seeking]);

  useEffect(() => {
    if (playing && !seeking) {
      hideTimer.current = setTimeout(() => setShowControls(false), HIDE_DELAY);
    } else {
      setShowControls(true);
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [playing, seeking]);

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
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekTo(video.currentTime - SKIP);
          break;
        case "ArrowRight":
          e.preventDefault();
          seekTo(video.currentTime + SKIP);
          break;
        case "ArrowUp":
          e.preventDefault();
          adjustVolume(0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          adjustVolume(-0.1);
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
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
          const ratio = Number(e.key) / 10;
          seekTo(ratio * (video.duration || 0));
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (ended) { video.currentTime = 0; setEnded(false); }
    video.paused ? video.play() : video.pause();
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
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    seekTo(ratio * duration);
  }

  function handleSeekMove(e: React.MouseEvent | React.TouchEvent) {
    const rect = seekRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setSeekPreview(ratio * duration);
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
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
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
  const showBigPlay = !playing && !error;

  return (
    <div
      ref={containerRef}
      dir="ltr"
      className={`group relative overflow-hidden rounded-2xl bg-black ${className}`}
      onMouseMove={resetHideTimer}
      onClick={togglePlay}
    >
      {/* Video */}
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        poster={poster}
        playsInline
        preload="metadata"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Error */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center text-sm text-white">
          {error}
        </div>
      )}

      {/* Buffering */}
      {!error && !canPlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 className="animate-spin text-secondary-fixed" size={44} />
        </div>
      )}

      {/* Big Play Button */}
      {showBigPlay && canPlay && (
        <div
          className="absolute inset-0 flex cursor-pointer items-center justify-center transition-opacity"
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/80 text-secondary-fixed shadow-lg backdrop-blur-sm transition-transform hover:scale-105">
            <Play className="ml-1" size={36} fill="currentColor" />
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent px-3 pb-3 pt-12 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Seek Bar */}
        <div
          ref={seekRef}
          className="group/seek relative mb-3 h-1.5 cursor-pointer rounded-full bg-white/20 transition-all hover:h-2.5"
          onMouseDown={handleSeekStart}
          onMouseUp={handleSeekEnd}
          onMouseMove={handleSeekMove}
          onTouchStart={handleSeekStart}
          onTouchEnd={handleSeekEnd}
          onTouchMove={handleSeekMove}
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${bufferedProgress}%` }} />
          <div className="absolute inset-y-0 left-0 rounded-full bg-secondary-fixed" style={{ width: `${progress}%` }} />
          <div className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-secondary-fixed shadow" style={{ left: `${progress}%`, marginLeft: "-6px" }} />
          {seekPreview !== null && (
            <div className="absolute -top-8 -translate-x-1/2 rounded bg-black/80 px-2 py-1 text-xs text-white" style={{ left: `${(seekPreview / duration) * 100}%` }}>
              {formatTime(seekPreview)}
            </div>
          )}
        </div>

        {/* Controls Row */}
        <div className="flex items-center gap-2 text-white">
          {/* Play/Pause */}
          <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="rounded p-1.5 hover:bg-white/10" aria-label={playing ? "مکث" : "پخش"}>
            {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
          </button>

          {/* Skip Back */}
          <button onClick={(e) => { e.stopPropagation(); seekTo(currentTime - SKIP); }} className="rounded p-1.5 hover:bg-white/10" aria-label={`${SKIP} ثانیه عقب`}>
            <SkipBack size={16} />
          </button>

          {/* Skip Forward */}
          <button onClick={(e) => { e.stopPropagation(); seekTo(currentTime + SKIP); }} className="rounded p-1.5 hover:bg-white/10" aria-label={`${SKIP} ثانیه جلو`}>
            <SkipForward size={16} />
          </button>

          {/* Time */}
          <span className="ml-auto shrink-0 text-xs tabular-nums opacity-80">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Spacer */}
          <span className="flex-1" />

          {/* Volume */}
          <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="rounded p-1.5 hover:bg-white/10" aria-label={muted ? "صدا" : "بیصدا"}>
            {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
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
            className="h-1 w-16 cursor-pointer appearance-none rounded-full bg-white/30 accent-secondary-fixed [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-secondary-fixed"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Speed */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); }}
              className="rounded p-1.5 text-xs font-bold hover:bg-white/10"
              aria-label="سرعت پخش"
            >
              {playbackRate}x
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-2 rounded-lg bg-primary p-1 shadow-lg">
                {SPEEDS.map((rate) => (
                  <button
                    key={rate}
                    onClick={(e) => { e.stopPropagation(); setSpeed(rate); }}
                    className={`block w-full rounded-md px-5 py-1.5 text-center text-xs font-bold transition hover:bg-white/10 ${rate === playbackRate ? "text-secondary-fixed" : "text-white/70"}`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fullscreen */}
          <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="rounded p-1.5 hover:bg-white/10" aria-label="تمامصفحه">
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>

      {/* Title */}
      {title && !playing && (
        <div className="absolute left-4 right-4 top-4 text-right">
          <p className="text-sm font-bold text-white drop-shadow-lg">{title}</p>
        </div>
      )}
    </div>
  );
}