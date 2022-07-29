import styled from 'styled-components'
import { useAlephiumWallet } from '../utils/alephium-wallet-provider'

const Button = styled.button`
  text-align: center;
  display: inline-block;
  border-radius: 10px;
  border: 2px solid #8AC007;
  width: 100px;
  height: 30px;
`

const WalletButton = () => {
  const { connect, disconnect, signer } = useAlephiumWallet()
  const connected = !!signer

  return (
    connected ?
      <Button onClick={disconnect}>Disconnect</Button> :
      <Button onClick={connect}>Connect</Button>
  )
}

export default WalletButton
