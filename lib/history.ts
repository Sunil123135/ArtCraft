import { useCallback, useRef, useState } from "react";

export function useHistory<T>(initial: T, limit = 80) {
  const [state, setState] = useState<T>(initial);
  const undoStack = useRef<T[]>([]);
  const redoStack = useRef<T[]>([]);

  const commit = useCallback(
    (next: T | ((current: T) => T)) => {
      setState((current) => {
        const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next;
        undoStack.current = [...undoStack.current, current].slice(-limit);
        redoStack.current = [];
        return resolved;
      });
    },
    [limit],
  );

  const replace = useCallback((next: T | ((current: T) => T)) => {
    setState((current) =>
      typeof next === "function" ? (next as (current: T) => T)(current) : next,
    );
  }, []);

  const undo = useCallback(() => {
    setState((current) => {
      const previous = undoStack.current.pop();
      if (!previous) return current;
      redoStack.current.push(current);
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setState((current) => {
      const following = redoStack.current.pop();
      if (!following) return current;
      undoStack.current.push(current);
      return following;
    });
  }, []);

  return { state, setState: commit, replace, undo, redo };
}
