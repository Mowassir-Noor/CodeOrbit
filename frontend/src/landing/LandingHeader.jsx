import React, { useEffect, useState } from 'react';

function LandingHeader() {
  const [hidden, setHidden] = useState(false);
  const [lastY, setLastY] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > 100 && y > lastY);
      setLastY(y);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  });

  return (
    <header className={`landing-header ${hidden ? 'hidden' : ''}`}>
      <a href="#hero" className="header-logo">
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="16" cy="16" r="14" stroke="url(#lg)" strokeWidth="2.5" fill="none"/>
          <path d="M10 16 L14 12 L14 20 Z" fill="#6c63ff"/>
          <path d="M17 12 L21 16 L17 20" stroke="#00d9ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <defs><linearGradient id="lg" x1="0" y1="0" x2="32" y2="32">
            <stop stopColor="#6c63ff"/><stop offset="1" stopColor="#00d9ff"/>
          </linearGradient></defs>
        </svg>
        CodeOrbit
      </a>
      <nav className="header-nav">
        <a href="#techstack">Tech Stack</a>
        <a href="#features">Features</a>
        <a href="#architecture">Architecture</a>
      </nav>
      <a href="/login" className="header-cta">Get Started →</a>
    </header>
  );
}

export default LandingHeader;
