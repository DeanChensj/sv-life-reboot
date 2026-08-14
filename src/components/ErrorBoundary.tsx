import { Component, type ErrorInfo, type ReactNode } from 'react';
import { safeStorage } from '../utils/safeStorage';
import { STORAGE_KEYS } from '../constants/gameConstants';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('💥 [Uncaught Game UI Error Caught by ErrorBoundary]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleResetGame = () => {
    try {
      safeStorage.removeItem(STORAGE_KEYS.GAME_SAVE);
      safeStorage.removeItem(STORAGE_KEYS.GAME_SAVE_BACKUP);
      safeStorage.removeItem(STORAGE_KEYS.INITIAL_SEED);
      safeStorage.removeItem(STORAGE_KEYS.WELCOME_SEEN);
    } catch {
      // Ignore cleanup error
    }
    window.location.reload();
  };

  private handleExportDebugData = () => {
    try {
      const currentSave = safeStorage.getItem(STORAGE_KEYS.GAME_SAVE);
      const debugPayload = {
        timestamp: new Date().toISOString(),
        error: this.state.error?.message,
        stack: this.state.error?.stack,
        componentStack: this.state.errorInfo?.componentStack,
        saveData: currentSave ? JSON.parse(currentSave) : null,
      };
      const blob = new Blob([JSON.stringify(debugPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sv_reboot_crash_dump_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('导出数据失败：' + String(e));
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 font-mono">
          <div className="max-w-xl w-full bg-zinc-900 border border-red-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-red-500/10 flex flex-col gap-5">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 font-bold text-xl">
                !
              </div>
              <div>
                <h1 className="text-lg font-bold text-red-400">
                  {this.props.fallbackTitle || '程序异常拦截 (Kernel Panic)'}
                </h1>
                <p className="text-xs text-zinc-400">
                  前端发生未捕获的渲染异常，已自动保护存档并拦截白屏死锁
                </p>
              </div>
            </div>

            <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 text-xs overflow-x-auto max-h-48 text-zinc-300">
              <p className="text-red-400 font-semibold mb-1">
                {this.state.error?.toString() || '未知渲染错误'}
              </p>
              {this.state.error?.stack && (
                <pre className="text-[10px] text-zinc-400 leading-relaxed overflow-x-auto">
                  {this.state.error.stack}
                </pre>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleResetGame}
                className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-lg shadow-red-500/20 active:scale-[0.98]"
              >
                清除坏档并重新开始
              </button>
              <button
                type="button"
                onClick={this.handleExportDebugData}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium py-3 px-4 rounded-xl text-sm transition-all border border-zinc-700 active:scale-[0.98]"
              >
                导出诊断数据 (JSON)
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium py-3 px-4 rounded-xl text-sm transition-all border border-zinc-700 active:scale-[0.98]"
              >
                刷新重试
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
