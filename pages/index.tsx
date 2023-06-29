import Head from 'next/head'
import { SearchInput } from '../utils/search-input'
import styled from 'styled-components'
import { Container, Stack, TopRight } from '../utils/styles'
import WalletButton from './walletButton'

export const SearchTitle = styled.div`
  display: flex;
  font-size: 1.875rem;
  font-weight: 100;
`

export default function Page() {
  return (
    <>
      <Head>
        <title>ANS</title>
      </Head>
      <TopRight><WalletButton/></TopRight>
      <Container>
        <Stack>
          <SearchTitle>{"Your web3 username"}</SearchTitle>
          <SearchInput/>
        </Stack>
      </Container>
    </>
  )
}