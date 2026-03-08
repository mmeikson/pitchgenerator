import { createClient } from '@/lib/supabase/server'
import { scrapeSeller, DEFAULT_COLORS, DEFAULT_FONTS } from '@/lib/scraper/seller'
import { extractSellerProfile, type SellerProfileExtraction } from '@/lib/llm/seller-extraction'
import { NextResponse } from 'next/server'

export const maxDuration = 60
export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('seller_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json(data ?? null)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { url } = await request.json()
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

  // Return existing profile if already created
  const { data: existing } = await supabase
    .from('seller_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()
  if (existing) return NextResponse.json(existing)

  // Scrape
  const scraped = await scrapeSeller(url).catch(() => null)
  const text = scraped?.text ?? ''

  // LLM extraction
  const fallback: SellerProfileExtraction = { company_name: '', tagline: '', services: [], proof_points: [], testimonials: [] }
  const extracted = text
    ? await extractSellerProfile(text).catch(() => fallback)
    : fallback

  const { data, error } = await supabase
    .from('seller_profiles')
    .insert({
      user_id: user.id,
      website_url: url,
      ...extracted,
      logo_url: scraped?.logoUrl ?? null,
      brand_colors: scraped?.colors ?? DEFAULT_COLORS,
      fonts: scraped?.fonts ?? DEFAULT_FONTS,
      raw_scrape: text,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { complete, ...updates } = await request.json()

  const { data, error } = await supabase
    .from('seller_profiles')
    .update(updates)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (complete) {
    await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', user.id)
  }

  return NextResponse.json(data)
}
