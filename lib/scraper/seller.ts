import * as cheerio from 'cheerio'

const TIMEOUT_MS = 10_000
const MAX_TEXT_LENGTH = 20_000

const TARGET_PATHS = ['about', 'services', 'case-studies', 'work', 'pricing', 'solutions', 'what-we-do']

export const DEFAULT_COLORS = {
  background: '#ffffff',
  primary: '#111111',
  accent: '#0066ff',
  text: '#111111',
}

export const DEFAULT_FONTS = {
  display: 'Plus Jakarta Sans',
  body: 'Lora',
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Avolor/1.0; +https://avolor.com)' },
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    return res.text()
  } catch {
    return null
  }
}

function extractText($: cheerio.CheerioAPI): string {
  $('script, style, noscript, iframe, nav, footer, [aria-hidden="true"]').remove()
  return $('h1, h2, h3, h4, p, li, blockquote, td, figcaption')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 25)
    .join('\n')
}

function extractLogo($: cheerio.CheerioAPI, baseUrl: string): string | null {
  const selectors = [
    'header img[class*="logo" i], header img[id*="logo" i], header img[alt*="logo" i]',
    'nav img[class*="logo" i], nav img[id*="logo" i], nav img[alt*="logo" i]',
    '[class*="logo" i] img, [id*="logo" i] img',
    'header a img:first-of-type, nav a img:first-of-type',
  ]
  for (const selector of selectors) {
    const src = $(selector).first().attr('src')
    if (src) {
      try { return new URL(src, baseUrl).href } catch { continue }
    }
  }
  // og:image as last resort
  const og = $('meta[property="og:image"]').attr('content')
  if (og) { try { return new URL(og, baseUrl).href } catch {} }
  return null
}

function extractColors($: cheerio.CheerioAPI): Partial<typeof DEFAULT_COLORS> {
  const css = $('style').map((_, el) => $(el).text()).get().join('\n')
  const colors: Partial<typeof DEFAULT_COLORS> = {}

  const patterns: { regex: RegExp; key: keyof typeof DEFAULT_COLORS }[] = [
    { regex: /--(?:color[-_]?)?(?:primary|brand|main)\s*:\s*(#[0-9a-fA-F]{3,6})/i, key: 'primary' },
    { regex: /--(?:color[-_]?)?(?:accent|highlight|cta)\s*:\s*(#[0-9a-fA-F]{3,6})/i, key: 'accent' },
    { regex: /--(?:color[-_]?)?(?:background|bg|surface)\s*:\s*(#[0-9a-fA-F]{3,6})/i, key: 'background' },
    { regex: /--(?:color[-_]?)?(?:text|foreground|body)\s*:\s*(#[0-9a-fA-F]{3,6})/i, key: 'text' },
  ]

  for (const { regex, key } of patterns) {
    const match = css.match(regex)
    if (match) colors[key] = match[1]
  }

  return colors
}

function extractFonts($: cheerio.CheerioAPI): Partial<typeof DEFAULT_FONTS> {
  const families: string[] = []

  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const match = href.match(/family=([^&]+)/)
    if (match) {
      decodeURIComponent(match[1])
        .split('|')
        .forEach((f) => {
          const name = f.split(':')[0].replace(/\+/g, ' ').trim()
          if (name) families.push(name)
        })
    }
  })

  const css = $('style').map((_, el) => $(el).text()).get().join('\n')
  for (const match of css.matchAll(/@import[^;]*fonts\.googleapis\.com[^;]*family=([^&;'"]+)/gi)) {
    decodeURIComponent(match[1])
      .split('|')
      .forEach((f) => {
        const name = f.split(':')[0].replace(/\+/g, ' ').trim()
        if (name) families.push(name)
      })
  }

  if (families.length === 0) return {}
  return { display: families[0], body: families[1] ?? families[0] }
}

function findSubpageLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const base = new URL(baseUrl)
  const links: string[] = []

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || ''
    try {
      const url = new URL(href, baseUrl)
      if (url.hostname !== base.hostname) return
      const path = url.pathname.toLowerCase()
      if (TARGET_PATHS.some((p) => path.includes(p))) links.push(url.href)
    } catch {}
  })

  return [...new Set(links)].slice(0, 3)
}

export interface SellerScrapeResult {
  text: string
  logoUrl: string | null
  fonts: typeof DEFAULT_FONTS
  colors: typeof DEFAULT_COLORS
}

export async function scrapeSeller(rawUrl: string): Promise<SellerScrapeResult> {
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`

  const homepageHtml = await fetchPage(url)
  if (!homepageHtml) {
    return { text: '', logoUrl: null, fonts: DEFAULT_FONTS, colors: DEFAULT_COLORS }
  }

  const $ = cheerio.load(homepageHtml)
  const logoUrl = extractLogo($, url)
  const colors = { ...DEFAULT_COLORS, ...extractColors($) }
  const fonts = { ...DEFAULT_FONTS, ...extractFonts($) }
  const subpageUrls = findSubpageLinks($, url)

  let allText = `[Homepage]\n${extractText($)}\n\n`

  const subpageResults = await Promise.allSettled(subpageUrls.map(fetchPage))
  for (let i = 0; i < subpageResults.length; i++) {
    const result = subpageResults[i]
    if (result.status === 'fulfilled' && result.value) {
      const sub$ = cheerio.load(result.value)
      const label = subpageUrls[i].replace(url, '') || '/page'
      allText += `[${label}]\n${extractText(sub$)}\n\n`
    }
  }

  return {
    text: allText.slice(0, MAX_TEXT_LENGTH),
    logoUrl,
    fonts,
    colors,
  }
}
