import type { JSX } from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './components/ui/button'
import { translations } from './i18n/translations'

function App(): JSX.Element {
  const { t } = useTranslation()
  const [count, setCount] = useState<number>(0)

  const handleIncrement = (): void => {
    setCount((prevCount) => prevCount + 1)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8">
      <h1 className="text-4xl md:text-6xl font-bold">{t(translations.app.title)}</h1>
      <div className="flex flex-col items-center">
        <Button onClick={handleIncrement}>{t(translations.ui.button.count, { count })}</Button>
        <p className="text-zinc-300 leading-relaxed">{t(translations.app.description)}</p>
      </div>
      <p className="text-zinc-500">{t(translations.ui.button.test)}</p>
    </div>
  )
}

export default App
