import { useEffect } from 'react'

export default function ElfsightChat() {
  useEffect(() => {
    // Injecter le script Elfsight
    if (!document.getElementById('elfsight-script')) {
      const script = document.createElement('script')
      script.id  = 'elfsight-script'
      script.src = 'https://elfsightcdn.com/platform.js'
      script.async = true
      document.body.appendChild(script)
    }

    return () => {
      // Supprimer le widget au démontage
      const script = document.getElementById('elfsight-script')
      if (script) script.remove()
      document.querySelectorAll('[class*="elfsight"], [id*="elfsight"], iframe[src*="elfsight"]')
        .forEach(el => el.remove())
    }
  }, [])

  return (
    <div
      className="elfsight-app-623bc618-dc9b-40ec-880b-809d05d48124"
      data-elfsight-app-lazy
    />
  )
}
