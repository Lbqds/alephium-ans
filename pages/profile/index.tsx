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
  const [isAvailable, setAvailable] = useState<boolean>(false)
  const [error, setError] = useState<undefined | string>(undefined)
  const [owner, setOwner] = useState<undefined | string>(undefined)
  const [ttl, setTTL] = useState<undefined | number>(undefined)
  const ans = useANS()

  useEffect(() => {
    ans.isAvailable(name)
      .then((available) => {
        setAvailable(available)
        setLoading(false)
      })
      .catch((e) => {
        setLoading(false)
        setError(`${e}`)
      })
  }, [ans, name])

  useEffect(() => {
    if (isAvailable || isLoading) {
      return
    }

    ans.getRecord(name)
      .then((fields) => {
        setOwner(fields.owner)
        setTTL(Number(fields.ttl))
        setError(undefined)
      })
      .catch(e => {
        setError(`${e}`)
      })

  }, [ans, name, isAvailable, isLoading])

  if (!isLoading && !!isAvailable) {
    return <div><Name>{name}</Name> is available, click <Link href="/register">here</Link> to register</div>
  }

  return (
    <>
      {
        (error) ? (
          <div>Loading error: {error}</div>
        ) :(
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
  if (router.query.name === undefined) {
    return <></>
  }

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
