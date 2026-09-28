import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100%', padding: '2rem', textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '14px',
            background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem',
          }}>
            <AlertTriangle size={24} color="#f43f5e" />
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#e2eaf4', marginBottom: '0.5rem' }}>
            {this.props.fallbackTitle || 'Something went wrong'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#6b8099', marginBottom: '1.25rem', maxWidth: '320px', lineHeight: 1.6 }}>
            {this.state.error?.message || 'An unexpected error occurred in this section.'}
          </div>
          <button
            className="btn-secondary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            <RefreshCw size={14} />
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
