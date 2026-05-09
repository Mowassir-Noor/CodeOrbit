import React, { useEffect, useRef } from 'react';

function ArchitectureSection() {
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
    <section id="architecture" className="landing-section" ref={ref}>
      <div className="section-header reveal">
        <p className="section-tag">Architecture</p>
        <h2 className="section-title">How It Works</h2>
        <p className="section-desc">
          A modern, event-driven architecture connecting browser-based editors 
          with real-time collaboration infrastructure.
        </p>
      </div>
      <div className="arch-container reveal">
        <div className="arch-diagram">
{`  Browser (`}<span className="highlight">React IDE</span>{`)
    │
    ├── `}<span className="highlight2">WebContainer API</span>{` ──► in-browser Node.js runtime
    │
    ├── `}<span className="highlight">HTTP + JWT</span>{` ────────► Spring Boot REST API ──► PostgreSQL
    │
    └── `}<span className="highlight2">STOMP/SockJS</span>{` ──────► Spring WebSocket Broker
                              ├── /topic/code/{roomId}  (editor sync)
                              └── /topic/fs/{roomId}    (filesystem events)`}
        </div>
        <div className="arch-badges">
          <span className="arch-badge">
            <span className="badge-dot" style={{ background: '#6c63ff' }} />
            REST API
          </span>
          <span className="arch-badge">
            <span className="badge-dot" style={{ background: '#00d9ff' }} />
            WebSockets
          </span>
          <span className="arch-badge">
            <span className="badge-dot" style={{ background: '#4ade80' }} />
            WebContainers
          </span>
          <span className="arch-badge">
            <span className="badge-dot" style={{ background: '#f59e0b' }} />
            JWT Auth
          </span>
          <span className="arch-badge">
            <span className="badge-dot" style={{ background: '#ef4444' }} />
            STOMP Protocol
          </span>
        </div>
      </div>
    </section>
  );
}

export default ArchitectureSection;
