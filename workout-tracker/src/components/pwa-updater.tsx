
'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

export function PWAUpdater() {
  const { toast } = useToast();
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then(registration => {
      const promptIfWaiting = (worker: ServiceWorker) => {
        if (navigator.serviceWorker.controller) {
          setWaitingWorker(worker);
          setIsUpdateAvailable(true);
        }
      };

      if (registration.waiting) {
        promptIfWaiting(registration.waiting);
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            promptIfWaiting(newWorker);
          }
        });
      });
    });
  }, []);

  useEffect(() => {
    if (isUpdateAvailable) {
      toast({
        title: 'Update Available',
        description: 'A new version of LiftLogr is ready. Reload to update.',
        duration: Infinity,
        action: (
          <Button
            onClick={() => {
              if (waitingWorker) {
                waitingWorker.postMessage({ type: 'SKIP_WAITING' });
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                  window.location.reload();
                });
              }
            }}
          >
            Reload
          </Button>
        ),
      });
    }
  }, [isUpdateAvailable, waitingWorker, toast]);

  return null;
}
