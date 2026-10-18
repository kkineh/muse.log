'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { ArrowLeft, House } from 'lucide-react';

const buttonClass =
  'flex items-center justify-center w-10 h-10 rounded-lg transition-colors hover:bg-[rgba(255,255,255,0.05)] text-[var(--neural-text-muted)] hover:text-[var(--neural-text-primary)]';

export default function PageHeader({ scrollProgress }: { scrollProgress: number }) {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) router.back();
    else router.push('/');
  };

  return (
    <motion.div
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="fixed top-0 left-0 right-0 z-20 px-8 py-6 flex items-center justify-between"
      style={{
        background: 'linear-gradient(180deg, rgba(8, 11, 16, 0.95) 0%, transparent 100%)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <button onClick={handleBack} aria-label="뒤로가기" title="뒤로가기" className={buttonClass}>
        <ArrowLeft size={20} />
      </button>

      <div className="flex-1 max-w-md mx-8 h-1 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, var(--neural-accent), var(--neural-node-sub))',
            boxShadow: '0 0 10px var(--neural-accent)',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${scrollProgress}%` }}
        />
      </div>

      <Link href="/" aria-label="홈" title="홈" className={buttonClass}>
        <House size={20} />
      </Link>
    </motion.div>
  );
}
