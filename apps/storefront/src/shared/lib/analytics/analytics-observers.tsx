'use client';

import { useEffect } from 'react';
import { useReportWebVitals } from 'next/web-vitals';
import { useAuth } from '@ratingo/web-core/auth';
import { identifyUser, track } from './track';

export function AnalyticsIdentity() {
  const { user, isLoading } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (isLoading) return;
    identifyUser(userId);
  }, [isLoading, userId]);

  return null;
}

interface WebVitalMetric {
  name: string;
  value: number;
  id: string;
  rating: string;
}

function reportWebVital(metric: WebVitalMetric) {
  track('web_vitals', {
    metric_name: metric.name,
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    metric_id: metric.id,
    metric_rating: metric.rating,
  });
}

export function WebVitalsReporter() {
  useReportWebVitals(reportWebVital);

  return null;
}
