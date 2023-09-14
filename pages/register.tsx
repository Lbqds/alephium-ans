import { binToHex, DUST_AMOUNT, ONE_ALPH, SignerProvider, SignExecuteScriptTxResult } from '@alephium/web3'
import Head from 'next/head'
import { useCallback, useRef, useState } from 'react'
import styled from "styled-components"
import { Config, normalize, validateName } from '../utils/ans-provider'
import { Container, Stack, TopRight } from "../utils/styles"
import { RegisterPrimaryRecord as RegisterANS } from '../artifacts/ts/scripts'
import WalletButton from './walletButton'
import useAlephiumWallet from './useAlephiumWallet'

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

function cost(duration: bigint): bigint {
  return 1000n * duration
}

async function register(signerProvider: SignerProvider, name: string, months: number) {
  const duration = BigInt(months) * 30n * 24n * 3600n * 1000n
  const alphAmount = ONE_ALPH * 2n + cost(duration) + DUST_AMOUNT * 2n
  return RegisterANS.execute(signerProvider, {
    initialFields: {
      registrar: Config.primaryRegistrarId,
      name: binToHex(normalize(name)),
      duration
    },
    attoAlphAmount: alphAmount
  })
}

function validateMonths(input: string): number {
  if (input === '') {
    throw Error('Empty rental months')
  }
  const months = Number(input)
  if (isNaN(months)) {
    throw Error('Invalid rental months')
  }
  return months
}

export default function Register() {
  const [name, setName] = useState('')
  const [months, setMonths] = useState('')
  const [error, setError] = useState<any>(null)
  const [registerError, setRegisterError] = useState(undefined)
  const [disable, setDisable] = useState(false)
  const [submitTxResult, setSubmitTxResult] = useState<SignExecuteScriptTxResult | undefined>(undefined)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const monthsInputRef = useRef<HTMLInputElement>(null)
  const wallet = useAlephiumWallet()

  const handleRegister = useCallback(() => {
    let duration: number
    try {
      validateName(name)
      duration = validateMonths(months)
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
      duration
    ).then((result) => {
      setDisable(true)
      setSubmitTxResult(result)
    }).catch((e) => {
      setDisable(true)
      setRegisterError(e)
    })
  }, [name, wallet, months])

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
            ref={monthsInputRef}
            placeholder='Rental months'
            onChange={(e) => setMonths(e.target.value)}
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
