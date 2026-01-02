/**
 * Error Boundary Component
 * 
 * Catches JavaScript errors in child component tree and displays
 * a fallback UI instead of crashing the entire app.
 * 
 * Usage:
 * <ErrorBoundary name="Dashboard">
 *   <DashboardTab />
 * </ErrorBoundary>
 */

import * as React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface ErrorBoundaryProps {
    /** Name of the section being wrapped (for error reporting) */
    name: string;
    /** Child components to render */
    children: React.ReactNode;
    /** Optional custom fallback UI */
    fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary using React Class Component
 * (Required since React doesn't support error boundaries with hooks)
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    // Use 'declare' to tell TypeScript that state/props exist from the parent class
    // This fixes TS2339 errors with ES2022 target + useDefineForClassFields: false
    declare readonly props: Readonly<ErrorBoundaryProps>;
    declare state: ErrorBoundaryState;
    declare setState: React.Component<ErrorBoundaryProps, ErrorBoundaryState>['setState'];

    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
        };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        console.error(`[ErrorBoundary:${this.props.name}] Caught error:`, error);
        console.error('Component stack:', errorInfo.componentStack);
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null });
    };

    handleReload = (): void => {
        window.location.reload();
    };

    render(): React.ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center p-8 h-full min-h-[200px] bg-red-50 dark:bg-red-900/10 rounded-2xl">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                        <h2 className="text-xl font-bold text-red-700 dark:text-red-400">
                            Something went wrong
                        </h2>
                    </div>

                    <p className="text-sm text-red-600 dark:text-red-300 mb-2 text-center">
                        An error occurred in the <strong>{this.props.name}</strong> section.
                    </p>

                    {this.state.error && (
                        <p className="text-xs text-red-500 dark:text-red-400 mb-4 font-mono bg-red-100 dark:bg-red-900/20 px-3 py-1 rounded max-w-full overflow-hidden text-ellipsis">
                            {this.state.error.message}
                        </p>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={this.handleRetry}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                        >
                            <RefreshCcw size={16} />
                            Try Again
                        </button>

                        <button
                            onClick={this.handleReload}
                            className="px-4 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg text-sm font-medium hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                        >
                            Reload App
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
