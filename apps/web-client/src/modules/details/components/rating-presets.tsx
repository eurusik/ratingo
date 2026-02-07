'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { useAuth, useAuthModalStore } from '@/core/auth';
import { useTranslation } from '@/shared/i18n';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { cn } from '@/shared/utils';
import { Slider } from '@/shared/ui';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/shared/ui/drawer';
import type { MediaType } from '@/shared/types';
import { useUserMediaState, useSetRating } from '@/modules/saved/hooks/use-me-lists';
import { getRatingColor } from '@/modules/reviews/components/rating-slider';
import { RATING_PRESETS, findPresetByScore, type RatingPresetId } from '../constants/rating-presets';

const SLIDER_AUTO_HIDE_MS = 3000;

interface RatingPresetsProps {
  mediaItemId: string;
  mediaType: MediaType;
}

function triggerAnimation(el: HTMLElement | null, className: string) {
  if (!el) return;
  el.classList.remove('animate-score-pulse', 'animate-score-commit');
  void el.offsetWidth;
  el.classList.add(className);
}

export function RatingPresets({ mediaItemId, mediaType }: RatingPresetsProps) {
  const { dict } = useTranslation();
  const isMobile = useIsMobile();
  const { isAuthenticated } = useAuth();
  const { openLogin } = useAuthModalStore();
  const { data: userMediaState } = useUserMediaState(mediaItemId, isAuthenticated);
  const { mutateAsync: setRating, isPending } = useSetRating(mediaItemId);

  const currentRating = userMediaState?.rating ?? null;
  const activePreset = currentRating != null ? findPresetByScore(currentRating) : null;

  const [sliderValue, setSliderValue] = useState(currentRating ?? 0);
  const [showSlider, setShowSlider] = useState(false);
  const [sliderMounted, setSliderMounted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isDraggingRef = useRef(false);
  const scoreRef = useRef<HTMLSpanElement>(null);

  // Keep slider mounted during exit animation
  useEffect(() => {
    if (showSlider) {
      setSliderMounted(true);
    }
  }, [showSlider]);

  useEffect(() => {
    if (currentRating != null) setSliderValue(currentRating);
  }, [currentRating]);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!isDraggingRef.current) setShowSlider(false);
    }, SLIDER_AUTO_HIDE_MS);
  }, []);

  useEffect(() => () => clearTimeout(hideTimerRef.current), []);

  const presetLabels = dict.rating.presets as Record<RatingPresetId, string>;

  const showToast = useCallback(
    (score: number, presetId: RatingPresetId) => {
      const preset = RATING_PRESETS.find((p) => p.id === presetId)!;
      toast.success(
        dict.rating.toast.saved
          .replace('{emoji}', preset.emoji)
          .replace('{label}', presetLabels[presetId])
          .replace('{score}', String(score)),
      );
    },
    [presetLabels, dict.rating.toast.saved],
  );

  const handlePresetClick = async (preset: (typeof RATING_PRESETS)[number]) => {
    if (!isAuthenticated) {
      openLogin();
      return;
    }

    setSliderValue(preset.score);
    setDrawerOpen(false);

    if (!isMobile) {
      setShowSlider(true);
      scheduleHide();
    }

    setAnimationKey((k) => k + 1);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    try {
      await setRating({ rating: preset.score, mediaType });
      showToast(preset.score, preset.id);
    } catch {
      toast.error(dict.rating.toast.error);
    }
  };

  const handleSliderChange = (v: number[]) => {
    isDraggingRef.current = true;
    clearTimeout(hideTimerRef.current);
    setSliderValue(v[0]);
    triggerAnimation(scoreRef.current, 'animate-score-pulse');
  };

  const handleFineTune = async (v: number[]) => {
    isDraggingRef.current = false;
    if (!activePreset) return;
    triggerAnimation(scoreRef.current, 'animate-score-commit');
    scheduleHide();
    try {
      await setRating({ rating: v[0], mediaType });
      showToast(v[0], activePreset.id);
    } catch {
      toast.error(dict.rating.toast.error);
    }
  };

  const handleClear = async () => {
    setShowSlider(false);
    setDrawerOpen(false);
    try {
      await setRating({ rating: null, mediaType });
      toast.success(dict.rating.toast.cleared);
    } catch {
      toast.error(dict.rating.toast.error);
    }
  };

  // Shared preset list (used by desktop inline + mobile drawer)
  const presetList = (className?: string) => (
    <div className={cn('flex flex-col gap-2', className)}>
      {RATING_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => handlePresetClick(preset)}
          disabled={isPending}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer',
            'bg-cinema-card/60 hover:bg-cinema-card/80',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            activePreset?.id === preset.id && 'ring-1 ring-cinema-accent bg-cinema-card/80',
          )}
        >
          <span className="text-2xl">{preset.emoji}</span>
          <span className="text-base font-medium text-cinema-text-secondary">
            {presetLabels[preset.id]}
          </span>
        </button>
      ))}
    </div>
  );

  // Desktop inline presets (horizontal)
  const inlinePresets = (
    <div className="flex flex-wrap gap-2">
      {RATING_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => handlePresetClick(preset)}
          disabled={isPending}
          className={cn(
            'flex items-center gap-1.5 bg-cinema-card/60 backdrop-blur-sm px-3 py-1.5 rounded-lg',
            'hover:bg-cinema-card/80 transition-colors cursor-pointer',
            'text-sm text-cinema-text-secondary',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          <span>{preset.emoji}</span>
          <span>{presetLabels[preset.id]}</span>
        </button>
      ))}
    </div>
  );

  // --- RATED STATE ---
  if (activePreset && currentRating != null) {
    const displayScore = showSlider ? sliderValue : currentRating;
    const displayPreset = findPresetByScore(displayScore) ?? activePreset;

    const badge = (
      <div className="flex items-center gap-3">
        <button
          type="button"
          key={animationKey}
          onClick={() => {
            if (isMobile) {
              setDrawerOpen(true);
            } else {
              setShowSlider((v) => {
                if (!v) scheduleHide();
                return !v;
              });
            }
          }}
          className={cn(
            'relative flex items-center gap-2 cursor-pointer',
            isAnimating && 'animate-vote-pop',
          )}
        >
          <span className="text-lg">{displayPreset.emoji}</span>
          <span className="text-sm font-medium text-cinema-text-secondary transition-colors duration-150">
            {presetLabels[displayPreset.id]}
          </span>
          <span
            ref={scoreRef}
            className={cn(
              'text-sm font-bold tabular-nums transition-colors duration-150 inline-block',
              getRatingColor(displayScore),
            )}
          >
            ({displayScore})
          </span>
          {isAnimating && (
            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="absolute w-6 h-6 rounded-full border-2 border-cinema-accent animate-vote-burst" />
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={isPending}
          className="flex items-center gap-1 text-xs text-cinema-text-muted hover:text-red-400 transition-colors cursor-pointer disabled:opacity-40"
        >
          <X className="w-3 h-3" />
          {dict.rating.clear}
        </button>
      </div>
    );

    return (
      <div className="space-y-2">
        {badge}

        {/* Desktop: inline mini-slider with enter/exit animation */}
        {!isMobile && sliderMounted && (
          <div
            className={cn(
              'flex items-center gap-3 max-w-xs transition-all duration-200 ease-out',
              showSlider
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 -translate-y-1',
            )}
            onTransitionEnd={() => {
              if (!showSlider) setSliderMounted(false);
            }}
          >
            <span className="text-[10px] text-cinema-text-muted whitespace-nowrap">
              {dict.rating.finetune}
            </span>
            <Slider
              value={[sliderValue]}
              onValueChange={handleSliderChange}
              onValueCommit={handleFineTune}
              min={activePreset.min}
              max={activePreset.max}
              step={1}
              disabled={isPending}
              className="w-full"
            />
          </div>
        )}

        {/* Mobile: drawer for re-selection + fine-tune */}
        {isMobile && (
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerContent>
              <DrawerHeader className="text-center">
                <DrawerTitle>{dict.rating.prompt}</DrawerTitle>
                <DrawerDescription className="sr-only">{dict.rating.title}</DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-6 space-y-4">
                {presetList()}
                <div className="space-y-1 px-1">
                  <span className="text-xs text-cinema-text-muted">{dict.rating.finetune}</span>
                  <Slider
                    value={[sliderValue]}
                    onValueChange={(v) => setSliderValue(v[0])}
                    onValueCommit={(v) => handleFineTune(v)}
                    min={activePreset.min}
                    max={activePreset.max}
                    step={1}
                    disabled={isPending}
                    className="w-full"
                  />
                  <div className="flex items-center justify-between text-xs text-cinema-text-muted tabular-nums">
                    <span>{activePreset.min}</span>
                    <span className={cn('text-sm font-bold', getRatingColor(sliderValue))}>
                      {sliderValue}
                    </span>
                    <span>{activePreset.max}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isPending}
                  className="flex items-center justify-center gap-1 w-full py-2 text-sm text-cinema-text-muted hover:text-red-400 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <X className="w-3.5 h-3.5" />
                  {dict.rating.clear}
                </button>
              </div>
            </DrawerContent>
          </Drawer>
        )}
      </div>
    );
  }

  // --- UNRATED STATE ---

  // Mobile: single CTA button → drawer
  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => {
            if (!isAuthenticated) {
              openLogin();
              return;
            }
            setDrawerOpen(true);
          }}
          className={cn(
            'flex items-center gap-2 bg-cinema-card/60 backdrop-blur-sm px-4 py-2 rounded-lg',
            'hover:bg-cinema-card/80 transition-colors cursor-pointer',
            'text-sm font-medium text-cinema-text-secondary',
          )}
        >
          <span>🙂</span>
          <span>{dict.rating.rate}</span>
        </button>

        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerContent>
            <DrawerHeader className="text-center">
              <DrawerTitle>{dict.rating.prompt}</DrawerTitle>
              <DrawerDescription className="sr-only">{dict.rating.title}</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-6">{presetList()}</div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Desktop: inline presets
  return inlinePresets;
}
