import React from 'react';

function LandingFooter() {
  return (
    <footer className="landing-footer">
      <p>© {new Date().getFullYear()} CodeOrbit. Open Source under MIT.</p>
      <div className="footer-links">
        <a href="https://github.com/Mowassir-Noor/CodeOrbit" target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="#features">Features</a>
        <a href="#architecture">Architecture</a>
        <a href="/login">Login</a>
      </div>
    </footer>
  );
}

export default LandingFooter;
