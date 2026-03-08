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

function resolveUrl(href: string, baseUrl: string): string | null {
  if (!href || href.startsWith('data:')) return null
  try { return new URL(href, baseUrl).href } catch { return null }
}

// Returns either a URL string or raw HTML markup (for inline SVGs).
// Callers must check: logoContent.startsWith('<') → render as HTML, else as img src.
function extractLogo($: cheerio.CheerioAPI, baseUrl: string): string | null {
  // 1. Look for logo containers that may hold one or more inline SVGs
  const containerSelectors = [
    'header a', 'nav a',
    'header [class*="logo" i], nav [class*="logo" i]',
    '[class*="logo" i]', '[id*="logo" i]',
    '[class*="brand" i]',
  ]
  for (const selector of containerSelectors) {
    const container = $(selector).first()
    if (!container.length) continue
    const svgs = container.find('svg')
    if (svgs.length > 0) {
      // Serialize the full container innerHTML — captures icon + wordmark combos
      const html = container.html()?.trim()
      if (html && html.length > 50) return html
    }
  }

  // 2. Standalone inline SVG anywhere in header/nav
  const standaloneSvg = $('header svg, nav svg').first()
  if (standaloneSvg.length) {
    const html = $.html(standaloneSvg)
    if (html && html.length > 50) return html
  }

  // 3. Linked image/SVG — img, object, embed
  const linkedSelectors = [
    'header img[class*="logo" i], header img[id*="logo" i], header img[alt*="logo" i]',
    'nav img[class*="logo" i], nav img[id*="logo" i], nav img[alt*="logo" i]',
    '[class*="logo" i] img, [id*="logo" i] img',
    'header a img:first-of-type, nav a img:first-of-type',
    'img[src*="logo" i]',
    'header object[data$=".svg"], nav object[data$=".svg"]',
    '[class*="logo" i] object[data]',
  ]
  for (const selector of linkedSelectors) {
    const el = $(selector).first()
    const src = el.attr('src') || el.attr('data')
    const resolved = src ? resolveUrl(src, baseUrl) : null
    if (resolved) return resolved
  }

  // 4. Favicon fallback
  const favicon =
    $('link[rel="icon"][href]').first().attr('href') ||
    $('link[rel="shortcut icon"][href]').first().attr('href')
  if (favicon) { const r = resolveUrl(favicon, baseUrl); if (r) return r }

  // 5. og:image last resort
  const og = $('meta[property="og:image"]').attr('content')
  if (og) { const r = resolveUrl(og, baseUrl); if (r) return r }

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

// Generic/system font names to exclude
const GENERIC_FONTS = new Set([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
  '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Helvetica Neue',
  'Helvetica', 'Arial', 'inherit', 'initial', 'unset', 'normal',
])

// Extract named fonts from CSS, ranked by how frequently they appear.
// Frequency = brand signal: a font used 20 times is almost certainly intentional.
function extractFontFamiliesFromCss(css: string): string[] {
  const counts = new Map<string, number>()

  // 1. Google Fonts @import — highest confidence
  for (const match of css.matchAll(/@import[^;]*fonts\.googleapis\.com[^;]*family=([^&;'"]+)/gi)) {
    decodeURIComponent(match[1]).split('|').forEach((f) => {
      const name = f.split(':')[0].replace(/\+/g, ' ').trim()
      if (name && !GENERIC_FONTS.has(name)) counts.set(name, (counts.get(name) ?? 0) + 100)
    })
  }

  // 2. @font-face declarations — self-hosted or CDN fonts
  for (const match of css.matchAll(/@font-face\s*\{[^}]*font-family\s*:\s*['"]?([^'";,}\n]+)['"]?/gi)) {
    const name = match[1].trim().replace(/^['"]|['"]$/g, '')
    if (name && !GENERIC_FONTS.has(name)) counts.set(name, (counts.get(name) ?? 0) + 50)
  }

  // 3. font-family rule declarations — frequency reveals actual brand fonts
  for (const match of css.matchAll(/font-family\s*:\s*((?:['"][^'"]+['"]|[\w\s-]+)(?:\s*,\s*(?:['"][^'"]+['"]|[\w\s-]+))*)/gi)) {
    // Take only the first font in the stack (the preferred one)
    const first = match[1].split(',')[0].trim().replace(/^['"]|['"]$/g, '').trim()
    if (first && !GENERIC_FONTS.has(first) && first.length < 60) {
      counts.set(first, (counts.get(first) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
}

function extractFonts($: cheerio.CheerioAPI, externalCss = ''): Partial<typeof DEFAULT_FONTS> {
  // Google Fonts link tags — parse directly (most explicit signal)
  const linkFamilies: string[] = []
  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    const match = href.match(/family=([^&]+)/)
    if (match) {
      decodeURIComponent(match[1]).split('|').forEach((f) => {
        const name = f.split(':')[0].replace(/\+/g, ' ').trim()
        if (name) linkFamilies.push(name)
      })
    }
  })
  if (linkFamilies.length >= 2) {
    return { display: linkFamilies[0], body: linkFamilies[1] }
  }

  // Fall back to CSS analysis across inline + external
  const inlineCss = $('style').map((_, el) => $(el).text()).get().join('\n')
  const allFamilies = extractFontFamiliesFromCss(inlineCss + '\n' + externalCss)

  const families = [...new Set([...linkFamilies, ...allFamilies])]
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
