import 'server-only'
import { anthropic } from './client'

export interface SellerProfileExtraction {
  company_name: string
  tagline: string
  services: { title: string; description: string }[]
  proof_points: { stat: string; label: string }[]
  testimonials: { quote: string; attribution: string }[]
}

const SYSTEM = `Extract structured company info from scraped website content. Preserve original language. Summarize only when content is excessive. Return valid JSON only — no preamble, no markdown.`

const schema = `{
  "company_name": "string",
  "tagline": "string",
  "services": [{ "title": "string", "description": "string" }],
  "proof_points": [{ "stat": "string", "label": "string" }],
  "testimonials": [{ "quote": "string", "attribution": "string" }]
}`

async function callLLM(text: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `SCRAPED CONTENT:\n${text}\n\nReturn JSON matching this schema. Use empty arrays if no data. company_name must be non-empty:\n${schema}`,
      },
    ],
  })
  return msg.content[0].type === 'text' ? msg.content[0].text : ''
}

export async function extractSellerProfile(rawText: string): Promise<SellerProfileExtraction> {
  let raw = await callLLM(rawText)

  try {
    return JSON.parse(raw)
  } catch {
    // Retry once with a stricter prompt
    raw = await callLLM(`Return ONLY valid JSON, nothing else:\n\n${rawText}`)
    return JSON.parse(raw)
  }
}
