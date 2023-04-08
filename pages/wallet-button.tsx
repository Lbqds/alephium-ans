import { AlephiumConnectButton, useAlephiumConnectContext, useConnect } from '@alephium/web3-react'
import styled from 'styled-components'

const Button = styled.button`
  text-align: center;
  display: inline-block;
  border-radius: 10px;
  border: 2px solid #8AC007;
  width: 100px;
  height: 30px;
`

const WalletButton = () => {
  const context = useAlephiumConnectContext()
  const { connect, disconnect } = useConnect({
    chainGroup: context.addressGroup,
    keyType: context.keyType,
    networkId: context.network
  })

  return (
    <AlephiumConnectButton.Custom displayAccount={(account) => account.address}>
      {({ isConnected }) => {
        return (
          isConnected ?
            <Button onClick={disconnect}>Disconnect</Button> :
            <Button onClick={connect}>Connect</Button>
        )
      }}
    </AlephiumConnectButton.Custom>
  )
  
}

export default WalletButton
