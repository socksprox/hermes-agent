import { useCallback, useRef, useState } from "react";

export interface QueuedMessage {
  id: string;
  text: string;
}

export function useMessageQueue() {
  const queueRef = useRef<QueuedMessage[]>([]);
  const [queue, setQueue] = useState<QueuedMessage[]>([]);

  const sync = useCallback(() => {
    setQueue([...queueRef.current]);
  }, []);

  const enqueue = useCallback(
    (text: string) => {
      queueRef.current.push({ id: crypto.randomUUID(), text });
      sync();
    },
    [sync],
  );

  const dequeue = useCallback((): QueuedMessage | undefined => {
    const head = queueRef.current.shift();
    sync();
    return head;
  }, [sync]);

  const remove = useCallback(
    (id: string) => {
      const before = queueRef.current.length;
      queueRef.current = queueRef.current.filter((m) => m.id !== id);
      if (queueRef.current.length !== before) sync();
    },
    [sync],
  );

  const take = useCallback(
    (id: string): QueuedMessage | undefined => {
      const item = queueRef.current.find((m) => m.id === id);
      queueRef.current = queueRef.current.filter((m) => m.id !== id);
      sync();
      return item;
    },
    [sync],
  );

  const clear = useCallback(() => {
    queueRef.current = [];
    sync();
  }, [sync]);

  const peek = useCallback(
    () => queueRef.current[0],
    [],
  );

  return { queue, enqueue, dequeue, remove, take, clear, peek };
}
