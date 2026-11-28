import { Icon, type MeaningIconName } from '../ui/icons';

interface Entry {
  href: string;
  title: string;
  description: string;
  icon: MeaningIconName;
  /** 入口卡片的主色：漸層底色與白字（對比見 tests/theme.test.ts 的 primary） */
  tone: string;
}

const ENTRIES: readonly Entry[] = [
  {
    href: '/teacher',
    title: '老師端',
    description: '匯入題目、控制搶答',
    icon: 'home.teacher',
    tone: 'from-violet-600 to-fuchsia-700 shadow-[0_6px_0_0_var(--color-entry-teacher-deep)]',
  },
  {
    href: '/student',
    title: '學生端',
    description: '輸入暱稱、選組作答',
    icon: 'home.student',
    tone: 'from-emerald-700 to-teal-700 shadow-[0_6px_0_0_var(--color-entry-student-deep)]',
  },
];

/** 首頁（007 FR-005）：系統名稱、一句說明，以及附圖示與用途說明的老師端、學生端入口。 */
export function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="space-y-3">
        <span className="ui-anim inline-grid size-16 animate-float place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-pink-500 text-white shadow-card">
          <Icon name="sparkles" size={32} />
        </span>
        <h1 className="text-4xl font-black tracking-tight text-ink sm:text-5xl">課堂搶答系統</h1>
        <p className="text-lg text-ink-muted">用 Guided Notes 進行分組搶答的課堂互動</p>
      </div>
      <nav className="grid w-full gap-5 sm:grid-cols-2" aria-label="選擇身分">
        {ENTRIES.map((entry) => (
          <a
            key={entry.href}
            href={entry.href}
            className={`group flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-br p-8 text-white transition hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-300 focus-visible:ring-offset-2 motion-reduce:transform-none ${entry.tone}`}
          >
            <span className="grid size-16 place-items-center rounded-2xl bg-white/20">
              <Icon name={entry.icon} size={36} />
            </span>
            <span className="text-2xl font-black">{entry.title}</span>
            <span className="text-base font-semibold text-white">{entry.description}</span>
          </a>
        ))}
      </nav>
    </main>
  );
}
