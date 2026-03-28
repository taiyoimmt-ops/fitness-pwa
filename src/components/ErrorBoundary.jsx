import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', width: '100vw', padding: '20px', textAlign: 'center',
          backgroundColor: 'var(--bg)', color: 'var(--text-primary)'
        }}>
          <AlertTriangle size={64} color="var(--red)" style={{ marginBottom: 20 }} />
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>問題が発生しました</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '30px', maxWidth: '80%' }}>
            アプリの表示中に予期せぬエラーが起きました。通信状況を確認し、再読み込みをお試しください。
          </p>
          <button 
            onClick={this.handleReset}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw size={20} />
            アプリを再読み込み
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
