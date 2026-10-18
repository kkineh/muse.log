'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import NeuralFooter from '@/components/NeuralFooter';
import PageBackground from '@/components/PageBackground';
import PageHeader from '@/components/PageHeader';

export default function AboutPage() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!contentRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      if (scrollHeight <= clientHeight) { setScrollProgress(0); return; }
      const progress = (scrollTop / (scrollHeight - clientHeight)) * 100;
      setScrollProgress(Math.min(progress, 100));
    };
    const ref = contentRef.current;
    ref?.addEventListener('scroll', handleScroll);
    return () => ref?.removeEventListener('scroll', handleScroll);
  }, []);

  const skills = [
    { category: 'Frontend', items: ['TypeScript', 'React', 'Next.js', 'Tailwind CSS'] },
    { category: 'Backend', items: ['Node.js', 'PostgreSQL', 'Supabase'] },
    { category: 'AI / Infra', items: ['OpenAI API', 'pgvector', 'Vercel'] },
  ];

  const interests = [
    '자동화',
    'AI / LLM',
    '독서',
    '글쓰기',
    '원리 탐구',
    '지식 나눔',
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50"
      style={{ background: 'var(--neural-bg)', color: 'var(--neural-text-primary)' }}
    >
      <PageBackground scrollProgress={scrollProgress} />

      <PageHeader scrollProgress={scrollProgress} />

      {/* Scrollable content */}
      <motion.div
        ref={contentRef}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute inset-0 overflow-y-auto pt-32"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--neural-border-glow) transparent',
        }}
      >
        <div className="max-w-3xl mx-auto px-8">

          {/* Profile */}
          <section className="mb-12">
            <div
              className="w-20 h-20 rounded-full mb-6 overflow-hidden border"
              style={{
                borderColor: 'var(--neural-border-glow)',
                boxShadow: '0 0 20px rgb(var(--accent-rgb) / 0.15)',
              }}
            >
              <Image
                src="/avatar.png"
                alt="한상민"
                width={80}
                height={80}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <h1
              className="text-3xl font-semibold mb-3"
              style={{ fontFamily: 'var(--font-space-grotesk), sans-serif' }}
            >
              한상민
            </h1>
            <p className="text-lg leading-relaxed" style={{ color: 'var(--neural-text-muted)' }}>
              사유하고, 기록하고, 연결하는 개발자.
              <br />
              생각의 흔적을 코드와 글로 남깁니다.
            </p>
          </section>

          {/* About */}
          <section className="mb-12">
            <h2
              className="text-sm font-medium mb-6 tracking-widest uppercase"
              style={{ color: 'var(--neural-accent)' }}
            >
              About
            </h2>
            <div className="flex flex-col gap-4 text-base leading-relaxed" style={{ color: 'var(--neural-text-primary)' }}>
              <p>
                모든 것에서 이유를 찾는다.
                코드가 왜 그렇게 동작하는지, 사람이 왜 그런 선택을 하는지,
                세상이 어떤 구조로 이루어져 있는지
                항상 표면 아래를 들여다보려 한다.
              </p>

              <p>
                구조를 정리하는 일을 중요하게 본다.
                확장해야 할 부분과 그렇지 않은 부분을 구분하고,
                불필요한 복잡도를 덜어내는 데 가치를 둔다.
              </p>

              <p>
                소통을 통해 방향을 정리한다.
                정말 필요한 것과 불필요한 것을 구분하고,
                집중해야 할 지점을 선별한다.
                기획과 구현 사이의 불확실성을 걷어내며
                좋은 상태에 도달할 때까지 치밀하게 파고든다.
              </p>

              <p>
                이해한 것을 정리해 나눈다.
                복잡한 내용을 구조화해 쉽게 전달하는 것이 즐겁다.
              </p>
            </div>
          </section>

          {/* Beyond Code */}
          <section className="mb-12">
            <h2
              className="text-sm font-medium mb-6 tracking-widest uppercase"
              style={{ color: 'var(--neural-accent)' }}
            >
              Beyond Code
            </h2>
            <div className="flex flex-col gap-4 text-base leading-relaxed" style={{ color: 'var(--neural-text-primary)' }}>
              <p>
                진지하게 임하되, 유머를 잃지 않으려 한다.
                비판적으로 보면서도 다른 시각을 수용한다.
              </p>
              <p>
                사람들 사이에서는 주로 듣는 편이다.
                말보다 관찰이 먼저고, 상대방의 말에서 맥락을 읽는 게 좋다.
              </p>
              <p>
                헬스와 독서로 균형을 맞춘다.
                몸을 쓰고 생각을 쌓는다.
              </p>
            </div>
          </section>

          {/* Skills */}
          <section className="mb-12">
            <h2
              className="text-sm font-medium mb-6 tracking-widest uppercase"
              style={{ color: 'var(--neural-accent)' }}
            >
              Skills
            </h2>
            <div className="flex flex-col gap-5">
              {skills.map(({ category, items }) => (
                <div key={category} className="flex gap-4 items-start">
                  <span
                    className="text-xs pt-0.5 w-20 shrink-0"
                    style={{ color: 'var(--neural-text-muted)' }}
                  >
                    {category}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {items.map((item) => (
                      <span
                        key={item}
                        className="text-xs px-2.5 py-1 rounded-md border"
                        style={{
                          background: 'var(--neural-card)',
                          borderColor: 'rgb(var(--accent-rgb) / 0.2)',
                          color: 'var(--neural-text-primary)',
                        }}
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Interests */}
          <section className="mb-12">
            <h2
              className="text-sm font-medium mb-6 tracking-widest uppercase"
              style={{ color: 'var(--neural-accent)' }}
            >
              Interests
            </h2>
            <div className="flex flex-wrap gap-2">
              {interests.map((item) => (
                <span
                  key={item}
                  className="text-sm px-3 py-1.5 rounded-full border"
                  style={{
                    background: 'rgb(var(--accent-rgb) / 0.05)',
                    borderColor: 'rgb(var(--accent-rgb) / 0.2)',
                    color: 'var(--neural-text-muted)',
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </section>

        </div>

        <NeuralFooter />
      </motion.div>
    </motion.div>
  );
}
