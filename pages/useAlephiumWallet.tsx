import { SignerProvider, Address, groupOfAddress, web3, NodeProvider } from '@alephium/web3'
import { useMemo } from 'react'
import { useAlephiumConnectContext } from "@alephium/web3-react"

export class AlephiumWallet {
  signer: SignerProvider
  address: Address
  group: number
  nodeProvider: NodeProvider

  constructor(signerProvider: SignerProvider, address: Address, nodeProvider: NodeProvider) {
    this.signer = signerProvider
    this.address = address
    this.group = groupOfAddress(address)
    this.nodeProvider = nodeProvider
  }
}

export function useAlephiumWallet() {
  const context = useAlephiumConnectContext()

  return useMemo(() => {
    if (context.signerProvider?.nodeProvider === undefined) {
      return undefined
    }
    web3.setCurrentNodeProvider(context.signerProvider.nodeProvider)
    if (context.account !== undefined) {
      return new AlephiumWallet(context.signerProvider, context.account.address, context.signerProvider.nodeProvider)
    }
    return undefined
  }, [context])
}
