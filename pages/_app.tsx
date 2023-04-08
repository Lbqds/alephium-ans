/* pages/_app.js */
import { AlephiumConnectProvider } from '@alephium/web3-react'
import { AppProps } from 'next/app'
import { ANSProvider } from '../utils/ans-provider'

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <AlephiumConnectProvider>
          <ANSProvider>
            <Component {...pageProps} />
          </ANSProvider>
        </AlephiumConnectProvider>
    )
}

export default MyApp
