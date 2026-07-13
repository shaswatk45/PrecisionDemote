import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Rewind, FastForward } from 'lucide-react'

const createInfiniteItems = (originalItems) => {
  const items = []
  for (let i = 0; i < 3; i++) {
    originalItems.forEach((item, index) => {
      items.push({ ...item, id: `${i}-${item.id}`, originalIndex: index })
    })
  }
  return items
}

const RulerLines = ({ top = true, totalLines = 100 }) => {
  const lines = []
  const lineSpacing = 100 / (totalLines - 1)

  for (let i = 0; i < totalLines; i++) {
    const isFifth = i % 5 === 0
    const isCenter = i === Math.floor(totalLines / 2)

    let height = 'h-3'
    let color = 'bg-[#1a1a1a]'
    if (isCenter) { height = 'h-8'; color = 'bg-nv' }
    else if (isFifth) { height = 'h-4'; color = 'bg-[#3d3d3d]' }

    lines.push(
      <div
        key={i}
        className={`absolute w-0.5 ${height} ${color} ${top ? '' : 'bottom-0'}`}
        style={{ left: `${i * lineSpacing}%` }}
      />
    )
  }

  return <div className="relative w-full h-8 px-4">{lines}</div>
}

export function RulerCarousel({ originalItems, onActiveChange, initialIndex = 4 }) {
  const infiniteItems = createInfiniteItems(originalItems)
  const itemsPerSet = originalItems.length

  const [activeIndex, setActiveIndex] = useState(itemsPerSet + initialIndex)
  const [isResetting, setIsResetting] = useState(false)

  const goTo = (newIndex) => {
    setActiveIndex(newIndex)
    onActiveChange?.(((newIndex % itemsPerSet) + itemsPerSet) % itemsPerSet)
  }

  const handleItemClick = (newIndex) => {
    if (isResetting) return
    const targetOriginalIndex = newIndex % itemsPerSet
    const possibleIndices = [
      targetOriginalIndex,
      targetOriginalIndex + itemsPerSet,
      targetOriginalIndex + itemsPerSet * 2,
    ]
    let closestIndex = possibleIndices[0]
    let smallestDistance = Math.abs(possibleIndices[0] - activeIndex)
    for (const index of possibleIndices) {
      const distance = Math.abs(index - activeIndex)
      if (distance < smallestDistance) { smallestDistance = distance; closestIndex = index }
    }
    goTo(closestIndex)
  }

  const handlePrevious = () => { if (!isResetting) goTo(activeIndex - 1) }
  const handleNext = () => { if (!isResetting) goTo(activeIndex + 1) }

  useEffect(() => {
    onActiveChange?.(initialIndex % itemsPerSet)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isResetting) return
    if (activeIndex < itemsPerSet) {
      setIsResetting(true)
      setTimeout(() => { setActiveIndex(activeIndex + itemsPerSet); setIsResetting(false) }, 0)
    } else if (activeIndex >= itemsPerSet * 2) {
      setIsResetting(true)
      setTimeout(() => { setActiveIndex(activeIndex - itemsPerSet); setIsResetting(false) }, 0)
    }
  }, [activeIndex, itemsPerSet, isResetting])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isResetting) return
      if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(activeIndex - 1) }
      else if (event.key === 'ArrowRight') { event.preventDefault(); goTo(activeIndex + 1) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResetting, activeIndex])

  const centerPosition = 5
  const targetX = -500 + (centerPosition - (activeIndex % itemsPerSet)) * 500

  const currentPage = (activeIndex % itemsPerSet) + 1
  const totalPages = itemsPerSet

  return (
    <div className="w-full flex flex-col items-center justify-center select-none font-sans">
      <div className="w-full h-[180px] flex flex-col justify-center relative">
        <div className="flex items-center justify-center"><RulerLines top /></div>

        <div className="flex items-center justify-center w-full h-full relative overflow-hidden">
          <motion.div
            className="flex items-center gap-[100px]"
            animate={{ x: targetX }}
            transition={isResetting ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 20, mass: 1 }}
          >
            {infiniteItems.map((item, index) => {
              const isActive = index === activeIndex
              return (
                <motion.button
                  key={item.id}
                  onClick={() => handleItemClick(index)}
                  className={`text-2xl md:text-4xl font-black uppercase tracking-widest whitespace-nowrap cursor-pointer flex items-center justify-center ${isActive ? 'text-nv' : 'text-stone hover:text-mute'}`}
                  animate={{ scale: isActive ? 1 : 0.72, opacity: isActive ? 1 : 0.4 }}
                  transition={isResetting ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 25 }}
                  style={{ width: '400px' }}
                >
                  {item.title}
                </motion.button>
              )
            })}
          </motion.div>
        </div>

        <div className="flex items-center justify-center"><RulerLines top={false} /></div>
      </div>

      <div className="flex items-center justify-center gap-4 mt-6">
        <button onClick={handlePrevious} disabled={isResetting} className="flex items-center justify-center cursor-pointer text-mute hover:text-nv transition-colors" aria-label="Previous feature">
          <Rewind className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider">
          <span className="font-bold text-ink">{String(currentPage).padStart(2, '0')}</span>
          <span className="text-stone">/</span>
          <span className="font-bold text-mute">{String(totalPages).padStart(2, '0')}</span>
        </div>
        <button onClick={handleNext} disabled={isResetting} className="flex items-center justify-center cursor-pointer text-mute hover:text-nv transition-colors" aria-label="Next feature">
          <FastForward className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
