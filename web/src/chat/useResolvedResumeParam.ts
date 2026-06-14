import { api } from "@/lib/api";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

export interface ResolvedResumeParam {
  /** Raw `?resume=` from the URL. */
  resumeParam: string | null;
  /** Session id to bind after latest-descendant resolution. */
  targetId: string | null;
  /** False while resolving a non-empty resume param. */
  ready: boolean;
}

/**
 * Resolve `?resume=` to the latest session descendant before binding chat.
 *
 * Dashboard chat (rich gateway + embedded PTY) must not connect until this
 * finishes — otherwise a reload can briefly bind the parent id, then rebind
 * when the URL updates, leaving an inconsistent session or a blank chat.
 */
export function useResolvedResumeParam(profile: string): ResolvedResumeParam {
  const [searchParams, setSearchParams] = useSearchParams();
  const resumeParam = searchParams.get("resume")?.trim() || null;

  const [targetId, setTargetId] = useState<string | null>(resumeParam);
  const [ready, setReady] = useState(!resumeParam);

  useEffect(() => {
    if (!resumeParam) {
      setTargetId(null);
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);

    api
      .getSessionLatestDescendant(resumeParam, profile)
      .then((res) => {
        if (cancelled) return;
        const resolved =
          res.session_id && res.session_id !== resumeParam
            ? res.session_id
            : resumeParam;
        setTargetId(resolved);
        if (resolved !== resumeParam) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.set("resume", resolved);
              return next;
            },
            { replace: true },
          );
        }
      })
      .catch(() => {
        if (!cancelled) setTargetId(resumeParam);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [resumeParam, profile, setSearchParams]);

  return {
    resumeParam,
    targetId: resumeParam ? targetId : null,
    ready,
  };
}
