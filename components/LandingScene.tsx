export default function LandingScene() {
  return (
    <div className="landing-scene" aria-hidden>
      <div className="landing-scene-sky" />
      <div className="landing-scene-mural" />
      <div className="landing-scene-floor" />
      <div className="landing-scene-tapestry landing-scene-tapestry-left" />
      <div className="landing-scene-tapestry landing-scene-tapestry-right" />
      <div className="landing-scene-pillar landing-scene-pillar-left" />
      <div className="landing-scene-pillar landing-scene-pillar-right" />
      <div className="landing-scene-beam landing-scene-beam-top" />
      <div className="landing-scene-torch landing-scene-torch-left">
        <span className="landing-scene-torch-bracket" />
        <span className="landing-scene-torch-flame" />
        <span className="landing-scene-torch-glow" />
      </div>
      <div className="landing-scene-torch landing-scene-torch-right">
        <span className="landing-scene-torch-bracket" />
        <span className="landing-scene-torch-flame" />
        <span className="landing-scene-torch-glow" />
      </div>
      <div className="landing-scene-bunting">
        <span /><span /><span /><span /><span /><span /><span />
      </div>
    </div>
  );
}