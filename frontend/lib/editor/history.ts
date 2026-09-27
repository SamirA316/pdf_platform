/**
 * QuickPDF Platform - PDF Editor History & Undo/Redo Engine
 * Phase 5.1 Foundation
 * 
 * Implements an immutable Command Pattern history stack.
 * Supports up to 50 reversible actions with automatic stack truncation.
 */

import { IEditorAction } from "@/types/editor";

export const MAX_HISTORY_STEPS = 50;

export class EditorHistoryManager {
  private past: IEditorAction[] = [];
  private future: IEditorAction[] = [];
  private onStateChange?: () => void;

  constructor(onStateChange?: () => void) {
    this.onStateChange = onStateChange;
  }

  /**
   * Pushes a new reversible action onto the undo stack and clears redo history.
   */
  public push(action: IEditorAction): void {
    this.past.push(action);
    if (this.past.length > MAX_HISTORY_STEPS) {
      this.past.shift(); // Drop oldest action to prevent memory leak
    }
    this.future = []; // Clear redo chain on new user action
    this.notify();
  }

  /**
   * Undoes the most recent action.
   */
  public undo(): boolean {
    const action = this.past.pop();
    if (!action) return false;

    try {
      action.undo();
      this.future.push(action);
      this.notify();
      return true;
    } catch (err) {
      console.error(`[HistoryManager] Failed to undo action ${action.type}:`, err);
      return false;
    }
  }

  /**
   * Redoes the most recently undone action.
   */
  public redo(): boolean {
    const action = this.future.pop();
    if (!action) return false;

    try {
      action.redo();
      this.past.push(action);
      this.notify();
      return true;
    } catch (err) {
      console.error(`[HistoryManager] Failed to redo action ${action.type}:`, err);
      return false;
    }
  }

  public canUndo(): boolean {
    return this.past.length > 0;
  }

  public canRedo(): boolean {
    return this.future.length > 0;
  }

  public clear(): void {
    this.past = [];
    this.future = [];
    this.notify();
  }

  public getStackSize(): { past: number; future: number } {
    return {
      past: this.past.length,
      future: this.future.length,
    };
  }

  private notify(): void {
    if (this.onStateChange) {
      this.onStateChange();
    }
  }
}
