import { Component } from 'react';
import ErrorPage from '../pages/ErrorPage';

export default class AppErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <ErrorPage code="Oops" title="This page hit a problem."
      message="Your recorded answers and score are saved. Reload the page to reconnect with your team’s latest progress. If this keeps happening, contact an organizer."
      onRetry={() => window.location.reload()} />;
    return this.props.children;
  }
}
