import * as cheerio from 'cheerio'

const TIMEOUT_MS = 10_000
const CSS_TIMEOUT_MS = 5_000
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

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
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

const fetchPage = (url: string) => fetchWithTimeout(url, TIMEOUT_MS)

// Fetch up to 2 linked CSS stylesheets and return combined CSS text
async function fetchExternalCss($: cheerio.CheerioAPI, baseUrl: string): Promise<string> {
  const hrefs: string[] = []
  $('link[rel="stylesheet"][href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    try {
      const abs = new URL(href, baseUrl).href
      // Skip font provider stylesheets — we handle those separately
      if (!abs.includes('fonts.googleapis.com') && !abs.includes('fonts.gstatic.com')) {
        hrefs.push(abs)
      }
    } catch {}
  })

  const results = await Promise.allSettled(
    hrefs.slice(0, 2).map((href) => fetchWithTimeout(href, CSS_TIMEOUT_MS))
  )

  return results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value)
    .join('\n')
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
  // Prioritized selectors — header/nav first, then anywhere with "logo" in name
  const selectors = [
    'header img[class*="logo" i], header img[id*="logo" i], header img[alt*="logo" i]',
    'nav img[class*="logo" i], nav img[id*="logo" i], nav img[alt*="logo" i]',
    '[class*="logo" i] img, [id*="logo" i] img',
    '[class*="logo" i] svg use, [id*="logo" i] svg',
    'header a img:first-of-type, nav a img:first-of-type',
    // Also check src attribute containing "logo"
    'img[src*="logo" i]',
  ]
  for (const selector of selectors) {
    const el = $(selector).first()
    const src = el.attr('src') || el.attr('href') || el.attr('xlink:href')
    if (src && !src.startsWith('data:')) {
      try { return new URL(src, baseUrl).href } catch { continue }
    }
  }

  // Favicon as fallback (better than nothing — at least it's their brand mark)
  const favicon =
    $('link[rel="icon"][href]').first().attr('href') ||
    $('link[rel="shortcut icon"][href]').first().attr('href')
  if (favicon) { try { return new URL(favicon, baseUrl).href } catch {} }

  // og:image as absolute last resort
  const og = $('meta[property="og:image"]').attr('content')
  if (og) { try { return new URL(og, baseUrl).href } catch {} }

  return null
}

function extractColorsFromCss(css: string): Partial<typeof DEFAULT_COLORS> {
  const colors: Partial<typeof DEFAULT_COLORS> = {}

  const patterns: { regexes: RegExp[]; key: keyof typeof DEFAULT_COLORS }[] = [
    {
      key: 'primary',
      regexes: [
        /--(?:color[-_]?)?(?:primary|brand|main)\s*:\s*(#[0-9a-fA-F]{3,6})/i,
        /--(?:clr|c)[-_]?(?:primary|brand|main)\s*:\s*(#[0-9a-fA-F]{3,6})/i,
      ],
    },
    {
      key: 'accent',
      regexes: [
        /--(?:color[-_]?)?(?:accent|highlight|cta|secondary)\s*:\s*(#[0-9a-fA-F]{3,6})/i,
        /accent-color\s*:\s*(#[0-9a-fA-F]{3,6})/i,
      ],
    },
    {
      key: 'background',
      regexes: [
        /--(?:color[-_]?)?(?:background|bg|surface|base)\s*:\s*(#[0-9a-fA-F]{3,6})/i,
        /--(?:clr|c)[-_]?(?:bg|background)\s*:\s*(#[0-9a-fA-F]{3,6})/i,
      ],
    },
    {
      key: 'text',
      regexes: [
        /--(?:color[-_]?)?(?:text|foreground|body|copy)\s*:\s*(#[0-9a-fA-F]{3,6})/i,
        /--(?:clr|c)[-_]?(?:text|fg)\s*:\s*(#[0-9a-fA-F]{3,6})/i,
      ],
    },
  ]

  for (const { regexes, key } of patterns) {
    for (const regex of regexes) {
      const match = css.match(regex)
      if (match) { colors[key] = match[1]; break }
    }
  }

  return colors
}

function extractColors($: cheerio.CheerioAPI, externalCss = ''): Partial<typeof DEFAULT_COLORS> {
  const inlineCss = $('style').map((_, el) => $(el).text()).get().join('\n')
  // Inline CSS takes priority over external (more likely to be brand-specific)
  const inlineColors = extractColorsFromCss(inlineCss)
  const externalColors = extractColorsFromCss(externalCss)
  return { ...externalColors, ...inlineColors }
}

function extractFontFamiliesFromCss(css: string): string[] {
  const families: string[] = []

  // Google Fonts @import
  for (const match of css.matchAll(/@import[^;]*fonts\.googleapis\.com[^;]*family=([^&;'"]+)/gi)) {
    decodeURIComponent(match[1]).split('|').forEach((f) => {
      const name = f.split(':')[0].replace(/\+/g, ' ').trim()
      if (name) families.push(name)
    })
  }

  // @font-face family declarations (catches self-hosted and bundled fonts)
  for (const match of css.matchAll(/@font-face\s*\{[^}]*font-family\s*:\s*['"]?([^'";,}]+)['"]?/gi)) {
    const name = match[1].trim()
    if (name && !families.includes(name)) families.push(name)
  }

  return families
}

function extractFonts($: cheerio.CheerioAPI, externalCss = ''): Partial<typeof DEFAULT_FONTS> {
  const families: string[] = []

  // Google Fonts link tags
  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const match = href.match(/family=([^&]+)/)
    if (match) {
      decodeURIComponent(match[1]).split('|').forEach((f) => {
        const name = f.split(':')[0].replace(/\+/g, ' ').trim()
        if (name) families.push(name)
      })
    }
  })

  // Inline style tags
  const inlineCss = $('style').map((_, el) => $(el).text()).get().join('\n')
  extractFontFamiliesFromCss(inlineCss).forEach((f) => {
    if (!families.includes(f)) families.push(f)
  })

  // External CSS
  extractFontFamiliesFromCss(externalCss).forEach((f) => {
    if (!families.includes(f)) families.push(f)
  })

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
  const externalCss = await fetchExternalCss($, url)
  const logoUrl = extractLogo($, url)
  const colors = { ...DEFAULT_COLORS, ...extractColors($, externalCss) }
  const fonts = { ...DEFAULT_FONTS, ...extractFonts($, externalCss) }
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
