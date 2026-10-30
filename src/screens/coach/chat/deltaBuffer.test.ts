import { createDeltaBuffer, type FrameScheduler } from './deltaBuffer.ts';

function manualFrames() {
  const callbacks = new Map<number, () => void>();
  let nextHandle = 1;
  const scheduler: FrameScheduler = {
    request: (callback) => {
      const handle = nextHandle++;
      callbacks.set(handle, callback);
      return handle;
    },
    cancel: (handle) => {
      callbacks.delete(handle);
    },
  };
  const runFrame = () => {
    const due = [...callbacks.values()];
    callbacks.clear();
    due.forEach((callback) => callback());
  };
  return { scheduler, runFrame, scheduled: () => callbacks.size };
}

describe('createDeltaBuffer', () => {
  it('hands over the pieces of one frame together', () => {
    const frames = manualFrames();
    const flushed: string[] = [];
    const buffer = createDeltaBuffer((text) => flushed.push(text), frames.scheduler);

    buffer.push('About ');
    buffer.push('323 ');
    buffer.push('₾');
    expect(flushed).toEqual([]);
    expect(frames.scheduled()).toBe(1);

    frames.runFrame();
    expect(flushed).toEqual(['About 323 ₾']);
  });

  it('schedules a new frame for pieces that arrive later', () => {
    const frames = manualFrames();
    const flushed: string[] = [];
    const buffer = createDeltaBuffer((text) => flushed.push(text), frames.scheduler);

    buffer.push('One');
    frames.runFrame();
    buffer.push('Two');
    frames.runFrame();
    expect(flushed).toEqual(['One', 'Two']);
  });

  it('hands over at once on flush and cancels the frame', () => {
    const frames = manualFrames();
    const flushed: string[] = [];
    const buffer = createDeltaBuffer((text) => flushed.push(text), frames.scheduler);

    buffer.push('Last words');
    buffer.flush();
    expect(flushed).toEqual(['Last words']);
    expect(frames.scheduled()).toBe(0);

    buffer.flush();
    expect(flushed).toEqual(['Last words']);
  });

  it('forgets waiting pieces on cancel', () => {
    const frames = manualFrames();
    const flushed: string[] = [];
    const buffer = createDeltaBuffer((text) => flushed.push(text), frames.scheduler);

    buffer.push('Never shown');
    buffer.cancel();
    frames.runFrame();
    buffer.flush();
    expect(flushed).toEqual([]);
  });
});
