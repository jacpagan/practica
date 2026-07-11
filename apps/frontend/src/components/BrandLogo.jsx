import React from 'react'
import practicaWordmark from '../assets/brand/practica-wordmark.png'

export default function BrandLogo({ className = 'h-5 w-auto' }) {
  return (
    <img
      src={practicaWordmark}
      alt="Practica"
      className={className}
      draggable="false"
    />
  )
}
