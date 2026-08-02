import { AnimatePresence, motion } from 'framer-motion'

export interface FlyingAnimationsProps {
  leftCollapsed: boolean
  libraryIsFlying: boolean
  libraryFlyingTitle: string
  isFlyingStatus: boolean
  isFlyingSummary: boolean
  isFlyingDraft: boolean
}

/** Shared fly-to-target overlays extracted from App.tsx (SoC Phase 1). */
export function FlyingAnimations({
  leftCollapsed,
  libraryIsFlying,
  libraryFlyingTitle,
  isFlyingStatus,
  isFlyingSummary,
  isFlyingDraft,
}: FlyingAnimationsProps) {
  return (
    <>
      <AnimatePresence>
        {libraryIsFlying && (
          <motion.div
            initial={{
              x: window.innerWidth * 0.6,
              y: window.innerHeight * 0.5,
              scale: 1,
              opacity: 1,
            }}
            animate={{
              x: leftCollapsed ? window.innerWidth * 0.08 : window.innerWidth * 0.18,
              y: window.innerHeight - 80,
              scale: 0.6,
              opacity: 0.8,
            }}
            exit={{ scale: 0.3, opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="fixed z-50 pointer-events-none"
          >
            <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-2xl border-2 border-blue-300 flex items-center gap-2">
              <span className="text-lg">📄</span>
              <span className="text-sm font-medium whitespace-nowrap">{libraryFlyingTitle}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFlyingStatus && (
          <motion.div
            initial={{
              x: leftCollapsed ? window.innerWidth * 0.4 : window.innerWidth * 0.35,
              y: window.innerHeight * 0.5,
              scale: 1,
              opacity: 1,
            }}
            animate={{
              x: leftCollapsed ? window.innerWidth * 0.08 : window.innerWidth * 0.18,
              y: window.innerHeight - 80,
              scale: 0.6,
              opacity: 0.8,
            }}
            exit={{ scale: 0.3, opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="fixed z-50 pointer-events-none"
          >
            <div className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-2xl border-2 border-green-300 flex items-center gap-2">
              <span className="text-lg">🔄</span>
              <span className="text-sm font-medium whitespace-nowrap">Status Update</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFlyingSummary && (
          <motion.div
            initial={{
              x: leftCollapsed ? window.innerWidth * 0.4 : window.innerWidth * 0.35,
              y: window.innerHeight * 0.5,
              scale: 1,
              opacity: 1,
            }}
            animate={{
              x: leftCollapsed ? window.innerWidth * 0.08 : window.innerWidth * 0.18,
              y: window.innerHeight - 80,
              scale: 0.6,
              opacity: 0.8,
            }}
            exit={{ scale: 0.3, opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="fixed z-50 pointer-events-none"
          >
            <div className="bg-purple-500 text-white px-4 py-2 rounded-lg shadow-2xl border-2 border-purple-300 flex items-center gap-2">
              <span className="text-lg">📝</span>
              <span className="text-sm font-medium whitespace-nowrap">Summary created</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFlyingDraft && (
          <motion.div
            initial={{
              x: leftCollapsed ? window.innerWidth * 0.4 : window.innerWidth * 0.35,
              y: window.innerHeight * 0.8,
              scale: 1,
              opacity: 1,
            }}
            animate={{
              x: window.innerWidth * 0.75,
              y: window.innerHeight * 0.15,
              scale: 0.6,
              opacity: 0.8,
            }}
            exit={{ scale: 0.3, opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="fixed z-50 pointer-events-none"
          >
            <div className="bg-yellow-700 text-white px-4 py-2 rounded-lg shadow-2xl border-2 border-yellow-500 flex items-center gap-2">
              <span className="text-lg">✨</span>
              <span className="text-sm font-medium whitespace-nowrap">Draft created</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
