/**
 * CinematicLoader — Clean, professional intro animation
 *
 * Just the Vision logo fading in on a navy gradient, a subtle gold
 * line drawing underneath, then the whole thing slides up to reveal
 * the site. No grid, no corner markers, no scan line — just elegance.
 *
 * Duration: ~1.8s (fast enough to not annoy, slow enough to feel premium)
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function CinematicLoader({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'logo' | 'exit' | 'done'>('logo');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('exit'), 1400);
    const t2 = setTimeout(() => { setPhase('done'); onComplete(); }, 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          key="loader"
          initial={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '-100%' }}
          transition={{ duration: 0.6, ease: [0.76, 0, 0.24, 1] }}
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: 'linear-gradient(145deg, #0F2341 0%, #1B3A6B 50%, #0F2341 100%)' }}
        >
          {/* Subtle radial glow behind logo */}
          <div
            className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(232,168,56,0.08) 0%, transparent 70%)',
            }}
          />

          {/* Logo + line */}
          <div className="relative z-10 flex flex-col items-center">
            <motion.img
              src="https://visionaffichage.com/cdn/shop/files/Logo-vision-horizontal-blanc.png?height=135&v=1694121209"
              alt="Vision Affichage"
              className="h-10 md:h-12"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Gold accent line */}
            <motion.div
              className="h-[1.5px] mt-4 rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, hsl(40, 82%, 45%), transparent)' }}
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 120, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
