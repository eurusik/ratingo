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
import { getRatingColor } from '@/modules/reviews';
import { RATING_PRESETS, findPresetByScore, type RatingPresetId } from '../constants/rating-presets';

const SLIDER_AUTO_HIDE_MS = 3000;

interface RatingPresetsProps {
  mediaItemId: string;
  mediaType: MediaType;
}

// --- Sub-components ---

interface PresetButtonProps {
  preset: (typeof RATING_PRESETS)[number];
  label: string;
  isActive: boolean;
  disabled: boolean;
  onClick: () => void;
  variant: 'inline' | 'vertical';
}

function PresetButton({ preset, label, isActive, disabled, onClick, variant }: PresetButtonProps) {
  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={isActive}
        className={cn(
          'flex items-center gap-1.5 bg-cinema-card/60 backdrop-blur-sm px-3 py-1.5 rounded-lg',
          'hover:bg-cinema-card/80 transition-colors cursor-pointer',
          'text-sm text-cinema-text-secondary',
          'disabled:opacity-40 disabled:cursor-not-allowed',
        )}
      >
        <span aria-hidden="true">{preset.emoji}</span>
        <span>{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isActive}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer',
        'bg-cinema-card/60 hover:bg-cinema-card/80',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        isActive && 'ring-1 ring-cinema-accent bg-cinema-card/80',
      )}
    >
      <span className="text-2xl" aria-hidden="true">{preset.emoji}</span>
      <span className="text-base font-medium text-cinema-text-secondary">{label}</span>
    </button>
  );
}

