import { useState } from "react";
import { toast } from "sonner";

interface ItemError {
  message: string;
  data?: { code?: string } | null;
}

// The item on screen is out of date: it changed, is gone, or is no longer in that state.
const STALE_CODES = new Set(["CONFLICT", "NOT_FOUND", "PRECONDITION_FAILED"]);

/**
 * Reports a failed write on a Note or Task, refetching its list when the item is stale.
 * A mutation with its own onError skips the global toast in utils/trpc.ts, so this shows it.
 */
export function itemErrorHandler(invalidate: () => Promise<void>) {
  return (error: ItemError) => {
    const code = error.data?.code;

    if (code !== undefined && STALE_CODES.has(code)) {
      void invalidate();
    }

    toast.error(error.message);
  };
}

/** The local edit that lost a version check, kept until Reload or Overwrite. */
export function useEditConflict<Fields>(invalidate: () => Promise<void>) {
  const [fields, setFields] = useState<Fields | null>(null);
  const onError = itemErrorHandler(invalidate);

  const clear = () => {
    setFields(null);
  };

  return {
    fields,
    clear,
    onUpdateError: (error: ItemError, attempted: Fields) => {
      if (error.data?.code === "CONFLICT") {
        setFields(attempted);

        return;
      }

      clear();
      onError(error);
    },
    reload: () => {
      clear();
      void invalidate();
    },
    /** Saves the local edit again on top of whatever version the server has now. */
    overwrite: async (
      latestVersion: () => Promise<number>,
      save: (version: number, edit: Fields) => void
    ) => {
      if (fields === null) {
        return;
      }

      try {
        save(await latestVersion(), fields);
      } catch {
        // The item is gone; the query cache already reported it. Drop the stale edit.
        clear();
        void invalidate();
      }
    },
  };
}
