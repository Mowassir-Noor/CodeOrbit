import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import SplineBackground from './SplineBackground';
import HeroSection from './sections/HeroSection';
import TechStackSection from './sections/TechStackSection';
import FeaturesSection from './sections/FeaturesSection';
import ArchitectureSection from './sections/ArchitectureSection';
import CTASection from './sections/CTASection';
import LandingHeader from './LandingHeader';
import LandingFooter from './LandingFooter';
import './landing.css';

gsap.registerPlugin(ScrollTrigger);

function LandingPage() {
  const mainRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Smooth scroll for anchor links
    const handleAnchorClick = (e) => {
      const href = e.target.closest('a')?.getAttribute('href');
      if (href && href.startsWith('#')) {
        e.preventDefault();
        const el = document.querySelector(href);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };
    document.addEventListener('click', handleAnchorClick);

    return () => {
      document.removeEventListener('click', handleAnchorClick);
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <div className="landing-root" ref={mainRef}>
      <SplineBackground />
      <LandingHeader />
      <main className="landing-main">
        <HeroSection />
        <TechStackSection />
        <FeaturesSection />
        <ArchitectureSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
}

export default LandingPage;
