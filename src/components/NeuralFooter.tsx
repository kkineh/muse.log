import Link from 'next/link';
import { Github, Mail, User } from 'lucide-react';
import { CiLinkedin } from 'react-icons/ci';
import { GITHUB_URL, LINKEDIN_URL, MAIL_URL } from '@/lib/social-links';

export default function NeuralFooter() {
  return (
    <footer className="w-full mt-24 py-4 px-6">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--neural-text-muted)' }}>
          © {new Date().getFullYear()} muse.log
        </p>
        <div className="flex items-center gap-4">
          <Link
            href="/about"
            className="transition-colors hover:text-[var(--neural-accent)]"
            style={{ color: 'var(--neural-text-muted)' }}
            aria-label="About"
          >
            <User size={16} />
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-[var(--neural-accent)]"
            style={{ color: 'var(--neural-text-muted)' }}
            aria-label="GitHub"
          >
            <Github size={16} />
          </a>
          <a
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-[var(--neural-accent)]"
            style={{ color: 'var(--neural-text-muted)' }}
            aria-label="LinkedIn"
          >
            <CiLinkedin size={18} />
          </a>
          <a
            href={MAIL_URL}
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
