import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white">
      <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-4">Avolor</h1>
      <p className="text-gray-500 mb-8">Personalized pitch microsites, generated in seconds.</p>
      <Link
        href="/login"
        className="px-6 py-3 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
      >
        Go to app
      </Link>
    </main>
  )
}
