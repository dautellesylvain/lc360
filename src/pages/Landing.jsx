import { Link } from 'react-router-dom'
import styles from './Landing.module.css'

const STEPS = [
  {
    num: '01',
    icon: 'cloud_upload',
    color: 'secondary',
    title: 'Importez vos photos',
    desc: 'Glissez-déposez vos panoramas 360°. Notre moteur les convertit instantanément.',
  },
  {
    num: '02',
    icon: 'ads_click',
    color: 'tertiary',
    title: 'Ajoutez vos points',
    desc: 'Reliez vos pièces intuitivement. Ajoutez des infos ou des médias enrichis sans aucune connaissance technique.',
  },
  {
    num: '03',
    icon: 'rocket_launch',
    color: 'primary',
    title: 'Publiez & Partagez',
    desc: 'Générez un lien sécurisé. Fluidité parfaite sur mobile, web et casques VR.',
  },
]

const FEATURES = [
  { icon: 'bolt',      title: 'Assemblage Rapide',    desc: 'La création d\'une visite est optimisée pour ne prendre que quelques minutes de votre temps.' },
  { icon: 'touch_app', title: 'Interface Intuitive',   desc: 'Conçu pour une efficacité immédiate : apprenez à maîtriser l\'outil en moins de 5 minutes.' },
  { icon: 'devices',   title: 'Stabilité & Modernité', desc: 'Une technologie robuste qui garantit un rendu impeccable sur tous les supports récents.' },
]

