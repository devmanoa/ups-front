import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Capture les erreurs de rendu des pages pour éviter un écran blanc.
 * Ne couvre pas le chargement des remotes : voir RemoteErrorBoundary.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-red-800">
          <AlertTriangle className="h-4 w-4" />
          Une erreur est survenue
        </div>
        <p className="mt-1 text-[13px] text-red-700">{error.message}</p>
        <button
          className="mt-3 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-[13px] font-medium text-red-700 hover:bg-red-50"
          onClick={() => this.setState({ error: null })}
        >
          Réessayer
        </button>
      </div>
    );
  }
}
