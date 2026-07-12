import React from 'react'
import practicaWordmark from '../assets/brand/practica-wordmark.png'

const variantClasses = {
  header: 'h-8 w-[190px] sm:h-10 sm:w-[235px]',
  auth: 'h-8 w-[190px] max-w-full',
  small: 'h-6 w-[140px]',
  compact: 'h-5 w-[118px]',
}

export default function BrandLogo({ variant = 'compact', className = '' }) {
  const sizeClass = variantClasses[variant] || variantClasses.compact

  return (
    <img
      src={practicaWordmark}
      alt="Practica"
      className={`${sizeClass} object-fill select-none ${className}`.trim()}
      draggable="false"
    />
  )
}
