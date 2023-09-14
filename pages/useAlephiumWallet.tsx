import { SignerProvider, Address, groupOfAddress, web3, NodeProvider } from '@alephium/web3'
import { useWallet } from '@alephium/web3-react'
import { useMemo } from 'react'

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

export default function useAlephiumWallet() {
  const wallet = useWallet()

  return useMemo(() => {
    if (wallet.signer?.nodeProvider === undefined) {
      return undefined
    }
    web3.setCurrentNodeProvider(wallet.signer.nodeProvider)
    if (wallet.account !== undefined) {
      return new AlephiumWallet(wallet.signer, wallet.account.address, wallet.signer.nodeProvider)
    }
    return undefined
  }, [wallet])
}
