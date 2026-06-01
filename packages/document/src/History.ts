/**
 * Bounded linear undo/redo stack. Stores immutable states; `push` truncates any
 * redo branch, so editing after an undo discards the redone-but-now-stale future
 * (the conventional editor behaviour).
 */
export class History<T> {
  private states: T[] = [];
  private index = -1;

  constructor(private readonly limit = 50) {}

  /** Seed the initial state (clears any existing history). */
  reset(state: T): void {
    this.states = [state];
    this.index = 0;
  }

  push(state: T): void {
    this.states = this.states.slice(0, this.index + 1);
    this.states.push(state);
    if (this.states.length > this.limit) this.states.shift();
    this.index = this.states.length - 1;
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index < this.states.length - 1;
  }

  undo(): T | null {
    if (!this.canUndo) return null;
    this.index--;
    return this.states[this.index]!;
  }

  redo(): T | null {
    if (!this.canRedo) return null;
    this.index++;
    return this.states[this.index]!;
  }

  /** The currently active state, or null if empty. */
  get current(): T | null {
    return this.index >= 0 ? this.states[this.index]! : null;
  }

  /** Number of states retained. */
  get size(): number {
    return this.states.length;
  }
}
