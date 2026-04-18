import { useState } from 'react';
import { MessageCircle, X, Phone, Mail, Clock } from 'lucide-react';
import { useLang } from '@/lib/langContext';

export function StickyHelp() {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={lang === 'en' ? 'Need help?' : "Besoin d'aide ?"}
        aria-expanded={open}
        className="fixed bottom-24 right-4 z-[450] w-14 h-14 rounded-full bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        {open ? <X size={20} /> : <MessageCircle size={22} />}
      </button>

      {open && (
        <div
          className="fixed bottom-44 right-4 z-[450] w-[320px] max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-2xl border border-border overflow-hidden animate-[staggerUp_0.3s_cubic-bezier(.34,1.4,.64,1)_forwards]"
          role="dialog"
          aria-label={lang === 'en' ? 'Help & contact' : 'Aide et contact'}
        >
          <div className="bg-gradient-to-br from-[#0052CC] to-[#1B3A6B] text-white p-4">
            <div className="font-extrabold text-lg">
              {lang === 'en' ? "We're here to help" : 'On est là pour aider'}
            </div>
            <div className="text-xs opacity-90 mt-0.5">
              {lang === 'en'
                ? "Quick questions? Quote help? Reach out."
                : 'Questions ? Soumission ? Contacte-nous.'}
            </div>
          </div>

          <div className="p-3 space-y-2">
            <a
              href="tel:+13673804808"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#0052CC]/10 text-[#0052CC] flex items-center justify-center group-hover:bg-[#0052CC] group-hover:text-white transition-colors">
                <Phone size={16} />
              </div>
              <div>
                <div className="font-bold text-sm">367-380-4808</div>
                <div className="text-[11px] text-muted-foreground">
                  {lang === 'en' ? 'Call us' : 'Appelle-nous'}
                </div>
              </div>
            </a>

            <a
              href="mailto:info@visionaffichage.com"
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-[#E8A838]/10 text-[#B37D10] flex items-center justify-center group-hover:bg-[#E8A838] group-hover:text-white transition-colors">
                <Mail size={16} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-sm truncate">info@visionaffichage.com</div>
                <div className="text-[11px] text-muted-foreground">
                  {lang === 'en' ? 'Email us — reply in 24h' : 'Réponse en 24h'}
                </div>
              </div>
            </a>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Clock size={16} />
              </div>
              <div>
                <div className="font-bold text-sm">
                  {lang === 'en' ? 'Mon-Fri · 8am-5pm' : 'Lun-Ven · 8h-17h'}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {lang === 'en' ? 'Eastern Time' : 'Heure de l\'Est'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
