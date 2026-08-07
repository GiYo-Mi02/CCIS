import React, { ErrorInfo, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  props: Props;
  state: State = {
    hasError: false,
    error: null,
  };

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[CCIS ErrorBoundary] Caught runtime exception:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF7EA] flex items-center justify-center p-4 font-sans text-stone-800">
          <div className="max-w-md w-full bg-white p-8 md:p-10 rounded-3xl border border-rose-200 shadow-2xl text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100 shadow-sm">
              <AlertTriangle size={32} />
            </div>

            <div className="space-y-2">
              <span className="font-mono text-xs uppercase tracking-widest text-rose-600 font-bold block">
                System Runtime Exception
              </span>
              <h2 className="text-2xl font-black text-[#1A3C2E]">
                Something went wrong
              </h2>
              <p className="text-xs text-stone-500 leading-relaxed">
                An unexpected system error occurred while rendering this module. Your data remains safe.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-stone-50 border border-stone-200 p-3 rounded-xl text-left overflow-x-auto max-h-32">
                <code className="text-[11px] font-mono text-rose-800 break-all">
                  {this.state.error.message}
                </code>
              </div>
            )}

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={this.handleReload}
                className="w-full bg-[#1A3C2E] hover:bg-[#123524] text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <RefreshCw size={14} /> Refresh &amp; Return Home
              </button>
            </div>

            <div className="text-[10px] text-stone-400 font-mono">
              CCIS Student Council System • Resilient Recovery Active
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
