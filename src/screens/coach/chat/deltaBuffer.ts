export interface FrameScheduler {
  request(callback: () => void): number;
  cancel(handle: number): void;
}

const animationFrames: FrameScheduler = {
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (handle) => window.cancelAnimationFrame(handle),
};

export interface DeltaBuffer {
  push(text: string): void;
  /** Hands over whatever is waiting now, e.g. before the stream's end is recorded. */
  flush(): void;
  /** Forgets whatever is waiting. */
  cancel(): void;
}

/**
 * Collects streamed pieces and hands them over at most once per animation frame, so a fast stream updates
 * the answer at the display's pace instead of re-rendering for every few characters.
 */
export function createDeltaBuffer(onFlush: (text: string) => void, scheduler: FrameScheduler = animationFrames): DeltaBuffer {
  let pending = '';
  let frame: number | null = null;

  const cancelFrame = () => {
    if (frame !== null) scheduler.cancel(frame);
    frame = null;
  };

  const flush = () => {
    cancelFrame();
    if (pending === '') return;
    const text = pending;
    pending = '';
    onFlush(text);
  };

  return {
    push(text) {
      pending += text;
      frame ??= scheduler.request(flush);
    },
    flush,
    cancel() {
      cancelFrame();
      pending = '';
    },
  };
}
