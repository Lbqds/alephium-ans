import { binToHex, DUST_AMOUNT, ONE_ALPH, SignerProvider, SignExecuteScriptTxResult } from '@alephium/web3'
import Head from 'next/head'
import { useCallback, useRef, useState } from 'react'
import styled from "styled-components"
import { Config, normalize, validateName } from '../utils/ans-provider'
import { Container, Stack, TopRight } from "../utils/styles"
import { Register as RegisterANS } from '../artifacts/ts/scripts'
import WalletButton from './wallet-button'
import { useAlephiumWallet } from './useAlephiumWallet'

const Input = styled.input`
  width: 300px;
  height: 40px;
  font-size: 1.6rem;
  ::placeholder {
    font-size: 1.6rem;
    color: darkgray;
  }
`

const Button = styled.button`
  width: 180px;
  height: 40px;
  font-size: 1rem;
  background-color: lightblue;
`

const Notification = styled.div`
  font-size: 1.6rem
`

async function register(
  signerProvider: SignerProvider,
  name: string,
  rentalPeriod: number
) {
  const rentalPeriodMs = rentalPeriod * 30 * 24 * 3600 * 1000
  return RegisterANS.execute(signerProvider, {
    initialFields: {
      registrar: Config.registrarId,
      name: binToHex(normalize(name)),
      rentalPeriod: BigInt(rentalPeriodMs),
      resolver: Config.defaultResolverId
    },
    attoAlphAmount: ONE_ALPH + DUST_AMOUNT * 2n
  })
}

function validateRentalPeriod(input: string): number {
  if (input === '') {
    throw Error('Empty rental period')
  }
  const period = Number(input)
  if (isNaN(period)) {
    throw Error('Invalid rental period')
  }
  return period
}

export default function Register() {
  const [name, setName] = useState('')
  const [rentalPeriod, setRentalPeriod] = useState('')
  const [error, setError] = useState<any>(null)
  const [registerError, setRegisterError] = useState(undefined)
  const [disable, setDisable] = useState(false)
  const [submitTxResult, setSubmitTxResult] = useState<SignExecuteScriptTxResult | undefined>(undefined)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const rentalPeriodInputRef = useRef<HTMLInputElement>(null)
  const wallet = useAlephiumWallet()

  const handleRegister = useCallback(() => {
    let period: number
    try {
      validateName(name)
      period = validateRentalPeriod(rentalPeriod)
      if (wallet === undefined) {
        throw Error('Wallet not connected')
      }
    } catch (e) {
      setError(String(e))
      return
    }

    setError(null)
    register(
      wallet.signer,
      name,
      period
    ).then((result) => {
      setDisable(true)
      setSubmitTxResult(result)
    }).catch((e) => {
      setDisable(true)
      setRegisterError(e)
    })
  }, [name, rentalPeriod, wallet])

  return (
    <>
      <Head>
        <title>register</title>
      </Head>
      <TopRight><WalletButton/></TopRight>
      <Container>
        <Stack>
          <Input
            ref={nameInputRef}
            placeholder='Name'
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            ref={rentalPeriodInputRef}
            placeholder="Rental period(month)"
            onChange={(e) => setRentalPeriod(e.target.value)}
          />
          <Button onClick={() => handleRegister()} disabled={disable}>
            Register
          </Button>
          {error && <Notification>{error}</Notification>}
          {registerError && <Notification>Name registered failed: {registerError}</Notification>}
          {submitTxResult && <Notification>Name registered succeed, transaction id: {submitTxResult.txId}</Notification>}
        </Stack>
      </Container>
    </>
  )
}
