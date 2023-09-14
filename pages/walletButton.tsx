import { AlephiumConnectButton } from '@alephium/web3-react'
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
  return (
    <AlephiumConnectButton.Custom displayAccount={(account) => account.address}>
      {({ isConnected, show, disconnect }) => {
        return (
          isConnected ?
            <Button onClick={disconnect}>Disconnect</Button> :
            <Button onClick={show}>Connect</Button>
        )
      }}
    </AlephiumConnectButton.Custom>
  )
  
}

export default WalletButton
