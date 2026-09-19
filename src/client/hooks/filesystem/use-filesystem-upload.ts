import { FILESYSTEM_COPY } from "@client/content/ko/filesystem/filesystem";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DesktopPlacement, FilesystemEntry } from "@/types/filesystem/filesystem";
import { FILESYSTEM_ENTRY_KIND, FILESYSTEM_ROOT_ID } from "@/constants/filesystem/filesystem";
import { FILESYSTEM_UPLOAD_POLICY } from "@client/constants/filesystem/filesystem";
import { messageFromError } from "@client/errors/error-message";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type { LocalUploadNode, UploadTransferState } from "@client/types/filesystem/upload";

const INITIAL_TRANSFER_STATE: UploadTransferState = {
  isOpen: false,
  isRunning: false,
  isStopping: false,
  total: 0,
  completed: 0,
  succeeded: 0,
  remaining: 0,
  failures: [],
  notice: null,
};

type UploadStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

interface UploadJob {
  readonly node: LocalUploadNode;
  readonly path: string;
  readonly parent: UploadJob | null;
  readonly parentId: string;
  readonly placement: DesktopPlacement | undefined;
  status: UploadStatus;
  result: FilesystemEntry | null;
  error: string | null;
}

interface UploadSession {
  readonly gateway: FilesystemGateway;
  active: boolean;
  token: object | null;
  running: boolean;
  stopping: boolean;
  jobs: UploadJob[];
  notice: string | null;
}

export function useFilesystemUpload(
  gateway: FilesystemGateway,
  onChanged: () => void,
) {
  const session = useMemo<UploadSession>(
    () => ({
      gateway,
      active: false,
      token: null,
      running: false,
      stopping: false,
      jobs: [],
      notice: null,
    }),
    [gateway],
  );
  const latestChanged = useRef(onChanged);
  const [snapshot, setSnapshot] = useState({ session, state: INITIAL_TRANSFER_STATE });

  useLayoutEffect(() => {
    latestChanged.current = onChanged;
  });
  useLayoutEffect(() => {
    session.active = true;
    setSnapshot({ session, state: INITIAL_TRANSFER_STATE });
    return () => {
      session.active = false;
      session.token = null;
      session.running = false;
      session.jobs = [];
    };
  }, [session]);

  const publish = useCallback(() => {
    if (!session.active) return;
    const succeeded = session.jobs.filter((job) => job.status === "succeeded").length;
    const failures = session.jobs
      .filter((job) => job.status === "failed" || job.status === "skipped")
      .map((job) => ({
        path: job.path,
        message: job.error ?? FILESYSTEM_COPY.TRANSFER_FAILED,
        skipped: job.status === "skipped",
      }));
    setSnapshot({
      session,
      state: {
        isOpen: true,
        isRunning: session.running,
        isStopping: session.stopping,
        total: session.jobs.length,
        completed: succeeded + failures.length,
        succeeded,
        remaining: session.jobs.length - succeeded - failures.length,
        failures,
        notice: session.notice,
      },
    });
  }, [session]);

  const run = useCallback(async (): Promise<void> => {
    if (!session.active || session.running || session.jobs.length === 0) return;
    const token = {};
    session.token = token;
    session.running = true;
    session.stopping = false;
    const jobs = session.jobs;
    for (const job of jobs) {
      if (job.status !== "succeeded") {
        job.status = "pending";
        job.error = null;
      }
    }
    publish();
    let changed = false;
    const isCurrent = () => session.active && session.token === token;
    const canStart = () => isCurrent() && !session.stopping;
    const execute = async (job: UploadJob): Promise<void> => {
      if (!canStart() || job.status === "succeeded") return;
      if (job.parent && job.parent.status !== "succeeded") {
        job.status = "skipped";
        job.error = job.parent.error;
        publish();
        return;
      }
      job.status = "running";
      publish();
      const parentId = job.parent?.result?.id ?? job.parentId;
      try {
        const result = job.node.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
          ? await gateway.createDirectory(parentId, job.node.name, job.placement)
          : await gateway.uploadFile(parentId, job.node.file, job.placement);
        if (!isCurrent()) return;
        job.result = result;
        job.status = "succeeded";
        changed = true;
      } catch (error) {
        if (!isCurrent()) return;
        job.status = "failed";
        job.error = messageFromError(error, FILESYSTEM_COPY.TRANSFER_FAILED);
      }
      publish();
    };

    // Parents precede children; retain their server IDs between executions.
    for (const job of jobs) {
      if (!canStart()) break;
      if (job.node.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY) await execute(job);
    }
    const files = jobs.filter((job) => job.node.kind === FILESYSTEM_ENTRY_KIND.FILE);
    const needsDesktopOrder = (job: UploadJob): boolean => job.placement !== undefined ||
      (job.parent === null && job.parentId === FILESYSTEM_ROOT_ID.DESKTOP);
    for (const job of files) {
      if (!canStart()) break;
      if (needsDesktopOrder(job)) await execute(job);
    }
    const concurrent = files.filter((job) => !needsDesktopOrder(job));
    let next = 0;
    const worker = async (): Promise<void> => {
      while (canStart() && next < concurrent.length) {
        const job = concurrent[next];
        next += 1;
        if (job) await execute(job);
      }
    };
    await Promise.all(Array.from({
      length: Math.min(FILESYSTEM_UPLOAD_POLICY.CONCURRENCY, concurrent.length),
    }, worker));
    if (!isCurrent()) return;
    session.token = null;
    session.running = false;
    session.stopping = false;
    if (changed) latestChanged.current();
    const complete = jobs.every((job) => job.status === "succeeded");
    if (complete && session.notice === FILESYSTEM_COPY.TRANSFER_PENDING_NOTICE) {
      session.notice = null;
    }
    if (complete && session.notice === null) {
      session.jobs = [];
      setSnapshot({ session, state: INITIAL_TRANSFER_STATE });
    } else {
      publish();
    }
  }, [gateway, publish, session]);

  const upload = useCallback(async (
    nodes: readonly LocalUploadNode[],
    parentId: string,
    desktopPlacement?: DesktopPlacement,
    notice: string | null = null,
  ): Promise<void> => {
    if (!session.active || nodes.length === 0) return;
    if (session.running || session.jobs.some((job) => job.status !== "succeeded")) {
      session.notice = FILESYSTEM_COPY.TRANSFER_PENDING_NOTICE;
      publish();
      return;
    }
    session.jobs = createJobs(nodes, parentId, desktopPlacement);
    session.notice = notice;
    await run();
  }, [publish, run, session]);

  const stop = useCallback(() => {
    if (!session.active || !session.running || session.stopping) return;
    session.stopping = true;
    publish();
  }, [publish, session]);

  const close = useCallback(() => {
    if (!session.active || session.running) return;
    session.jobs = [];
    session.notice = null;
    setSnapshot({ session, state: INITIAL_TRANSFER_STATE });
  }, [session]);

  return {
    state: snapshot.session === session ? snapshot.state : INITIAL_TRANSFER_STATE,
    upload,
    retry: run,
    stop,
    close,
  };
}

function createJobs(
  nodes: readonly LocalUploadNode[],
  parentId: string,
  placement?: DesktopPlacement,
  parent: UploadJob | null = null,
): UploadJob[] {
  return nodes.flatMap((node) => {
    const job: UploadJob = {
      node,
      path: parent ? `${parent.path}/${node.name}` : node.name,
      parent,
      parentId,
      placement,
      status: "pending",
      result: null,
      error: null,
    };
    return [job, ...(node.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
      ? createJobs(node.children, parentId, undefined, job)
      : [])];
  });
}
