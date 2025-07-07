import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import './RewardAnimation.css';

const animations = ['confetti', 'fireworks', 'starShower', 'emojiRain', 'ribbons'];

function RewardAnimation({ startAnimation }) {
  const [animationKey, setAnimationKey] = useState(null);

  useEffect(() => {
    if (startAnimation) {
      const random = animations[Math.floor(Math.random() * animations.length)];
      setAnimationKey(random);

      runAnimation(random);

      const timeout = setTimeout(() => setAnimationKey(null), 3000);
      return () => clearTimeout(timeout);
    }
  }, [startAnimation]);

  const runAnimation = (type) => {
    if (type === 'confetti') {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
      });
    } else if (type === 'fireworks') {
      let duration = 3 * 1000;
      let end = Date.now() + duration;
      (function frame() {
        confetti({
          particleCount: 4,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 4,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
        });
        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();
    } else if (type === 'starShower') {
      for (let i = 0; i < 5; i++) {
        confetti({
          particleCount: 30,
          spread: 360,
          startVelocity: 30,
          shapes: ['star'],
          scalar: 1.2,
          origin: {
            x: Math.random(),
            y: Math.random() * 0.5,
          },
        });
      }
    } else if (type === 'emojiRain') {
      for (let i = 0; i < 30; i++) {
        confetti({
          particleCount: 1,
          spread: 360,
          scalar: 2,
          shapes: ['🥳', '🎉', '✨'],
          origin: {
            x: Math.random(),
            y: -0.2,
          },
        });
      }
    } else if (type === 'ribbons') {
      confetti({
        particleCount: 100,
        spread: 70,
        ticks: 200,
        shapes: ['square'],
        colors: ['#bb0000', '#ffffff'],
      });
    }
  };

  if (!animationKey) return null;

  return <div className="reward-container"></div>;
}

export default RewardAnimation;
