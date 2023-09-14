/* pages/_app.js */
import { AlephiumWalletProvider } from '@alephium/web3-react'
import { AppProps } from 'next/app'
import { ANSProvider, Config } from '../utils/ans-provider'

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <AlephiumWalletProvider network={Config.network}>
          <ANSProvider>
            <Component {...pageProps} />
          </ANSProvider>
        </AlephiumWalletProvider>
    )
}

export default MyApp
