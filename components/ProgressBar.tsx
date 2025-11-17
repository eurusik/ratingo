'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';

// Configure NProgress
NProgress.configure({
  showSpinner: false,
  speed: 400,
  minimum: 0.25,
  easing: 'ease',
  trickleSpeed: 200,
});

export function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    NProgress.done();
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.currentTarget as HTMLAnchorElement;
      const href = target.getAttribute('href');

      if (href && href.startsWith('/')) {
        NProgress.start();
      }
    };

    const handleRouteChange = () => {
      NProgress.done();
    };

    // Add click listeners to all links
    document.querySelectorAll('a[href^="/"]').forEach((link) => {
      link.addEventListener('click', handleAnchorClick as EventListener);
    });

    // Cleanup
    return () => {
      document.querySelectorAll('a[href^="/"]').forEach((link) => {
        link.removeEventListener('click', handleAnchorClick as EventListener);
      });
      NProgress.done();
    };
  }, []);

  return null;
}
