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

/**
 * Render a selectable button that represents a rating preset.
 *
 * @param preset - The rating preset data (id, emoji, etc.) displayed by the button
 * @param label - Visible text label shown next to the preset emoji
 * @param isActive - Whether the preset is currently active; reflects in visual styling and `aria-pressed`
 * @param disabled - If true, disables interaction and applies disabled styling
 * @param onClick - Click handler invoked when the button is activated
 * @param className - Optional additional CSS classes applied to the button
 * @returns A JSX element representing the preset button
 */
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

/**
 * Render a list of rating preset buttons reflecting the active selection.
 *
 * @param presetLabels - Record mapping each preset `id` to the label text displayed on its button
 * @param activePresetId - The `id` of the currently active preset, or `null` when none is active
 * @param disabled - If `true`, all buttons are rendered in a disabled state
 * @param onSelect - Callback invoked with the selected preset when a button is clicked
 * @param itemClassName - Optional class name applied to each button for additional styling
 * @returns The rendered preset buttons as React nodes
 */
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

/**
 * Renders a compact clear button that shows an X icon and a label.
 *
 * The button uses `aria-label` for accessibility and respects the `disabled` state to prevent interaction and dim styling.
 *
 * @param onClick - Click handler invoked when the button is activated
 * @param disabled - When `true`, the button is non-interactive and styled as disabled
 * @param label - Visible text label and value for `aria-label`
 * @param className - Optional additional CSS classes to apply to the button
 */
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

/**
 * Render a centered drawer containing a title, a screen-reader-only description, and provided content.
 *
 * @param open - Whether the drawer is open
 * @param onOpenChange - Callback invoked when the drawer open state changes
 * @param title - Visible title shown in the drawer header
 * @param description - Accessible description rendered for screen readers
 * @param children - Content rendered inside the drawer body
 * @returns The Drawer element
 */
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

/**
 * Renders a responsive fine-tune slider for adjusting a numeric value.
 *
 * Renders a labeled slider that appears on medium screens and larger; its visible state controls layout, opacity, and interactivity.
 *
 * @param visible - Whether the slider is visible and interactive
 * @param value - Current numeric value shown by the slider
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param disabled - When true, disables user interaction with the slider
 * @param label - Accessible label shown alongside the slider
 * @param onValueChange - Called with the new value while the user is dragging the thumb
 * @param onValueCommit - Called with the final value when the user finishes an interaction
 * @returns The rendered slider component wrapped with its label and visibility controls
 */
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