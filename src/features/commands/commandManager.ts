/**
 * STAAD.Pro Style Command & Transaction Architecture
 * Manages model modifications via executable, undoable, and redoable commands.
 * Strictly separates UI actions from domain model transactions.
 */

export interface StructuralCommand {
  readonly id: string;
  readonly description: string;
  readonly timestamp: number;
  execute(): Promise<void> | void;
  undo(): Promise<void> | void;
  redo(): Promise<void> | void;
}

export type CommandHistoryListener = (state: {
  canUndo: boolean;
  canRedo: boolean;
  lastCommandDescription?: string;
  undoStackLength: number;
  redoStackLength: number;
}) => void;

export class CommandManager {
  private static instance: CommandManager | null = null;
  private undoStack: StructuralCommand[] = [];
  private redoStack: StructuralCommand[] = [];
  private maxHistory: number = 15;
  private listeners: Set<CommandHistoryListener> = new Set();
  private isExecuting: boolean = false;

  private constructor() {}

  public static getInstance(): CommandManager {
    if (!CommandManager.instance) {
      CommandManager.instance = new CommandManager();
    }
    return CommandManager.instance;
  }

  /**
   * Clears singleton instance (primarily for isolated test suites)
   */
  public static resetInstance(): void {
    if (CommandManager.instance) {
      CommandManager.instance.clear();
      CommandManager.instance = null;
    }
  }

  /**
   * Executes a command and pushes it onto the undo stack.
   * Clears the redo stack upon new command execution.
   */
  public async execute(command: StructuralCommand): Promise<void> {
    if (this.isExecuting) {
      throw new Error(`Nested command execution detected for command: ${command.description}`);
    }

    this.isExecuting = true;
    try {
      await command.execute();
      this.undoStack.push(command);
      if (this.undoStack.length > this.maxHistory) {
        this.undoStack.shift();
      }
      this.redoStack = [];
      this.notifyListeners();
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Undoes the most recent command
   */
  public async undo(): Promise<boolean> {
    if (this.undoStack.length === 0 || this.isExecuting) return false;

    const command = this.undoStack.pop()!;
    this.isExecuting = true;
    try {
      await command.undo();
      this.redoStack.push(command);
      this.notifyListeners();
      return true;
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Redoes the most recently undone command
   */
  public async redo(): Promise<boolean> {
    if (this.redoStack.length === 0 || this.isExecuting) return false;

    const command = this.redoStack.pop()!;
    this.isExecuting = true;
    try {
      await command.redo();
      this.undoStack.push(command);
      this.notifyListeners();
      return true;
    } finally {
      this.isExecuting = false;
    }
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public getUndoHistoryDescriptions(): string[] {
    return this.undoStack.map((cmd) => cmd.description);
  }

  public getRedoHistoryDescriptions(): string[] {
    return this.redoStack.map((cmd) => cmd.description);
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyListeners();
  }

  public subscribe(listener: CommandHistoryListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private getState() {
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      lastCommandDescription: this.undoStack.length > 0 ? this.undoStack[this.undoStack.length - 1].description : undefined,
      undoStackLength: this.undoStack.length,
      redoStackLength: this.redoStack.length,
    };
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('Error in command history listener:', err);
      }
    });
  }
}
