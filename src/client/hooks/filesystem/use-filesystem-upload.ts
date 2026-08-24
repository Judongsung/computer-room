import { useCallback, useState } from "react";
import type { DesktopPlacement } from "@/types/filesystem/filesystem";
import { FILESYSTEM_ENTRY_KIND } from "@/constants/filesystem/filesystem";
import {
  FILESYSTEM_COPY,
  FILESYSTEM_UPLOAD_POLICY,
} from "@client/constants/filesystem/filesystem";
import type { FilesystemGateway } from "@client/types/filesystem/filesystem";
import type {
  LocalUploadNode,
  UploadFailure,
  UploadTransferState,
} from "@client/types/filesystem/upload";

const INITIAL_TRANSFER_STATE: UploadTransferState = {
  isOpen: false,
  isRunning: false,
  total: 0,
  completed: 0,
  failures: [],
  notice: null,
};

export function useFilesystemUpload(
  gateway: FilesystemGateway,
  onChanged: () => void,
) {
  const [state, setState] = useState<UploadTransferState>(
    INITIAL_TRANSFER_STATE,
  );

  const upload = useCallback(
    async (
      nodes: readonly LocalUploadNode[],
      parentId: string,
      desktopPlacement?: DesktopPlacement,
      notice: string | null = null,
    ): Promise<void> => {
      if (nodes.length === 0) return;
      setState({
        isOpen: true,
        isRunning: true,
        total: countNodes(nodes),
        completed: 0,
        failures: [],
        notice,
      });
      const failures: UploadFailure[] = [];
      const fileJobs: FileJob[] = [];
      let changed = false;

      const recordFailure = (failure: UploadFailure): void => {
        failures.push(failure);
        setState((current) => ({
          ...current,
          completed: current.completed + 1,
          failures: [...failures],
        }));
      };
      const recordSuccess = (): void => {
        changed = true;
        setState((current) => ({
          ...current,
          completed: current.completed + 1,
        }));
      };

      const prepare = async (
        currentNodes: readonly LocalUploadNode[],
        currentParentId: string,
        pathPrefix: string,
        rootPlacement?: DesktopPlacement,
      ): Promise<void> => {
        for (const node of currentNodes) {
          const path = pathPrefix ? `${pathPrefix}/${node.name}` : node.name;
          if (node.kind === FILESYSTEM_ENTRY_KIND.FILE) {
            fileJobs.push({
              file: node.file,
              parentId: currentParentId,
              path,
              ...(rootPlacement === undefined
                ? {}
                : { desktopPlacement: rootPlacement }),
            });
            continue;
          }
          try {
            const directory = await gateway.createDirectory(
              currentParentId,
              node.name,
              rootPlacement,
            );
            recordSuccess();
            await prepare(node.children, directory.id, path);
          } catch (error) {
            recordFailure({ path, message: errorMessage(error), skipped: false });
            for (const skipped of flattenPaths(node.children, path)) {
              recordFailure({
                path: skipped,
                message: errorMessage(error),
                skipped: true,
              });
            }
          }
        }
      };

      await prepare(nodes, parentId, "", desktopPlacement);
      const desktopJobs = fileJobs.filter(
        (job) => job.desktopPlacement !== undefined,
      );
      const concurrentJobs = fileJobs.filter(
        (job) => job.desktopPlacement === undefined,
      );
      const runJob = async (job: FileJob): Promise<void> => {
        try {
          await gateway.uploadFile(
            job.parentId,
            job.file,
            job.desktopPlacement,
          );
          recordSuccess();
        } catch (error) {
          recordFailure({
            path: job.path,
            message: errorMessage(error),
            skipped: false,
          });
        }
      };

      for (const job of desktopJobs) {
        await runJob(job);
      }

      let nextJob = 0;
      const worker = async (): Promise<void> => {
        while (nextJob < concurrentJobs.length) {
          const job = concurrentJobs[nextJob];
          nextJob += 1;
          if (!job) continue;
          await runJob(job);
        }
      };
      await Promise.all(
        Array.from(
          {
            length: Math.min(
              FILESYSTEM_UPLOAD_POLICY.CONCURRENCY,
              concurrentJobs.length,
            ),
          },
          worker,
        ),
      );
      if (changed) onChanged();
      setState((current) =>
        failures.length === 0 && notice === null
          ? INITIAL_TRANSFER_STATE
          : { ...current, isRunning: false },
      );
    },
    [gateway, onChanged],
  );

  const close = useCallback(() => {
    setState((current) =>
      current.isRunning ? current : INITIAL_TRANSFER_STATE,
    );
  }, []);

  return { state, upload, close };
}

interface FileJob {
  readonly file: File;
  readonly parentId: string;
  readonly path: string;
  readonly desktopPlacement?: DesktopPlacement;
}

function countNodes(nodes: readonly LocalUploadNode[]): number {
  return nodes.reduce(
    (total, node) =>
      total +
      1 +
      (node.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
        ? countNodes(node.children)
        : 0),
    0,
  );
}

function flattenPaths(
  nodes: readonly LocalUploadNode[],
  prefix: string,
): string[] {
  return nodes.flatMap((node) => {
    const path = `${prefix}/${node.name}`;
    return [
      path,
      ...(node.kind === FILESYSTEM_ENTRY_KIND.DIRECTORY
        ? flattenPaths(node.children, path)
        : []),
    ];
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : FILESYSTEM_COPY.TRANSFER_FAILED;
}
