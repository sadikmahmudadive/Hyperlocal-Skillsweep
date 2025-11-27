import { AuthProvider } from '../contexts/AuthContext'
import AppLayout from '../components/layout/AppLayout'
import { ToastProvider } from '../contexts/ToastContext'
import ToastContainer from '../components/ui/ToastContainer'
import Head from 'next/head'
import '../styles/globals.css'
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { RefreshProvider } from '../contexts/RefreshContext'
import RefreshIndicator from '../components/ui/RefreshIndicator'

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <RefreshProvider>
          <AppLayout>
            <Head>
              <title>Hyperlocal SkillSwap</title>
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <meta name="theme-color" content="#16a34a" />
              <meta name="description" content="Swap skills with your neighbors — fast, friendly, and local." />
              <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
            </Head>
            <div className="page-enter">
              <Component {...pageProps} />
            </div>
            <Analytics />
            <SpeedInsights />
          </AppLayout>
          <RefreshIndicator />
          <ToastContainer />
        </RefreshProvider>
      </ToastProvider>
    </AuthProvider>
  )
}