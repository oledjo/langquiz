const POSTS = [
  {
    slug: 'german-article-drills-a1-a2',
    title: 'German Article Drills for A1-A2 Learners',
    summary: 'Build der/die/das confidence with short, high-repeat sessions and instant feedback.',
  },
  {
    slug: 'mistake-driven-repetition-explained',
    title: 'Why Mistake-Driven Repetition Works Better Than Random Practice',
    summary: 'Train weak points first to improve retention and reduce study time waste.',
  },
  {
    slug: 'how-to-prepare-for-goethe-a2-speaking',
    title: 'How to Prepare for Goethe A2 Speaking with Daily Prompts',
    summary: 'Use focused question sets and structured response prompts for exam confidence.',
  },
  {
    slug: 'daily-12-minute-german-routine',
    title: 'A 12-Minute Daily German Routine You Can Keep',
    summary: 'A practical routine for consistency without long study blocks.',
  },
  {
    slug: 'topic-based-language-practice',
    title: 'Topic-Based Language Practice: A Better Alternative to Endless Flashcards',
    summary: 'Train grammar and vocabulary in context by topic and level.',
  },
  {
    slug: 'improve-german-word-order-fast',
    title: 'How to Improve German Word Order Faster',
    summary: 'Use sequenced drills and targeted correction loops for V2 and subordinate clauses.',
  },
  {
    slug: 'german-case-practice-with-feedback',
    title: 'German Case Practice with Immediate Feedback',
    summary: 'Reinforce nominative, accusative, and dative with adaptive sessions.',
  },
  {
    slug: 'from-beginner-to-b1-with-focused-sessions',
    title: 'From Beginner to B1 with Focused Practice Sessions',
    summary: 'Plan realistic milestones and track progress with measurable session outcomes.',
  },
]

function CtaButtons() {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <a
        href="/?utm_source=learn&utm_medium=cta&utm_campaign=web_launch"
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        Start Free Practice
      </a>
      <a
        href="/learn/daily-focused-language-practice"
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
      >
        See Daily Plan
      </a>
    </div>
  )
}

function LandingPage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">LangQuiz</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-base text-slate-600 sm:text-lg">{subtitle}</p>
          <ul className="mt-6 space-y-2 text-sm text-slate-700">
            <li>Topic and level filters for precise practice</li>
            <li>Mistake-weighted question sampling</li>
            <li>Short sessions designed for daily consistency</li>
          </ul>
          <CtaButtons />
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold text-slate-900">Latest Guides</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {POSTS.map((post) => (
              <a
                key={post.slug}
                href={`/learn/${post.slug}`}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50"
              >
                <h3 className="text-base font-semibold text-slate-800">{post.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{post.summary}</p>
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

function GuidePage({ slug }: { slug: string }) {
  const post = POSTS.find((item) => item.slug === slug)

  if (!post) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">The requested guide is not available.</p>
        <a href="/learn" className="mt-4 inline-block text-sm font-semibold text-blue-700 hover:text-blue-800">
          Back to learning guides
        </a>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">LangQuiz guide</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight">{post.title}</h1>
          <p className="mt-4 text-base text-slate-600">{post.summary}</p>
          <p className="mt-6 text-sm leading-6 text-slate-700">
            Build this topic into a daily focused session: pick a level, keep sessions short, and revisit mistakes every
            48 hours. LangQuiz automatically prioritizes missed questions, so each session reinforces weak spots instead
            of redoing what you already know.
          </p>
          <p className="mt-4 text-sm leading-6 text-slate-700">
            For exam preparation, keep one core topic per week and track completion consistency. Aim for five short
            sessions per week instead of one long session. This improves retention and keeps progress measurable.
          </p>
          <CtaButtons />
        </article>
      </main>
    </div>
  )
}

export function MarketingSite() {
  const pathname = window.location.pathname

  if (pathname === '/learn' || pathname === '/learn/') {
    return (
      <LandingPage
        title="Daily focused language practice"
        subtitle="Train by topic and level, then let the app prioritize your weak points so every 12-minute session moves you forward."
      />
    )
  }

  if (pathname === '/learn/german-exam-prep-drills') {
    return (
      <LandingPage
        title="German exam prep drills"
        subtitle="Prepare for Goethe and TELC with short, high-frequency question sessions tailored to your level and common mistakes."
      />
    )
  }

  if (pathname === '/learn/daily-focused-language-practice') {
    return (
      <LandingPage
        title="Daily focused language practice"
        subtitle="A practical routine for busy learners: short sessions, measurable progress, and adaptive review."
      />
    )
  }

  if (pathname.startsWith('/learn/')) {
    const slug = pathname.replace('/learn/', '').replace(/\/$/, '')
    return <GuidePage slug={slug} />
  }

  return null
}
