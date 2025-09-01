import type { JSX } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { translations } from './i18n/translations'

function App(): JSX.Element {
  const { t } = useTranslation()
  const [count, setCount] = useState<number>(0)

  const handleIncrement = (): void => {
    setCount((prevCount) => prevCount + 1)
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white">
      <div className="animate-fade-in">
        <h1 className="text-4xl md:text-6xl font-bold text-center mb-8 text-glow bg-gradient-to-r from-primary-400 to-accent-blue bg-clip-text text-transparent">
          {t(translations.app.title)}
        </h1>
        <div className="card-hover max-w-md mx-auto">
          <button
            type="button"
            onClick={handleIncrement}
            className="btn-primary w-full text-lg mb-4 hover:shadow-glow transform hover:scale-105 transition-all duration-200"
          >
            {t(translations.ui.button.count, { count })}
          </button>
          <p className="text-gray-300 text-center leading-relaxed">
            {t(translations.app.description)}
          </p>
        </div>
        <p className="text-gray-500 text-center mt-8 animate-pulse">
          {t(translations.ui.button.test)}
        </p>
      </div>
    </div>
  )
}

export default App
