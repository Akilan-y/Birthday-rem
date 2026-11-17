import React from 'react';
import {AlertTriangle, RefreshCw} from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  {children: React.ReactNode},
  ErrorBoundaryState
> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false, message: ''};
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#111822] text-slate-100">
          <div className="max-w-md w-full rounded-2xl border border-white/[0.1] bg-[#19222F] p-6">
            <div className="flex items-center gap-3 text-amber-300">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h1 className="text-base font-semibold text-white">
                Unable to complete database request
              </h1>
            </div>
            <p className="mt-3 text-xs text-slate-300 leading-relaxed break-words font-mono bg-white/[0.04] p-3 rounded-xl border border-white/[0.06] max-h-40 overflow-auto">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D8FE1] hover:bg-[#197CC6] text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
