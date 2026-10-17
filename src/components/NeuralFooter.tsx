import { Github, Mail } from 'lucide-react';

export default function NeuralFooter() {
  return (
    <footer
      className="w-full mt-24 py-4 px-6"
      style={{ borderTop: '1px solid rgb(var(--accent-rgb) / 0.15)' }}
    >
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--neural-text-muted)' }}>
          © {new Date().getFullYear()} muse.log
        </p>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/kkineh"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-[var(--neural-accent)]"
            style={{ color: 'var(--neural-text-muted)' }}
            aria-label="GitHub"
          >
            <Github size={16} />
          </a>
          <a
            href="mailto:kkinehz@gmail.com"
            className="transition-colors hover:text-[var(--neural-accent)]"
            style={{ color: 'var(--neural-text-muted)' }}
            aria-label="Email"
          >
            <Mail size={16} />
          </a>
        </div>
      </div>
    </footer>
  );
}
