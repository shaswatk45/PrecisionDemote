import { Component } from 'react'

// Catches render-time crashes in the analysis views (e.g. a malformed report)
// so one bad payload doesn't blank the whole app with a white screen.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('UI error boundary caught:', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div className="max-w-2xl mx-auto my-16 glass p-8 border border-unsafe/30 text-center space-y-4">
          <h2 className="text-xl font-bold text-unsafe">Something went wrong</h2>
          <p className="text-sm text-gray-400">
            The interface hit an unexpected error while rendering. Your code was not lost.
          </p>
          <pre className="text-left text-xs text-gray-500 bg-black/40 rounded-lg p-3 overflow-auto max-h-40">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button className="btn-primary" onClick={this.reset}>Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}
