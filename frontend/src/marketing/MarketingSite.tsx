import { launchLanguages } from '../content/launchLanguages'

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

function ExtensibleContentSection() {
  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Custom Content Positioning</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            Build your own practice bank with AI-generated questions
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            LangQuiz is not limited to a fixed catalog. You can generate your own grammar, vocabulary, or exam-style
            question sets with ChatGPT or any LLM, import them in JSON, and practice them in the same adaptive session
            flow as the built-in packs.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li>Bring topic-specific drills for your textbook, tutor, or exam syllabus</li>
            <li>Mix generated questions with built-in packs in one practice workflow</li>
            <li>Keep progress tracking, mistake-weighted review, and session scoring on your own content</li>
          </ul>
          <CtaButtons />
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">Typical launch use cases</p>
          <div className="mt-3 space-y-3 text-sm text-slate-600">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="font-medium text-slate-800">Exam prep</p>
              <p className="mt-1">Generate packs for Goethe, DELF, DELE, or school grammar chapters.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="font-medium text-slate-800">Teacher-created drills</p>
              <p className="mt-1">Turn classroom prompts and worksheets into reusable short practice sessions.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="font-medium text-slate-800">Personal weak spots</p>
              <p className="mt-1">Generate targeted packs just for the grammar patterns or vocabulary you keep missing.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function LaunchLanguagesSection() {
  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Go-Live Language Support</p>
          <h2 className="text-xl font-semibold text-slate-900">Languages available at launch</h2>
        </div>
        <p className="text-sm text-slate-500">This list reflects the launch scope we are taking live publicly.</p>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {launchLanguages.map((language) => (
          <div key={language.code} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-800">
                {language.name} <span className="text-slate-400">({language.code})</span>
              </h3>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                {language.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{language.detail}</p>
          </div>
        ))}
      </div>
    </section>
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
            <li>Bring your own generated question sets and practice them like native packs</li>
          </ul>
          <CtaButtons />
        </section>

        <ExtensibleContentSection />

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

        <LaunchLanguagesSection />
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
