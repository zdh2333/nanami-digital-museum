import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

type SectionRevealProps = {
  children: ReactNode
  className?: string
  delay?: number
  staticExperience: boolean
}

export function SectionReveal({
  children,
  className,
  delay = 0,
  staticExperience,
}: SectionRevealProps) {
  if (staticExperience) {
    return (
      <div className={className} data-reveal="static">
        {children}
      </div>
    )
  }

  return (
    <motion.div
      className={className}
      data-reveal="animated"
      initial={{ opacity: 0, y: 30, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.82, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