// --- Main component ---

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
  const animTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isDraggingRef = useRef(false);
  const mutatingRef = useRef(false);
  const scoreRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (showSlider) setSliderMounted(true);
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

  useEffect(() => () => {
    clearTimeout(hideTimerRef.current);
    clearTimeout(animTimerRef.current);
  }, []);

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

  const triggerScoreAnimation = useCallback((className: string) => {
    const el = scoreRef.current;
    if (!el) return;
    el.classList.remove('animate-score-pulse', 'animate-score-commit');
    void el.offsetWidth;
    el.classList.add(className);
  }, []);

  const handlePresetClick = async (preset: (typeof RATING_PRESETS)[number]) => {
    if (!isAuthenticated) {
      openLogin();
      return;
    }
    if (mutatingRef.current) return;

    setSliderValue(preset.score);
    setDrawerOpen(false);

    if (!isMobile) {
      setShowSlider(true);
      scheduleHide();
    }

    setAnimationKey((k) => k + 1);
    setIsAnimating(true);
    clearTimeout(animTimerRef.current);
    animTimerRef.current = setTimeout(() => setIsAnimating(false), 300);

    mutatingRef.current = true;
    try {
      await setRating({ rating: preset.score, mediaType });
      showToast(preset.score, preset.id);
    } catch {
      toast.error(dict.rating.toast.error);
    } finally {
      mutatingRef.current = false;
    }
  };

  const handleSliderChange = (v: number[]) => {
    isDraggingRef.current = true;
    clearTimeout(hideTimerRef.current);
    setSliderValue(v[0]);
    triggerScoreAnimation('animate-score-pulse');
  };

  const handleFineTune = async (v: number[]) => {
    isDraggingRef.current = false;
    if (!activePreset || mutatingRef.current) return;
    triggerScoreAnimation('animate-score-commit');
    scheduleHide();
    mutatingRef.current = true;
    try {
      await setRating({ rating: v[0], mediaType });
      showToast(v[0], activePreset.id);
    } catch {
      toast.error(dict.rating.toast.error);
    } finally {
      mutatingRef.current = false;
    }
  };

  const handleClear = async () => {
    if (mutatingRef.current) return;
    setShowSlider(false);
    setDrawerOpen(false);
    mutatingRef.current = true;
    try {
      await setRating({ rating: null, mediaType });
      toast.success(dict.rating.toast.cleared);
    } catch {
      toast.error(dict.rating.toast.error);
    } finally {
      mutatingRef.current = false;
    }
  };

  const hasRating = activePreset && currentRating != null;

  // --- RATED STATE ---
  if (hasRating) {
    const displayScore = showSlider ? sliderValue : currentRating;
    const displayPreset = findPresetByScore(displayScore) ?? activePreset;

    return (
      <div className="space-y-1">
        <span className="text-[10px] md:text-xs text-cinema-text-muted">
          {dict.rating.title}
        </span>

        <div className="space-y-2">
          {/* Badge + clear */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              key={animationKey}
              aria-label={dict.rating.finetune}
              aria-expanded={!isMobile ? showSlider : undefined}
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
              <span className="text-lg" aria-hidden="true">{displayPreset.emoji}</span>
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
              aria-label={dict.rating.clear}
              className="flex items-center gap-1 text-xs text-cinema-text-muted hover:text-red-400 transition-colors cursor-pointer disabled:opacity-40"
            >
              <X className="w-3 h-3" />
              {dict.rating.clear}
            </button>
          </div>

          {/* Desktop: inline mini-slider with enter/exit animation */}
          {sliderMounted && (
            <div
              className={cn(
                'hidden md:flex items-center gap-3 max-w-xs transition-all duration-200 ease-out',
                showSlider ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1',
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
                aria-label={dict.rating.finetune}
                className="w-full"
              />
            </div>
          )}

          {/* Mobile: drawer for re-selection + fine-tune */}
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerContent>
              <DrawerHeader className="text-center">
                <DrawerTitle>{dict.rating.prompt}</DrawerTitle>
                <DrawerDescription className="sr-only">{dict.rating.title}</DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-6 space-y-4">
                <div className="flex flex-col gap-2">
                  {RATING_PRESETS.map((preset) => (
                    <PresetButton
                      key={preset.id}
                      preset={preset}
                      label={presetLabels[preset.id]}
                      isActive={activePreset.id === preset.id}
                      disabled={isPending}
                      onClick={() => handlePresetClick(preset)}
                      variant="vertical"
                    />
                  ))}
                </div>
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
                    aria-label={dict.rating.finetune}
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
                  aria-label={dict.rating.clear}
                  className="flex items-center justify-center gap-1 w-full py-2 text-sm text-cinema-text-muted hover:text-red-400 transition-colors cursor-pointer disabled:opacity-40"
                >
                  <X className="w-3.5 h-3.5" />
                  {dict.rating.clear}
                </button>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </div>
    );
  }

  // --- UNRATED STATE ---
  return (
    <>
      {/* Mobile: single CTA button → drawer */}
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
          'flex md:hidden items-center gap-2 bg-cinema-card/60 backdrop-blur-sm px-4 py-2 rounded-lg',
          'hover:bg-cinema-card/80 transition-colors cursor-pointer',
          'text-sm font-medium text-cinema-text-secondary',
        )}
      >
        <span aria-hidden="true">🙂</span>
        <span>{dict.rating.rate}</span>
      </button>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader className="text-center">
            <DrawerTitle>{dict.rating.prompt}</DrawerTitle>
            <DrawerDescription className="sr-only">{dict.rating.title}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <div className="flex flex-col gap-2">
              {RATING_PRESETS.map((preset) => (
                <PresetButton
                  key={preset.id}
                  preset={preset}
                  label={presetLabels[preset.id]}
                  isActive={false}
                  disabled={isPending}
                  onClick={() => handlePresetClick(preset)}
                  variant="vertical"
                />
              ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Desktop: inline presets */}
      <div className="hidden md:flex flex-wrap gap-2">
        {RATING_PRESETS.map((preset) => (
          <PresetButton
            key={preset.id}
            preset={preset}
            label={presetLabels[preset.id]}
            isActive={false}
            disabled={isPending}
            onClick={() => handlePresetClick(preset)}
            variant="inline"
          />
        ))}
      </div>
    </>
  );
}
