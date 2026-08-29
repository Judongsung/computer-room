import { LAZY_FEATURE_LABEL } from "@client/content/ko/shared/lazy-feature";
import { Component, Suspense } from "react";
import { LAZY_FEATURE_CLASS_NAME } from "@client/constants/shared/lazy-feature";
import { XpWindowFrame } from "@client/components/desktop/xp-window-frame";
import type {
  LazyFeatureBoundaryProps,
  LazyFeatureBoundaryState,
} from "@client/types/shared/lazy-feature";

export class LazyFeatureBoundary extends Component<
  LazyFeatureBoundaryProps,
  LazyFeatureBoundaryState
> {
  state: LazyFeatureBoundaryState = { failed: false };

  static getDerivedStateFromError(): LazyFeatureBoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <LazyFeatureStatus title={this.props.title} failed />
      );
    }
    return (
      <Suspense fallback={<LazyFeatureStatus title={this.props.title} />}>
        {this.props.children}
      </Suspense>
    );
  }
}

function LazyFeatureStatus({
  title,
  failed = false,
}: {
  readonly title: string;
  readonly failed?: boolean;
}) {
  return (
    <div className={LAZY_FEATURE_CLASS_NAME.CONTAINER} role="status">
      <XpWindowFrame title={title}>
        <p className={LAZY_FEATURE_CLASS_NAME.MESSAGE}>
          {failed ? LAZY_FEATURE_LABEL.LOAD_FAILED : LAZY_FEATURE_LABEL.LOADING}
        </p>
        {failed ? (
          <button type="button" onClick={() => window.location.reload()}>
            {LAZY_FEATURE_LABEL.RELOAD}
          </button>
        ) : null}
      </XpWindowFrame>
    </div>
  );
}
