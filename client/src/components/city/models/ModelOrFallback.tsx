import { Component, Suspense, type ReactNode } from 'react';

/**
 * Renders `children` (a glTF model) but falls back to `fallback` (procedural
 * geometry) if the model fails to load — so dropping in real assets is safe and
 * incremental: anything missing just uses the built-in shape.
 */
class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    // Swallow — the fallback covers it.
  }
  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

export function ModelOrFallback({
  fallback,
  children,
}: {
  fallback: ReactNode;
  children: ReactNode;
}) {
  return (
    <Boundary fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </Boundary>
  );
}

export default ModelOrFallback;
