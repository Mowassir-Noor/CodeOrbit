import React, { useEffect, useRef } from 'react';

function HeroSection() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const children = el.querySelectorAll('.hero-anim');
    children.forEach((child, i) => {
      child.style.opacity = '0';
      child.style.transform = 'translateY(30px)';
      setTimeout(() => {
        child.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        child.style.opacity = '1';
        child.style.transform = 'translateY(0)';
      }, 600 + i * 200);
    });
  }, []);

  return (
    <section id="hero" className="hero-section landing-section" ref={ref}>
      <div className="hero-content">
        {/* <div className="hero-badge hero-anim">
          <span className="dot" />
          Real-time Collaborative IDE
        </div> */}
        <h1 className="hero-title hero-anim">
          Code Together,<br />
          <span className="gradient-text">Ship Faster.</span>
        </h1>
        <p className="hero-subtitle hero-anim">
          CodeOrbit is a real-time collaborative browser IDE — write, share, and run 
          multi-language code with your team, right in the browser. Powered by Monaco 
          Editor, WebSockets, and WebContainers.
        </p>
        <div className="hero-buttons hero-anim">
          <a href="/register" className="btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Start Coding
          </a>
          <a href="https://github.com/Mowassir-Noor/CodeOrbit" target="_blank" rel="noopener noreferrer" className="btn-outline">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            View on GitHub
          </a>
        </div>
      </div>
      <div className="scroll-down">
        <div className="scroll-down-mouse" />
        SCROLL
      </div>
    </section>
  );
}

export default HeroSection;
