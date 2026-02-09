'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth, useAuthModalStore } from '@/core/auth';
import { useTranslation } from '@/shared/i18n';
import { cn } from '@/shared/utils';
import { Slider } from '@/shared/ui';
import type { MediaType } from '@/shared/types';
import { Skeleton } from '@/shared/ui';
import { useUserMediaState, useSetRating } from '@/modules/saved/hooks/use-me-lists';
import { getRatingColor } from '@/modules/reviews';
import { RATING_PRESETS, findPresetByScore, type RatingPresetId } from '../constants/rating-presets';
import { useMutationGuard } from '../hooks/use-mutation-guard';
import { useAutoHideTimer } from '../hooks/use-auto-hide-timer';
import {
  type RatingPreset,
  PresetList,
  ClearButton,
  RatingDrawer,
  FineTuneSlider,
} from './rating-preset-parts';

const ANIMATION_DURATION_MS = 300;

interface RatingPresetsProps {
  mediaItemId: string;
  mediaType: MediaType;
}

export function RatingPresets({ mediaItemId, mediaType }: RatingPresetsProps) {
  const { dict } = useTranslation();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { openLogin } = useAuthModalStore();
  const { data: userMediaState, isFetching } = useUserMediaState(mediaItemId, isAuthenticated);
  const { mutateAsync: setRating, isPending } = useSetRating(mediaItemId);

  const currentRating = userMediaState?.rating ?? null;
  const activePreset = currentRating != null ? findPresetByScore(currentRating) : null;
  const hasRating = activePreset != null && currentRating != null;

  const [sliderOverride, setSliderOverride] = useState<number | null>(null);
  const sliderValue = sliderOverride ?? currentRating ?? 0;

  const [showSlider, setShowSlider] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const animTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const scoreRef = useRef<HTMLSpanElement>(null);

  useEffect(() => () => clearTimeout(animTimerRef.current), []);

  const presetLabels = dict.userRating.presets as Record<RatingPresetId, string>;
  const { guard } = useMutationGuard(dict.userRating.toast.error);

  const hideSlider = useCallback(() => setShowSlider(false), []);
  const { schedule: scheduleHide, cancel: cancelHide, isDraggingRef } = useAutoHideTimer(hideSlider);

  // --- Helpers ---

  function showRatingToast(score: number, presetId: RatingPresetId) {
    const preset = RATING_PRESETS.find((p) => p.id === presetId)!;
    toast.success(
      dict.userRating.toast.saved
        .replace('{emoji}', preset.emoji)
        .replace('{label}', presetLabels[presetId])
        .replace('{score}', String(score)),
    );
  }

  function triggerScoreAnimation(className: string) {
    const el = scoreRef.current;
    if (!el) return;
    el.classList.remove('animate-score-pulse', 'animate-score-commit');
    void el.offsetWidth;
    el.classList.add(className);
  }

  function playVoteAnimation() {
    setAnimationKey((k) => k + 1);
    setIsAnimating(true);
    clearTimeout(animTimerRef.current);
    animTimerRef.current = setTimeout(() => setIsAnimating(false), ANIMATION_DURATION_MS);
  }

  function openSlider() {
    setShowSlider(true);
    scheduleHide();
  }

  // --- Event handlers ---

  const handlePresetClick = (preset: RatingPreset) => {
    if (!isAuthenticated) {
      openLogin();
      return;
    }

    setSliderOverride(preset.score);
    setDrawerOpen(false);
    openSlider();
    playVoteAnimation();

    guard(async () => {
      await setRating({ rating: preset.score, mediaType });
      showRatingToast(preset.score, preset.id);
      setSliderOverride(null);
    });
  };

  const handleSliderChange = ([score]: number[]) => {
    isDraggingRef.current = true;
    cancelHide();
    setSliderOverride(score);
    triggerScoreAnimation('animate-score-pulse');
  };

  const handleSliderCommit = ([score]: number[]) => {
    isDraggingRef.current = false;
    const committedPreset = findPresetByScore(score);
    if (!committedPreset) return;

    triggerScoreAnimation('animate-score-commit');
    scheduleHide();

    guard(async () => {
      await setRating({ rating: score, mediaType });
      showRatingToast(score, committedPreset.id);
      setSliderOverride(null);
    });
  };

  const handleClear = () => {
    setShowSlider(false);
    setDrawerOpen(false);
    setSliderOverride(null);

    guard(async () => {
      await setRating({ rating: null, mediaType });
      toast.success(dict.userRating.toast.cleared);
    });
  };

  const handleRatedBadgeClick = () => {
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    if (isDesktop) {
      if (showSlider) {
        setShowSlider(false);
      } else {
        openSlider();
      }
    } else {
      setDrawerOpen(true);
    }
  };

  const handleMobileRateClick = () => {
    if (!isAuthenticated) {
      openLogin();
      return;
    }
    setDrawerOpen(true);
  };

  // --- Rated state ---

  if (hasRating) {
    const displayScore = showSlider ? sliderValue : currentRating;
    const displayPreset = findPresetByScore(displayScore) ?? activePreset;

    return (
      <div className="space-y-1">
        <span className="text-[10px] md:text-xs text-cinema-text-muted">
          {dict.userRating.title}
        </span>

        <div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              key={animationKey}
              aria-label={dict.userRating.finetune}
              onClick={handleRatedBadgeClick}
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
              {isAnimating ? (
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="absolute w-6 h-6 rounded-full border-2 border-cinema-accent animate-vote-burst" />
                </span>
              ) : null}
            </button>

            <ClearButton
              onClick={handleClear}
              disabled={isPending}
              label={dict.userRating.clear}
              className="text-xs"
            />
          </div>

          <FineTuneSlider
            visible={showSlider}
            value={sliderValue}
            min={displayPreset.min}
            max={displayPreset.max}
            disabled={isPending}
            label={dict.userRating.finetune}
            onValueChange={handleSliderChange}
            onValueCommit={handleSliderCommit}
          />

          <RatingDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            title={dict.userRating.prompt}
            description={dict.userRating.title}
          >
            <div className="px-4 pb-6 space-y-4">
              <div className="flex flex-col gap-2">
                <PresetList
                  presetLabels={presetLabels}
                  activePresetId={activePreset.id}
                  disabled={isPending}
                  onSelect={handlePresetClick}
                  itemClassName="gap-3 px-4 py-3 rounded-xl text-base"
                />
              </div>
              <div className="space-y-1 px-1">
                <span className="text-xs text-cinema-text-muted">{dict.userRating.finetune}</span>
                <Slider
                  value={[sliderValue]}
                  onValueChange={([score]) => setSliderOverride(score)}
                  onValueCommit={handleSliderCommit}
                  min={displayPreset.min}
                  max={displayPreset.max}
                  step={1}
                  disabled={isPending}
                  aria-label={dict.userRating.finetune}
                  className="w-full"
                />
                <div className="flex items-center justify-between text-xs text-cinema-text-muted tabular-nums">
                  <span>{displayPreset.min}</span>
                  <span className={cn('text-sm font-bold', getRatingColor(sliderValue))}>
                    {sliderValue}
                  </span>
                  <span>{displayPreset.max}</span>
                </div>
              </div>
              <ClearButton
                onClick={handleClear}
                disabled={isPending}
                label={dict.userRating.clear}
                className="justify-center w-full py-2 text-sm"
              />
            </div>
          </RatingDrawer>
        </div>
      </div>
    );
  }

  // --- Skeleton while auth or rating state is resolving ---

  if (isAuthLoading || (isAuthenticated && isFetching && !userMediaState)) {
    return (
      <>
        <Skeleton className="h-9 w-28 rounded-lg md:hidden" />
        <div className="hidden md:flex gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </>
    );
  }

  // --- Unrated state ---

  return (
    <>
      <button
        type="button"
        onClick={handleMobileRateClick}
        className={cn(
          'flex md:hidden items-center gap-2 bg-cinema-card/60 backdrop-blur-sm px-4 py-2 rounded-lg',
          'hover:bg-cinema-card/80 transition-colors cursor-pointer',
          'text-sm font-medium text-cinema-text-secondary',
        )}
      >
        <span aria-hidden="true">🙂</span>
        <span>{dict.userRating.rate}</span>
      </button>

      <RatingDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={dict.userRating.prompt}
        description={dict.userRating.title}
      >
        <div className="px-4 pb-6">
          <div className="flex flex-col gap-2">
            <PresetList
              presetLabels={presetLabels}
              activePresetId={null}
              disabled={isPending}
              onSelect={handlePresetClick}
              itemClassName="gap-3 px-4 py-3 rounded-xl text-base"
            />
          </div>
        </div>
      </RatingDrawer>

      <div className="hidden md:flex flex-wrap gap-2">
        <PresetList
          presetLabels={presetLabels}
          activePresetId={null}
          disabled={isPending}
          onSelect={handlePresetClick}
          itemClassName="gap-1.5 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm"
        />
      </div>
    </>
  );
}
