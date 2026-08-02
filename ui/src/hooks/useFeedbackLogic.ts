import { useState } from 'react'

/**
 * Simplified feedback logic - feedback is now stored as ChatMessage with role='feedback'
 * This hook only manages the counter for numbering feedback blocks
 */
export function useFeedbackLogic() {
  const [feedbackCounter, setFeedbackCounter] = useState(1)

  const incrementCounter = () => {
    setFeedbackCounter(prev => prev + 1)
  }

  const resetCounter = () => {
    setFeedbackCounter(1)
  }

  return {
    feedbackCounter,
    incrementCounter,
    resetCounter
  }
}
