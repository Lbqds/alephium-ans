import { ValAddress, ValU256 } from '@alephium/web3/dist/src/api/api-alephium'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import styled from 'styled-components'
import { useANS } from '../../utils/ans-provider'
import { Container } from '../../utils/styles'

const Name = styled.span`
  color: red;
  font-weight: bolder;
`

const Profile = styled.span`
  font-size: 1.6rem;
`

function ShowProfile({name}: {name: string}) {
  const [isLoading, setLoading] = useState(true)
  const [isAvailable, setAvailable] = useState<boolean | undefined>(undefined)
  const [error, setError] = useState<undefined | any>(undefined)
  const [owner, setOwner] = useState<undefined | string>(undefined)
  const [ttl, setTTL] = useState<undefined | number>(undefined)
  const ans = useANS()

  useEffect(() => {
    ans.isAvailable(name)
      .then((available) => setAvailable(available))
      .catch((e) => {
        setLoading(false)
        setError(e)
      })
  }, [ans, name])

  useEffect(() => {
    if (isAvailable) {
      setLoading(false)
      return
    }

    ans.getRecord(name)
      .then((fields) => {
        setOwner((fields[1] as ValAddress).value)
        setTTL(parseInt((fields[2] as ValU256).value))
        setLoading(false)
      })
      .catch(e => {
        setError(e)
        setLoading(false)
      })

  }, [ans, name, isAvailable])

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (isAvailable) {
    return <div><Name>{name}</Name> is available, click <Link href="/register">here</Link> to register</div>
  }

  return (
    <>
      {
        (error) ? (
          <div>Loading error: {error}</div>
        ) : (
          <div>
            <p>Owner: {owner}</p>
            <p>Expires: {new Date(ttl as number).toUTCString()}</p>
          </div>
        )
      }
    </>
  )
}

export default function Page() {
  const router = useRouter()
  const name = router.query.name as string

  return (
    <>
      <Head>
        <title>{name}</title>
        <meta name="description" content={name + "'s profile on ANS"} />
      </Head>
      <Container>
        <Profile>
          <ShowProfile name={name}/>
        </Profile>
      </Container>
    </>
  )
}
