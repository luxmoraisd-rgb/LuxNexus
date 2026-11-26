import "./LoadingScreen.css";

export default function LoadingScreen({ message = "Loading your workspace..." }) {
  return (
    <div className="nexus-loading-screen" role="status" aria-live="polite" aria-busy="true">
      <div className="nexus-loading-content">
        <div className="nexus-loading-mark" aria-hidden="true">
          <div className="nexus-loading-halo" />
          <div className="nexus-loading-ring" />
          <div className="nexus-loading-orbit">
            <span />
          </div>
          <div className="nexus-loading-core">N</div>
        </div>
        <div className="nexus-loading-brand">LuxNexus</div>
        <p className="nexus-loading-message">{message}</p>
        <div className="nexus-loading-progress" aria-hidden="true">
          <span />
        </div>
        <div className="nexus-loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
