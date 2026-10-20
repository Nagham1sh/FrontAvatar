import { Component } from 'react';
import type { ReactNode } from 'react';

type ErrorBoundaryProps = {
  title: string;
  children: ReactNode;
};

/**
 * Contains a crash (e.g. a 3D model that cannot be fetched) to one area of
 * the page instead of unmounting the whole app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app-error" dir="rtl" role="alert">
        <h2>{this.props.title}</h2>
        <p dir="auto">{this.state.error.message}</p>
        <button type="button" onClick={() => this.setState({ error: null })}>
          إعادة المحاولة
        </button>
      </div>
    );
  }
}
