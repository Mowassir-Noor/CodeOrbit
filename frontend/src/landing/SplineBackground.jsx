import React, { Suspense, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const Spline = React.lazy(() => import('@splinetool/react-spline'));

const SECTIONS = {
  hero: {
    scale: { x: 0.20, y: 0.20, z: 0.20 },
    position: { x: 225, y: -100, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  },
  techstack: {
    scale: { x: 0.25, y: 0.25, z: 0.25 },
    position: { x: 0, y: -40, z: 0 },
    rotation: { x: 0, y: Math.PI / 12, z: 0 },
  },
  features: {
    scale: { x: 0.25, y: 0.25, z: 0.25 },
    position: { x: 0, y: -40, z: 0 },
    rotation: { x: Math.PI, y: Math.PI / 3, z: Math.PI },
  },
  cta: {
    scale: { x: 0.2, y: 0.2, z: 0.2 },
    position: { x: 350, y: -250, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  },
};

function getScaleOffset() {
  const width = window.innerWidth;
  const isMobile = width < 768;
  const ref = isMobile ? 390 : 1280;
  const s = width / ref;
  return Math.min(Math.max(s, 0.5), 1.15);
}

function getState(section) {
  const base = SECTIONS[section] || SECTIONS.hero;
  const offset = getScaleOffset();
  return {
    ...base,
    scale: {
      x: Math.abs(base.scale.x * offset),
      y: Math.abs(base.scale.y * offset),
      z: Math.abs(base.scale.z * offset),
    },
  };
}

function SplineBackground() {
  const [app, setApp] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!app) return;

    const kbd = app.findObjectByName('keyboard');
    if (!kbd) return;

    // Set initial hero state
    const heroState = getState('hero');
    gsap.set(kbd.scale, heroState.scale);
    gsap.set(kbd.position, heroState.position);

    // Reveal animation – keyboard body + keycaps
    kbd.visible = false;
    setTimeout(() => {
      kbd.visible = true;
      gsap.fromTo(kbd.scale,
        { x: 0.01, y: 0.01, z: 0.01 },
        { ...heroState.scale, duration: 1.5, ease: 'elastic.out(1, 0.6)' }
      );

      // After the keyboard body scales in, reveal the individual keycaps
      const allObjects = app.getAllObjects();
      const isMobile = window.innerWidth < 768;

      setTimeout(() => {
        // Show platform-specific keycap variants
        if (isMobile) {
          const mobileKeyCaps = allObjects.filter(obj => obj.name === 'keycap-mobile');
          mobileKeyCaps.forEach(keycap => { keycap.visible = true; });
        } else {
          const desktopKeyCaps = allObjects.filter(obj => obj.name === 'keycap-desktop');
          desktopKeyCaps.forEach((keycap, idx) => {
            setTimeout(() => { keycap.visible = true; }, idx * 70);
          });
        }

        // Bounce-in the generic keycaps with staggered delay
        const keycaps = allObjects.filter(obj => obj.name === 'keycap');
        keycaps.forEach((keycap, idx) => {
          keycap.visible = false;
          setTimeout(() => {
            keycap.visible = true;
            gsap.fromTo(
              keycap.position,
              { y: 200 },
              { y: 50, duration: 0.5, delay: 0.1, ease: 'bounce.out' }
            );
          }, idx * 70);
        });
      }, 900);
    }, 300);

    // Hero rotation
    const rotateAnim = gsap.to(kbd.rotation, {
      y: Math.PI * 2 + kbd.rotation.y,
      duration: 10,
      repeat: -1,
      yoyo: true,
      yoyoEase: true,
      ease: 'back.inOut',
      delay: 2.5,
    });

    // Section transitions
    const createTransition = (trigger, to, from, start = 'top 50%') => {
      gsap.timeline({
        scrollTrigger: {
          trigger,
          start,
          end: 'bottom bottom',
          scrub: true,
          onEnter: () => {
            const s = getState(to);
            gsap.to(kbd.scale, { ...s.scale, duration: 1 });
            gsap.to(kbd.position, { ...s.position, duration: 1 });
            gsap.to(kbd.rotation, { ...s.rotation, duration: 1 });
            if (to === 'hero') rotateAnim.play();
            else rotateAnim.pause();
          },
          onLeaveBack: () => {
            const s = getState(from);
            gsap.to(kbd.scale, { ...s.scale, duration: 1 });
            gsap.to(kbd.position, { ...s.position, duration: 1 });
            gsap.to(kbd.rotation, { ...s.rotation, duration: 1 });
            if (from === 'hero') rotateAnim.play();
            else rotateAnim.pause();
          },
        },
      });
    };

    createTransition('#techstack', 'techstack', 'hero');
    createTransition('#features', 'features', 'techstack', 'top 70%');
    createTransition('#cta', 'cta', 'features', 'top 30%');

    return () => {
      rotateAnim.kill();
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, [app]);

  return (
    <>
      {!loaded && (
        <div className="spline-loading">
          <div className="spline-loading-spinner" />
          <p>Loading 3D Scene...</p>
        </div>
      )}
      <Suspense fallback={null}>
        <Spline
          className="spline-bg"
          ref={containerRef}
          onLoad={(splineApp) => {
            setApp(splineApp);
            setTimeout(() => setLoaded(true), 600);
          }}
          scene="/assets/skills-keyboard.spline"
        />
      </Suspense>
    </>
  );
}

export default SplineBackground;
