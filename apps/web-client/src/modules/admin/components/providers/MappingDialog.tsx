'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';
import { useProviders } from '@/core/query';
import { Loader2 } from 'lucide-react';

/** Distribution channel options. */
const DISTRIBUTION_CHANNELS = [
  { value: 'direct', label: 'Direct (own service)' },
  { value: 'amazon_channel', label: 'Amazon Channel' },
  { value: 'apple_tv_channel', label: 'Apple TV Channel' },
] as const;

export interface MappingFormData {
  tmdbProviderId: number;
  tmdbProviderName?: string;
  providerId: string;
  variantId: string;
  distributionChannel: string;
  region: string;
}

export interface MappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: MappingFormData) => Promise<void>;
  initialData?: Partial<MappingFormData>;
  mode: 'create' | 'edit';
  labels?: {
    title?: string;
    description?: string;
    tmdbProviderId?: string;
    tmdbProviderName?: string;
    providerId?: string;
    variantId?: string;
    distributionChannel?: string;
    region?: string;
    cancel?: string;
    submit?: string;
    submitting?: string;
  };
}

/**
 * Dialog for creating/editing provider mappings.
 * User-friendly form with provider autocomplete.
 */
export function MappingDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  mode,
  labels,
}: MappingDialogProps) {
  const [formData, setFormData] = useState<MappingFormData>({
    tmdbProviderId: 0,
    tmdbProviderName: '',
    providerId: '',
    variantId: '',
    distributionChannel: 'direct',
    region: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: providers = [], isLoading: providersLoading } = useProviders();

  // Reset form when dialog opens with initial data
  useEffect(() => {
    if (open && initialData) {
      setFormData({
        tmdbProviderId: initialData.tmdbProviderId ?? 0,
        tmdbProviderName: initialData.tmdbProviderName ?? '',
        providerId: initialData.providerId ?? '',
        variantId: initialData.variantId ?? '',
        distributionChannel: initialData.distributionChannel ?? 'direct',
        region: initialData.region ?? '',
      });
    } else if (open) {
      setFormData({
        tmdbProviderId: 0,
        tmdbProviderName: '',
        providerId: '',
        variantId: '',
        distributionChannel: 'direct',
        region: '',
      });
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProviderSelect = (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    setFormData((prev) => ({
      ...prev,
      providerId,
      // Auto-fill variantId with provider name if empty
      variantId: prev.variantId || provider?.name || providerId,
    }));
  };

  const isValid =
    formData.tmdbProviderId > 0 &&
    formData.providerId.length > 0 &&
    formData.variantId.length > 0 &&
    formData.distributionChannel.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {labels?.title ?? (mode === 'create' ? 'Create mapping' : 'Edit mapping')}
          </DialogTitle>
          <DialogDescription>
            {labels?.description ??
              'Mapping links a TMDB provider to our canonical provider'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* TMDB Provider ID */}
          <div className="space-y-2">
            <Label htmlFor="tmdbProviderId">{labels?.tmdbProviderId ?? 'TMDB Provider ID'}</Label>
            <Input
              id="tmdbProviderId"
              type="number"
              min={1}
              value={formData.tmdbProviderId || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  tmdbProviderId: parseInt(e.target.value) || 0,
                }))
              }
              placeholder="e.g., 8 (Netflix)"
              disabled={mode === 'edit'}
              className="h-9"
            />
            {formData.tmdbProviderName && (
              <p className="text-sm text-muted-foreground">
                TMDB name: {formData.tmdbProviderName}
              </p>
            )}
          </div>

          {/* Canonical Provider */}
          <div className="space-y-2">
            <Label htmlFor="providerId">{labels?.providerId ?? 'Canonical Provider'}</Label>
            <Select
              value={formData.providerId}
              onValueChange={handleProviderSelect}
              disabled={providersLoading}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select provider..." />
              </SelectTrigger>
              <SelectContent>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name} ({provider.count} media)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Our internal provider ID (e.g., netflix, amazon-prime-video)
            </p>
          </div>

          {/* Variant ID */}
          <div className="space-y-2">
            <Label htmlFor="variantId">{labels?.variantId ?? 'Variant ID'}</Label>
            <Input
              id="variantId"
              value={formData.variantId}
              onChange={(e) => setFormData((prev) => ({ ...prev, variantId: e.target.value }))}
              placeholder="e.g., Netflix, Netflix Basic"
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">
              Display name for the variant (may differ from canonical ID)
            </p>
          </div>

          {/* Distribution Channel */}
          <div className="space-y-2">
            <Label htmlFor="distributionChannel">
              {labels?.distributionChannel ?? 'Distribution Channel'}
            </Label>
            <Select
              value={formData.distributionChannel}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, distributionChannel: value }))
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISTRIBUTION_CHANNELS.map((channel) => (
                  <SelectItem key={channel.value} value={channel.value}>
                    {channel.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              direct = own service, channel = via Amazon/Apple
            </p>
          </div>

          {/* Region */}
          <div className="space-y-2">
            <Label htmlFor="region">{labels?.region ?? 'Region (optional)'}</Label>
            <Input
              id="region"
              value={formData.region}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, region: e.target.value.toUpperCase() }))
              }
              placeholder="UA, US, or empty for global"
              maxLength={2}
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">
              Empty = global mapping for all regions
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {labels?.cancel ?? 'Cancel'}
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {labels?.submitting ?? 'Saving...'}
                </>
              ) : (
                (labels?.submit ?? (mode === 'create' ? 'Create' : 'Save'))
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
