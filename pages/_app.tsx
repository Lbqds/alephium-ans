/* pages/_app.js */
import { AlephiumWalletProvider } from '../utils/alephium-wallet-provider'
import { AppProps } from 'next/app'
import { ANSProvider } from '../utils/ans-provider'

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <AlephiumWalletProvider>
          <ANSProvider>
            <Component {...pageProps} />
          </ANSProvider>
        </AlephiumWalletProvider>
    )
}

export default MyApp
