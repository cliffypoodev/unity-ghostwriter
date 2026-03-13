import { Component } from 'react';
import { healthMonitor } from './utils/appHealthMonitor';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorId: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    const errorId = healthMonitor.report({
      severity: 'fatal',
      category: 'ui',
      message: `React component crash: ${error.message}`,
      context: { componentStack: info.componentStack?.slice(0, 300) },
      raw: error,
    });
    this.setState({ errorId });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        padding: '32px 24px',
        margin: '20px',
        borderRadius: 12,
        border: '1.5px solid #fecaca',
        background: '#fef2f2',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⚠</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>
          Something went wrong
        </div>
        <div style={{ fontSize: 13, color: '#7f1d1d', marginBottom: 20 }}>
          This section crashed. Your project data is safe.
          Error logged for diagnosis.
        </div>
        <button
          onClick={() => this.setState({ hasError: false })}
          style={{
            padding: '8px 20px', borderRadius: 8,
            background: '#991b1b', color: '#fff',
            border: 'none', fontWeight: 700, cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Try Again
        </button>
      </div>
    );
  }
}