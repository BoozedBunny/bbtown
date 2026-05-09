"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";

type PreloadStatus = "idle" | "preloading" | "ready" | "error";

type UseTownPreloadParams = {
  townHref: string;
  glbAssets: string[];
  staticAssets: string[];
  enabled: boolean;
  buildVersion?: string;
  timeoutMs?: number;
  prefetchRoute?: (href: string) => void;
};

const DEFAULT_TIMEOUT_MS = 20_000;

export function useTownPreload({
  townHref,
  glbAssets,
  staticAssets,
  enabled,
  buildVersion = "v1",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  prefetchRoute,
}: UseTownPreloadParams) {
  const [status, setStatus] = useState<PreloadStatus>(
    enabled ? "preloading" : "idle",
  );
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const attemptRef = useRef(0);

  const cacheKey = useMemo(
    () => `town-preload:${townHref}:${buildVersion}`,
    [townHref, buildVersion],
  );

  const markReady = useCallback(() => {
    sessionStorage.setItem(cacheKey, "ready");
    setStatus("ready");
    setProgress(100);
    setError(undefined);
  }, [cacheKey]);

  const runPreload = useCallback(async () => {
    if (!enabled) {
      setStatus("idle");
      setProgress(0);
      setError(undefined);
      return;
    }

    if (sessionStorage.getItem(cacheKey) === "ready") {
      markReady();
      return;
    }

    const attemptId = ++attemptRef.current;
    setStatus("preloading");
    setProgress(0);
    setError(undefined);

    const routeTasks = [
      async () => {
        prefetchRoute?.(townHref);
      },
    ];

    const staticTasks = staticAssets.map((url) => async () => {
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) {
        throw new Error(`Failed to preload ${url}`);
      }
    });

    const glbTasks = glbAssets.map((url) => async () => {
      await useGLTF.preload(url);
    });

    const tasks = [...routeTasks, ...staticTasks, ...glbTasks];
    const totalTasks = tasks.length;
    let completed = 0;

    const updateProgress = () => {
      if (attemptRef.current !== attemptId) return;
      const computed = Math.floor((completed / totalTasks) * 100);
      const clamped = completed === totalTasks ? 100 : Math.min(95, computed);
      setProgress((current) => Math.max(current, clamped));
    };

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Preload timeout")), timeoutMs);
    });

    const preloadPromise = Promise.all(
      tasks.map(async (task) => {
        await task();
        completed += 1;
        updateProgress();
      }),
    );

    try {
      await Promise.race([preloadPromise, timeoutPromise]);
      if (attemptRef.current !== attemptId) return;
      markReady();
    } catch (cause) {
      if (attemptRef.current !== attemptId) return;
      setStatus("error");
      setProgress(0);
      setError(
        cause instanceof Error ? cause.message : "Unknown preload error",
      );
    }
  }, [
    cacheKey,
    enabled,
    glbAssets,
    markReady,
    prefetchRoute,
    staticAssets,
    timeoutMs,
    townHref,
  ]);

  useEffect(() => {
    runPreload();
  }, [runPreload]);

  const retry = useCallback(() => {
    runPreload();
  }, [runPreload]);

  return { status, progress, error, retry };
}
