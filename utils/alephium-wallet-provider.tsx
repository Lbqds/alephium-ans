import WalletConnectClient, { CLIENT_EVENTS } from '@walletconnect/client'
import { PairingTypes, AppMetadata } from '@walletconnect/types'
import WalletConnectProvider from '@alephium/walletconnect-provider'
import QRCodeModal from "@walletconnect/legacy-modal"
import { NodeProvider, Account, NodeWallet } from '@alephium/web3'
import { Context, createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { testWallet } from '@alephium/web3/test'
// @ts-ignore
import AlephiumConfigs from '../configs/alephium-configs'

type NodeWalletProviderType = {
  walletName: string
  password: string
}

type WalletConnectProviderType = {
  projectId: string
  relayUrl: string
  metadata: AppMetadata,
  networkId: number
  chainGroup: number
}

type SignerProviderType = NodeWalletProviderType | WalletConnectProviderType

interface EnvironmentConfig<T extends SignerProviderType> {
    nodeUrl: string
    signerProvider: T
}

function getConfig<T extends SignerProviderType>(name: string): EnvironmentConfig<T> {
    const environments: Map<string, EnvironmentConfig<T>> = AlephiumConfigs.environments
    // @ts-ignore
    return environments[name]
}

export class AlephiumWalletSigner {
  signerProvider: WalletConnectProvider | NodeWallet
  account: Account
  nodeProvider: NodeProvider

  constructor(wallet: WalletConnectProvider | NodeWallet, account: Account, nodeUrl: string) {
    this.signerProvider = wallet
    this.account = account
    this.nodeProvider = new NodeProvider(nodeUrl)
  }
}

export interface AlephiumWallet {
  connect(): void
  disconnect(): void
  signer: AlephiumWalletSigner | undefined
  uri?: string
}

// @ts-ignore
export const WalletContext: Context<AlephiumWallet> = createContext<AlephiumWallet>()

export function useAlephiumWallet(): AlephiumWallet {
  return useContext(WalletContext)
}

function GetWalletConnectProvider(config: EnvironmentConfig<WalletConnectProviderType>) {
  const [uri, setUri] = useState<string | undefined>(undefined)
  const [provider, setProvider] = useState<WalletConnectProvider | undefined>(undefined)
  const [accounts, setAccounts] = useState<Account[]>([])
  const connect = useCallback(async () => {
    const walletConnect = await WalletConnectClient.init({
      projectId: config.signerProvider.projectId,
      relayUrl: config.signerProvider.relayUrl,
      metadata: config.signerProvider.metadata
    })

    const provider = new WalletConnectProvider({
      networkId: config.signerProvider.networkId,
      chainGroup: config.signerProvider.chainGroup,
      client: walletConnect
    })

    walletConnect.on(CLIENT_EVENTS.pairing.proposal, async (proposal: PairingTypes.Proposal) => {
      const { uri } = proposal.signal.params
      setUri(uri)
      QRCodeModal.open(uri, () => {
        console.log("QR code modal closed")
      })
    })

    walletConnect.on(CLIENT_EVENTS.session.deleted, () => {})
    walletConnect.on(CLIENT_EVENTS.session.sync, () => {
      setUri(undefined)
    })

    provider.on('accountsChanged', (accounts: Account[]) => {
      setUri(undefined)
      setAccounts(accounts)
    })

    await provider.connect()
    setProvider(provider)
    QRCodeModal.close()
  }, [config])

  const disconnect = useCallback(async () => {
    await provider?.disconnect()
    setProvider(undefined)
    setAccounts([])
  }, [provider])

  return useMemo(() => ({
    connect: connect,
    disconnect: disconnect,
    signer: provider ? new AlephiumWalletSigner(provider, accounts[0], config.nodeUrl) : undefined,
    uri: uri
  }), [
    connect,
    disconnect,
    provider,
    accounts,
    uri,
    config
  ])
}

function GetNodeWalletProvider(config: EnvironmentConfig<NodeWalletProviderType>) {
  const [signer, setSigner] = useState<AlephiumWalletSigner>()
  const nodeProvider = useMemo(() => new NodeProvider(config.nodeUrl), [config])
  const connect = useCallback(async () => {
    const wallet = await testWallet(nodeProvider)
    const accounts = await wallet.getAccounts()
    setSigner(new AlephiumWalletSigner(wallet, accounts[0], config.nodeUrl))
  }, [nodeProvider, config])
  const disconnect = useCallback(() => setSigner(undefined), [])
  return useMemo(() => ({
    connect: connect,
    disconnect: disconnect,
    signer: signer,
    uri: config.nodeUrl
  }), [connect, disconnect, signer, config])
}

export const AlephiumWalletProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const walletType = process.env.ENVIRONMENT || "development-nodewallet"
  let wallet: AlephiumWallet
  if (walletType === "development-walletconnect") {
    const config = getConfig<WalletConnectProviderType>(walletType)
    wallet = GetWalletConnectProvider(config)
  } else if (walletType === "development-nodewallet") {
    const config = getConfig<NodeWalletProviderType>(walletType)
    wallet = GetNodeWalletProvider(config)
  } else {
    throw Error("invalid wallet provider type: " + walletType)
  }

  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>
}