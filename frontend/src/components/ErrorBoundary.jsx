import { Component } from 'react'

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
        <div className="max-w-2xl mx-auto my-16 nv-panel p-8 border border-unsafe/30 text-center space-y-4 relative font-sans">
          <div className="corner-square" />
          <h2 className="text-lg font-bold text-unsafe uppercase tracking-wider">Something went wrong</h2>
          <p className="text-xs text-mute uppercase tracking-wider">
            The interface hit an unexpected error while rendering. Your code was not lost.
          </p>
          <pre className="text-left text-xs text-mute bg-black rounded-sm p-3 overflow-auto max-h-40 font-mono">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button className="btn-primary" onClick={this.reset}>Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}