export default function Landing() {
  return (
    <div className={styles.page}>

      {/* ── Google Fonts ── */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

      {/* ── Nav ── */}
      <header className={styles.nav}>
        <nav className={styles.navInner}>
          <div className={styles.navBrand}>
            <span className={`material-symbols-outlined ${styles.navIcon}`}>360</span>
            <span className={styles.navLogo}>LC360</span>
          </div>
          <div className={styles.navLinks}>
            <a href="#steps">Fonctionnement</a>
            <a href="#tarifs">Tarifs</a>
          </div>
          <div className={styles.navActions}>
            <Link to="/login" className={styles.navLogin}>Connexion</Link>
            <Link to="/register" className={styles.navCta}>Essai Gratuit</Link>
          </div>
        </nav>
      </header>

      <main>

        {/* ── Hero ── */}
        <section className={styles.hero}>
          <div className={styles.heroBgImg}>
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCbYUKoji-n397HvnE3OzuV8T_je263kxSaay3Ac2S1aGU5S-aBKrhan6SgfHuYdIdr5vNDVs9pPCL_zPJQoYDzJZKB4MtneEQuuwJKHz6Ab8Jw0mcIVPIXEfdic9vbwOuRtLk_CYA17KllU3OLM1IuvtJthtMXkRX9iVsToleu9685cPT_YMjuHJDwpZnBCc7yqfVounj2xQqR9OHboaiXXyVZVyY8pwtn7OjGeUi6GTho7yvb7s7uApB1yFnLLIh-bilIgE81POU"
              alt="Panorama 360"
            />
            <div className={styles.heroBgOverlay} />
          </div>
          <div className={styles.heroContent}>
            <span className={styles.heroBadge}>Simplicité Absolue</span>
            <h1 className={styles.heroTitle}>
              La visite virtuelle 360,{' '}
              <span className={styles.heroAccent}>enfin simple.</span>
            </h1>
            <p className={styles.heroSub}>
              De vos images à la visite virtuelle en 3 minutes.<br />
              Une solution stable et performante pour vos projets immo/archi
            </p>
            <div className={styles.heroActions}>
              <Link to="/register" className={styles.btnHero}>
                Créer ma visite gratuitement
              </Link>
              <a href="#steps" className={styles.btnGlass}>
                <span className="material-symbols-outlined">play_circle</span>
                Voir l'exemple
              </a>
            </div>
            <div className={styles.heroChecks}>
              <div className={styles.heroCheck}>
                <span className="material-symbols-outlined">check_circle</span>
                Un clic pour publier
              </div>
              <div className={styles.heroCheck}>
                <span className="material-symbols-outlined">check_circle</span>
                Traitement instantané
              </div>
            </div>
          </div>
        </section>

        {/* ── Steps ── */}
        <section className={styles.steps} id="steps">
          <div className={styles.stepsInner}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Votre visite en 3 étapes éclair</h2>
              <p className={styles.sectionSub}>Une prise en main immédiate pour des résultats professionnels.</p>
            </div>
            <div className={styles.stepsGrid}>
              {STEPS.map((s, i) => (
                <div key={i} className={styles.stepCard}>
                  <div className={styles.stepNum}>{s.num}</div>
                  <div className={`${styles.stepIconWrap} ${styles[`stepIcon_${s.color}`]}`}>
                    <span className="material-symbols-outlined">{s.icon}</span>
                  </div>
                  <h3 className={styles.stepTitle}>{s.title}</h3>
                  <p className={styles.stepDesc}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Simplicity ── */}
        <section className={styles.simplicity}>
          <div className={styles.simplicityInner}>
            <div className={styles.simplicityText}>
              <h2 className={styles.simplicityTitle}>
                Une élégance professionnelle,<br />une fluidité absolue
              </h2>
              <ul className={styles.featureList}>
                {FEATURES.map((f, i) => (
                  <li key={i} className={styles.featureItem}>
                    <div className={styles.featureIconWrap}>
                      <span className="material-symbols-outlined">{f.icon}</span>
                    </div>
                    <div>
                      <h4 className={styles.featureTitle}>{f.title}</h4>
                      <p className={styles.featureDesc}>{f.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.simplicityVisual}>
              <div className={styles.simplicityImg}>
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCQ8wwBCOrOasXNIlmZf7vdknEHVMnKkFqysMKBmI_EflILJDSvU1O_siaFkCl1GaFN6fDA_ZXrBv1IFn7srhA89U9YberdOQY7CstqCE_dLc5c1IMpzaExM1lVUWEmdcy5xOfroqqNx5xrlG2gK8TI9opU8AtYrlgJ_2PoaRqmijrgt6NvbB6kOhbxNgeDlmFTj62iXlMfA4aAwAfN73sz4S2zfJchF0tD6J7uwHgjdenAJanr3e218T3Dg2Ak_7ik4bZkc0xE88U"
                  alt="Interface LC360"
                />
                <div className={styles.simplicityBadge}>
                  <span className="material-symbols-outlined">auto_awesome</span>
                  Un clic suffit
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className={styles.cta} id="tarifs">
          <div className={styles.ctaInner}>
            <div className={styles.ctaGlow1} />
            <div className={styles.ctaGlow2} />
            <div className={styles.ctaContent}>
              <h2 className={styles.ctaTitle}>Entrer dans un monde à 360°</h2>
              <p className={styles.ctaSub}>
                Rejoignez plus de 10 000 créateurs exigeants.<br />
                Vos 3 premières visites sont offertes, sans engagement.
              </p>
              <div className={styles.ctaActions}>
                <Link to="/register" className={styles.btnPrimary}>
                  Essayer gratuitement
                </Link>
                <a href="mailto:contact@lc360.fr" className={styles.btnOutline}>
                  Prendre rendez-vous
                </a>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <span className={styles.footerLogo}>LC360</span>
            <p className={styles.footerCopy}>© 2026 LC360 TOUS DROITS RÉSERVÉS</p>
          </div>
          <div className={styles.footerLinks}>
            <a href="#steps">Produit</a>
            <a href="#tarifs">Tarifs</a>
            <a href="mailto:contact@lc360.fr">Support</a>
            <a href="#">Confidentialité</a>
          </div>
        </div>
      </footer>

    </div>
  )
}
