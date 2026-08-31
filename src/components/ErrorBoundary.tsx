import React, { ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  referenceId: string | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  props: Props;
  state: State = {
    hasError: false,
    referenceId: null,
  };

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(): State {
    return { hasError: true, referenceId: crypto.randomUUID() };
  }

  public componentDidCatch() {
    if (!this.state.referenceId) return;
    void supabase.functions.invoke('report-client-error', {
      body: {
        referenceId: this.state.referenceId,
        route: window.location.pathname,
        release: import.meta.env.VITE_APP_RELEASE,
      },
    }).catch(() => undefined);
  }

  private handleReload = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF7EA] flex items-center justify-center p-4 font-sans text-stone-800" role="alert">
          <div className="max-w-md w-full bg-white p-8 md:p-10 rounded-3xl border border-[#123524]/25 shadow-2xl text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100 shadow-sm">
              <AlertTriangle size={32} />
            </div>

            <div className="space-y-2">
              <span className="font-mono text-xs uppercase tracking-widest text-rose-600 font-bold block">
                Temporary Service Issue
              </span>
              <h2 className="text-2xl font-black text-[#1A3C2E]">
                Something went wrong
              </h2>
              <p className="text-xs text-stone-500 leading-relaxed">
                Please refresh and try again. If the issue continues, share this reference with the CCIS Student Council.
              </p>
            </div>

            <p className="bg-stone-50 border border-[#123524]/25 p-3 rounded-xl text-[11px] font-mono text-[#123524] break-all">
              Reference ID: {this.state.referenceId}
            </p>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={this.handleReload}
                className="w-full bg-[#1A3C2E] hover:bg-[#123524] text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors shadow-sm"
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
