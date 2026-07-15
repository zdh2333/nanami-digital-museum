import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

type SectionRevealProps = {
  children: ReactNode
  className?: string
  staticExperience: boolean
}

export function SectionReveal({
  children,
  className,
  staticExperience,
}: SectionRevealProps) {
  if (staticExperience) return <div className={className}>{children}</div>

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
