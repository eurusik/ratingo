import { X } from 'lucide-react';
import { cn } from '@/shared/utils';
import { Slider } from '@/shared/ui';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/shared/ui/drawer';
import { RATING_PRESETS, type RatingPresetId } from '../constants/rating-presets';

export type RatingPreset = (typeof RATING_PRESETS)[number];

// --- PresetButton ---

interface PresetButtonProps {
  preset: RatingPreset;
  label: string;
  isActive: boolean;
  disabled: boolean;
  onClick: () => void;
  className?: string;
}

export function PresetButton({
  preset,
  label,
  isActive,
  disabled,
  onClick,
  className,
}: PresetButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isActive}
      className={cn(
        'flex items-center transition-colors cursor-pointer',
        'bg-cinema-card/60 hover:bg-cinema-card/80',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        isActive && 'ring-1 ring-cinema-accent bg-cinema-card/80',
        className,
      )}
    >
      <span aria-hidden="true">{preset.emoji}</span>
      <span className="font-medium text-cinema-text-secondary">{label}</span>
    </button>
  );
}

// --- PresetList ---

interface PresetListProps {
  presetLabels: Record<RatingPresetId, string>;
  activePresetId: RatingPresetId | null;
  disabled: boolean;
  onSelect: (preset: RatingPreset) => void;
  itemClassName?: string;
}

export function PresetList({
  presetLabels,
  activePresetId,
  disabled,
  onSelect,
  itemClassName,
}: PresetListProps) {
  return (
    <>
      {RATING_PRESETS.map((preset) => (
        <PresetButton
          key={preset.id}
          preset={preset}
          label={presetLabels[preset.id]}
          isActive={activePresetId === preset.id}
          disabled={disabled}
          onClick={() => onSelect(preset)}
          className={itemClassName}
        />
      ))}
    </>
  );
}

// --- ClearButton ---

interface ClearButtonProps {
  onClick: () => void;
  disabled: boolean;
  label: string;
  className?: string;
}

export function ClearButton({ onClick, disabled, label, className }: ClearButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex items-center gap-1 text-cinema-text-muted hover:text-red-400',
        'transition-colors cursor-pointer disabled:opacity-40',
        className,
      )}
    >
      <X className="w-3 h-3 md:w-3.5 md:h-3.5" />
      {label}
    </button>
  );
}

// --- RatingDrawer ---

interface RatingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
}

export function RatingDrawer({ open, onOpenChange, title, description, children }: RatingDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-center">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription className="sr-only">{description}</DrawerDescription>
        </DrawerHeader>
        {children}
      </DrawerContent>
    </Drawer>
  );
}

// --- FineTuneSlider ---

interface FineTuneSliderProps {
  visible: boolean;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  label: string;
  onValueChange: (v: number[]) => void;
  onValueCommit: (v: number[]) => void;
}

export function FineTuneSlider({
  visible,
  value,
  min,
  max,
  disabled,
  label,
  onValueChange,
  onValueCommit,
}: FineTuneSliderProps) {
  return (
    <div
      className={cn(
        'hidden md:grid transition-all duration-200 ease-out',
        visible ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0 mt-0',
      )}
    >
      <div className={cn('overflow-hidden', !visible && 'pointer-events-none')}>
        <div className="flex items-center gap-3 max-w-xs py-0.5">
          <span className="text-[10px] text-cinema-text-muted whitespace-nowrap">{label}</span>
          <Slider
            value={[value]}
            onValueChange={onValueChange}
            onValueCommit={onValueCommit}
            min={min}
            max={max}
            step={1}
            disabled={disabled}
            aria-label={label}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
