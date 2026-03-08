'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

const DISPLAY_FONTS = [
  'Plus Jakarta Sans', 'Playfair Display', 'Fraunces', 'DM Sans',
  'Outfit', 'Sora', 'Cormorant Garamond', 'Space Grotesk', 'Libre Baskerville',
]
const BODY_FONTS = [
  'Lora', 'Inter', 'Source Sans 3', 'DM Serif Display',
  'Libre Franklin', 'Nunito', 'Merriweather', 'Raleway',
]

const LOADING_MESSAGES = [
  'Fetching your website…',
  'Analyzing your brand…',
  'Extracting your content…',
  'Building your profile…',
]

interface BrandColors { background: string; primary: string; accent: string; text: string }
interface Fonts { display: string; body: string }
interface Profile {
  id: string
  company_name: string
  tagline: string
  logo_url: string | null
  brand_colors: BrandColors
  fonts: Fonts
}

// ─── Live Preview ────────────────────────────────────────────────────────────

function MicrositePreview({ colors, fonts, companyName, logoUrl }: {
  colors: BrandColors; fonts: Fonts; companyName: string; logoUrl: string | null
}) {
  const fontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fonts.display)}:wght@400;600;700&family=${encodeURIComponent(fonts.body)}:ital,wght@0,400;0,700;1,400&display=swap`

  return (
    <div className="w-full h-full flex flex-col overflow-hidden rounded-lg border border-gray-200 shadow-xl">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 bg-gray-100 border-b border-gray-200 shrink-0">
        <span className="w-3 h-3 rounded-full bg-red-400" />
        <span className="w-3 h-3 rounded-full bg-yellow-400" />
        <span className="w-3 h-3 rounded-full bg-green-400" />
        <span className="ml-3 flex-1 bg-white rounded text-xs text-gray-400 px-3 py-1 font-mono">
          pitch.avolor.com/acmecorp-x4f9k2
        </span>
      </div>

      {/* Microsite */}
      <div className="flex-1 overflow-y-auto" style={{ background: colors.background }}>
        <style>{`@import url('${fontUrl}');`}</style>

        {/* Nav */}
        <nav style={{ background: colors.background, borderBottom: `1px solid ${colors.primary}22` }}
          className="flex items-center justify-between px-8 py-4">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              logoUrl.startsWith('<') ? (
                <span
                  className="h-7 flex items-center [&_svg]:h-full [&_svg]:w-auto [&_img]:h-full [&_img]:w-auto"
                  dangerouslySetInnerHTML={{ __html: logoUrl }}
                />
              ) : (
                <img src={logoUrl} alt="logo" className="h-7 w-auto object-contain" />
              )
            ) : (
              <span style={{ fontFamily: `'${fonts.display}', sans-serif`, color: colors.primary, fontWeight: 700, fontSize: 16 }}>
                {companyName || 'Your Company'}
              </span>
            )}
          </div>
          <button style={{ background: colors.accent, color: '#ffffff', fontFamily: `'${fonts.display}', sans-serif`, fontSize: 12, fontWeight: 600 }}
            className="px-4 py-2 rounded-full">
            Book a call
          </button>
        </nav>

        {/* Hero */}
        <section style={{ background: colors.primary }} className="px-8 py-16">
          <p style={{ color: colors.accent, fontFamily: `'${fonts.body}', serif`, fontSize: 13, letterSpacing: '0.08em' }}
            className="uppercase mb-4">
            Prepared for Prospect Co.
          </p>
          <h1 style={{ color: '#ffffff', fontFamily: `'${fonts.display}', sans-serif`, fontWeight: 700, fontSize: 32, lineHeight: 1.15 }}
            className="mb-6 max-w-lg">
            How {companyName || 'we'} can help Prospect Co. grow faster
          </h1>
          <p style={{ color: '#ffffff99', fontFamily: `'${fonts.body}', serif`, fontSize: 15, lineHeight: 1.7 }}
            className="max-w-md mb-8">
            A tailored overview of what we do, why it matters to your team, and how we can start delivering results quickly.
          </p>
          <button style={{ background: colors.accent, color: '#fff', fontFamily: `'${fonts.display}', sans-serif`, fontWeight: 600, fontSize: 14 }}
            className="px-6 py-3 rounded-full">
            Schedule a conversation →
          </button>
        </section>

        {/* Context */}
        <section style={{ background: colors.background }} className="px-8 py-12">
          <div style={{ borderLeft: `3px solid ${colors.accent}` }} className="pl-6">
            <h2 style={{ color: colors.primary, fontFamily: `'${fonts.display}', sans-serif`, fontWeight: 700, fontSize: 20 }}
              className="mb-3">
              We understand your business
            </h2>
            <p style={{ color: colors.text + 'bb', fontFamily: `'${fonts.body}', serif`, fontSize: 14, lineHeight: 1.8 }}>
              Prospect Co. operates in a space where speed and precision matter. We've worked with companies like yours
              and understand the pressures you face — from scaling operations to staying ahead of the market.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

// ─── Color Picker ────────────────────────────────────────────────────────────

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 font-mono">{value}</span>
        <label className="relative w-8 h-8 rounded-md border border-gray-200 overflow-hidden cursor-pointer"
          style={{ background: value }}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
        </label>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

type Step = 'input' | 'loading' | 'customizing' | 'saving'

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>('input')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0])
  const [companyName, setCompanyName] = useState('')
  const [colors, setColors] = useState<BrandColors>({ background: '#ffffff', primary: '#111111', accent: '#0066ff', text: '#111111' })
  const [fonts, setFonts] = useState<Fonts>({ display: 'Plus Jakarta Sans', body: 'Lora' })
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Check for existing profile on mount
  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(data => {
      if (data?.id) hydrateFromProfile(data)
    })
  }, [])

  // Cycle loading messages
  useEffect(() => {
    if (step !== 'loading') return
    let i = 0
    const interval = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length
      setLoadingMsg(LOADING_MESSAGES[i])
    }, 2500)
    return () => clearInterval(interval)
  }, [step])

  function hydrateFromProfile(p: Profile) {
    setProfile(p)
    setCompanyName(p.company_name)
    setColors(p.brand_colors)
    setFonts(p.fonts)
    setLogoUrl(p.logo_url)
    setStep('customizing')
  }

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setStep('loading')

    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })

    if (!res.ok) {
      setError('Something went wrong. Please try again.')
      setStep('input')
      return
    }

    const data = await res.json()
    hydrateFromProfile(data)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    setLogoUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const ext = file.name.split('.').pop()
    const path = `${user.id}/logo.${ext}`
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })

    if (!error) {
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      setLogoUrl(data.publicUrl)
    }
    setLogoUploading(false)
  }

  async function handleSave() {
    setStep('saving')
    await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: companyName,
        brand_colors: colors,
        fonts,
        logo_url: logoUrl,
        complete: true,
      }),
    })
    router.push('/dashboard')
    router.refresh()
  }

  // ─── Input Step ────────────────────────────────────────────────────────────

  if (step === 'input') {
    return (
      <main className="min-h-screen bg-[#F5F4F1] flex items-center justify-center px-4">
        <div className="w-full max-w-lg">
          <div className="mb-10">
            <h1 className="text-4xl font-bold text-gray-900 mb-3" style={{ fontFamily: 'Georgia, serif' }}>
              Let's build your<br />pitch profile.
            </h1>
            <p className="text-gray-500 text-lg">
              Enter your company website. We'll extract your brand, messaging, and assets automatically.
            </p>
          </div>

          <form onSubmit={handleAnalyze}>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="yourcompany.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                className="flex-1 bg-white border border-gray-200 rounded-xl px-5 py-4 text-base outline-none focus:border-gray-400 transition-colors shadow-sm"
              />
              <button
                type="submit"
                className="bg-gray-900 text-white rounded-xl px-6 py-4 font-semibold text-sm hover:bg-gray-700 transition-colors whitespace-nowrap shadow-sm"
              >
                Analyze →
              </button>
            </div>
            {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
          </form>

          <p className="text-xs text-gray-400 mt-4">
            We'll fetch your homepage and a few key pages. This takes about 15–20 seconds.
          </p>
        </div>
      </main>
    )
  }

  // ─── Loading Step ──────────────────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <main className="min-h-screen bg-[#F5F4F1] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex gap-1 mb-8">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-2 h-2 rounded-full bg-gray-900 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <p className="text-gray-600 text-lg transition-all">{loadingMsg}</p>
          <p className="text-gray-400 text-sm mt-2">{url}</p>
        </div>
      </main>
    )
  }

  // ─── Customizing Step ──────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#F5F4F1] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-gray-200 bg-white">
        <div>
          <span className="font-bold text-gray-900">Avolor</span>
          <span className="text-gray-300 mx-3">·</span>
          <span className="text-sm text-gray-500">Customize your brand</span>
        </div>
        <button
          onClick={handleSave}
          disabled={step === 'saving'}
          className="bg-gray-900 text-white rounded-lg px-5 py-2.5 text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {step === 'saving' ? 'Saving…' : 'Save & Continue →'}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Controls panel */}
        <aside className="w-80 bg-white border-r border-gray-200 overflow-y-auto shrink-0">
          <div className="p-6 space-y-6">

            {/* Company name */}
            <section>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Company Name
              </label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-gray-400"
              />
            </section>

            {/* Logo */}
            <section>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Logo
              </label>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
                  {logoUrl ? (
                    logoUrl.startsWith('<') ? (
                      <span
                        className="w-full h-full flex items-center justify-center p-1 [&_svg]:max-h-full [&_svg]:max-w-full [&_img]:max-h-full"
                        dangerouslySetInnerHTML={{ __html: logoUrl }}
                      />
                    ) : (
                      <img src={logoUrl} alt="logo" className="w-full h-full object-contain p-1" />
                    )
                  ) : (
                    <span className="text-lg font-bold text-gray-300">
                      {companyName.charAt(0) || '?'}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUploading}
                  className="text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {logoUploading ? 'Uploading…' : 'Upload logo'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>
            </section>

            {/* Colors */}
            <section>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Brand Colors
              </label>
              <div className="divide-y divide-gray-100">
                <ColorPicker label="Primary" value={colors.primary} onChange={(v) => setColors({ ...colors, primary: v })} />
                <ColorPicker label="Accent" value={colors.accent} onChange={(v) => setColors({ ...colors, accent: v })} />
                <ColorPicker label="Background" value={colors.background} onChange={(v) => setColors({ ...colors, background: v })} />
                <ColorPicker label="Text" value={colors.text} onChange={(v) => setColors({ ...colors, text: v })} />
              </div>
            </section>

            {/* Fonts */}
            <section>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Fonts
              </label>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Display</p>
                  <select
                    value={fonts.display}
                    onChange={(e) => setFonts({ ...fonts, display: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400"
                  >
                    {DISPLAY_FONTS.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Body</p>
                  <select
                    value={fonts.body}
                    onChange={(e) => setFonts({ ...fonts, body: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400"
                  >
                    {BODY_FONTS.map((f) => <option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>
            </section>

          </div>
        </aside>

        {/* Live preview */}
        <div className="flex-1 p-8 overflow-hidden">
          <p className="text-xs text-gray-400 mb-4 text-center uppercase tracking-wider font-medium">
            Live preview — what your pitch microsites will look like
          </p>
          <div className="h-full max-h-[calc(100vh-160px)]">
            <MicrositePreview
              colors={colors}
              fonts={fonts}
              companyName={companyName}
              logoUrl={logoUrl}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
