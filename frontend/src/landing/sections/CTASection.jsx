import React, { useEffect, useRef } from 'react';

function CTASection() {
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.1 }
    );
    const els = ref.current?.querySelectorAll('.reveal');
    els?.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="cta" className="landing-section cta-section" ref={ref}>
      <div className="cta-card reveal">
        <h2>Ready to Code<br /><span className="gradient-text">Together?</span></h2>
        <p>
          Create a room, share the link, and start building with your team in seconds. 
          No setup required — just open your browser and go.
        </p>
        <div className="hero-buttons" style={{ justifyContent: 'center' }}>
          <a href="/register" className="btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            Create Free Account
          </a>
          <a href="https://github.com/Mowassir-Noor/CodeOrbit" target="_blank" rel="noopener noreferrer" className="btn-outline">
            Star on GitHub ⭐
          </a>
        </div>
      </div>
    </section>
  );
}

export default CTASection;
