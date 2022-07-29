import { useRouter } from 'next/router'
import {
  useEffect,
  useCallback,
  useRef,
  useState
} from 'react'
import styled from 'styled-components'
import { validateName } from './ans-provider'

const Input = styled.input`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 500px;
  height: 40px;
  font-size: 1.6rem;
  ::placeholder {
    font-size: 1.6rem;
  }
`

const ShowError = styled.div`
  font-size: 1.6rem
`

// TODO: support search by address
export const SearchInput = () => {
  const router = useRouter()

  const [inputVal, setInputVal] = useState('')
  const [error, setError] = useState<any>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const handleSearch = useCallback(() => {
    const path = `/profile/${inputVal}`
    setInputVal('')
    searchInputRef.current?.blur()
    router.push(
      {
        pathname: path,
        query: {
          from: router.asPath,
        },
      },
      path,
    )
  }, [inputVal, searchInputRef, router])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        try {
          validateName(inputVal)
        } catch (e) {
          setError(String(e))
          return
        }
        return handleSearch()
      }
  }, [handleSearch, inputVal])

  useEffect(() => {
    const searchInput = searchInputRef.current
    searchInput?.addEventListener('keydown', handleKeyDown)
    return () => {
      searchInput?.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, searchInputRef])

  useEffect(() => {
    if (inputVal) {
      setError(null)
    }
  }, [inputVal])

  return (
    <>
      <Input
        ref={searchInputRef}
        placeholder='Search for a name'
        onChange={(e) => setInputVal(e.target.value)}
      />
      {error && <ShowError>Invalid input: {error}</ShowError>}
    </>
  )
}
