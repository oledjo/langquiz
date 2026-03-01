import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  title?: string
}

interface State {
  hasError: boolean
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI boundary caught an error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-red-800">{this.props.title ?? 'Something went wrong'}</h2>
          <p className="mt-2 text-sm text-red-700">
            This section crashed. Refresh the page to retry. If the problem persists, check the latest deploy.
          </p>
        </div>
      )
    }

    return this.props.children
  }
}
