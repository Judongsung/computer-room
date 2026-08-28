import { Component, Suspense } from "react";
import { MobileActivity } from "@client/components/mobile/shared/mobile-activity";
import { MOBILE_CLASS_NAME, MOBILE_COPY } from "@client/constants/shared/mobile";
import type {
  LazyFeatureBoundaryProps,
  LazyFeatureBoundaryState,
} from "@client/types/shared/lazy-feature";

export class MobileLazyFeatureBoundary extends Component<
  LazyFeatureBoundaryProps,
  LazyFeatureBoundaryState
> {
  state: LazyFeatureBoundaryState = { failed: false };

  static getDerivedStateFromError(): LazyFeatureBoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <MobileLazyFeatureStatus title={this.props.title} failed />;
    }
    return (
      <Suspense fallback={<MobileLazyFeatureStatus title={this.props.title} />}>
        {this.props.children}
      </Suspense>
    );
  }
}

function MobileLazyFeatureStatus({
  title,
  failed = false,
}: {
  readonly title: string;
  readonly failed?: boolean;
}) {
  return (
    <MobileActivity title={title}>
      <p
        className={failed ? MOBILE_CLASS_NAME.ERROR : MOBILE_CLASS_NAME.MESSAGE}
        role={failed ? "alert" : "status"}
      >
        {failed ? MOBILE_COPY.LOAD_FAILED : MOBILE_COPY.LOADING}
      </p>
      {failed ? (
        <button type="button" onClick={() => window.location.reload()}>
          {MOBILE_COPY.RETRY}
        </button>
      ) : null}
    </MobileActivity>
  );
}
