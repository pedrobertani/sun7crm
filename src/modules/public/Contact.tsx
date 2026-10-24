import { ArrowUpRight } from 'lucide-react';
import { PublicShell } from './PublicShell';

const WHATSAPP_MESSAGE = 'Olá, vim pelo SUN7CRM e gostaria de saber mais sobre o sistema.';
const WHATSAPP_URL = `https://wa.me/5514996732848?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

export function ContactPage() {
  return (
    <PublicShell title="Contato · SUN7CRM">
      <main className="contact-page public-container">
        <div className="contact-copy">
          <span className="home-eyebrow">FALE COM O SUN7CRM</span>
          <h1>
            Vamos conversar sobre
            <br />
            <em>o seu negócio.</em>
          </h1>
          <p>
            Quer conhecer o sistema, tirar uma dúvida ou conversar sobre o atendimento da sua
            empresa? Fale com a gente pelo WhatsApp.
          </p>
        </div>
        <section className="contact-card" aria-labelledby="whatsapp-title">
          <h2 id="whatsapp-title">Atendimento pelo WhatsApp</h2>
          <p>Uma conversa para entender o que você precisa.</p>
          <a
            className="home-primary"
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Conversar pelo WhatsApp do SUN7CRM (abre em nova aba)"
          >
            Conversar pelo WhatsApp <ArrowUpRight size={18} />
          </a>
          <small>Abre no WhatsApp com uma mensagem pronta.</small>
        </section>
      </main>
    </PublicShell>
  );
}
