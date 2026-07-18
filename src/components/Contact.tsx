import { useLocale } from '../i18n/LocaleProvider'

const email = 'zhoudonghao2333@gmail.com'
const qq = '769072617'

export function Contact() {
  const { copy } = useLocale()

  return (
    <footer id="contact" className="contact anchor-target" aria-labelledby="contact-title">
      <div className="contact__inner">
        <p className="museum-label">{copy.contact.eyebrow}</p>
        <h2 id="contact-title">{copy.contact.title}</h2>
        <p className="contact__summary">{copy.contact.summary}</p>
        <address className="contact__links">
          <a className="contact__link" href={`mailto:${email}`}>
            <span>{copy.contact.emailLabel}</span>
            <strong>{email}</strong>
          </a>
          <a
            className="contact__link"
            href={`https://wpa.qq.com/msgrd?v=3&uin=${qq}&site=qq&menu=yes`}
            target="_blank"
            rel="noreferrer"
          >
            <span>{copy.contact.qqLabel}</span>
            <strong>{qq}</strong>
          </a>
        </address>
        <p className="contact__note">{copy.contact.note}</p>
      </div>
    </footer>
  )
}
