import { Address, addressFromContractId, binToHex, subContractId, web3 } from "@alephium/web3"
import { randomBytes } from "crypto"
import {
  alph,
  defaultInitialAsset,
  randomAssetAddress,
  subContractAddress,
  getContractState,
  buildProject,
  DefaultGroup,
  createAccountResolver,
  ErrorCodes,
  createPrimaryRegistrar,
  createPrimaryRecord
} from "./fixtures/ANSFixture"
import * as base58 from 'bs58'
import { AccountResolver, AccountResolverTypes, AccountInfo, AccountInfoTypes } from "../artifacts/ts"
import { expectAssertionError } from "@alephium/web3-test"

describe("test default resolver", () => {
  beforeAll(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
    await buildProject()
  })

  function createAccountInfo(resolver: string, pubkey: string, address: Address, contractAddress: string): AccountInfoTypes.State {
    return AccountInfo.stateForTest(
      { resolver, pubkey, address },
      defaultInitialAsset,
      contractAddress,
    )
  }

  it('should create new record info', async () => {
    const registrarFixture = createPrimaryRegistrar(randomAssetAddress())
    const resolverFixture = createAccountResolver(registrarFixture)
    const node = binToHex(randomBytes(4))
    const nodeOwner = randomAssetAddress()
    const record = createPrimaryRecord(subContractAddress(registrarFixture.contractId, node, DefaultGroup), nodeOwner)
    const pubkey = binToHex(randomBytes(32))
    const address = randomAssetAddress()

    async function newAccountInfo(caller: string) {
      return await AccountResolver.tests.newAccountInfo({
        address: resolverFixture.address,
        initialFields: resolverFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: caller, asset: { alphAmount: alph(2) } }],
        testArgs: { node, payer: nodeOwner, pubkey, address  },
        existingContracts: [record, ...resolverFixture.states()]
      })
    }

    await expectAssertionError(newAccountInfo(randomAssetAddress()), resolverFixture.address, Number(ErrorCodes.InvalidCaller))

    const result = await newAccountInfo(nodeOwner)
    const accountInfoId = subContractId(resolverFixture.contractId, node, 0)
    const accountInfoState = getContractState<AccountInfoTypes.Fields>(result.contracts, accountInfoId)
    expect(accountInfoState.fields.pubkey).toEqual(pubkey)
    expect(accountInfoState.fields.address).toEqual(address)
    expect(result.events.length).toEqual(2)

    const event = result.events[1] as AccountResolverTypes.NewAccountInfoCreatedEvent
    expect(event.fields.node).toEqual(node)
    expect(event.fields.pubkey).toEqual(pubkey)
    expect(event.fields.address).toEqual(address)
  })

  it('should set/get address', async () => {
    const registrarFixture = createPrimaryRegistrar(randomAssetAddress())
    const resolverFixture = createAccountResolver(registrarFixture)
    const nodeOwner = randomAssetAddress()
    const node = binToHex(randomBytes(4))
    const record = createPrimaryRecord(subContractAddress(registrarFixture.contractId, node, DefaultGroup), nodeOwner)

    const contractId = subContractId(resolverFixture.contractId, node, DefaultGroup)

    async function setAddress(caller: string, address: Address, accountInfoOpt?: AccountInfoTypes.State) {
      const accountInfo = accountInfoOpt ?? createAccountInfo(resolverFixture.selfState.contractId, '', '', addressFromContractId(contractId))
      const result = await AccountResolver.tests.setAddress({
        address: resolverFixture.address,
        initialFields: resolverFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: caller, asset: { alphAmount: alph(2) } }],
        testArgs: { node, address },
        existingContracts: [record, accountInfo, ...resolverFixture.dependencies]
      })
      expect(result.events.length).toEqual(1)
      const event = result.events[0] as AccountResolverTypes.AddressUpdatedEvent
      expect(event.fields.node).toEqual(node)
      expect(event.fields.newAddress).toEqual(address)
      return getContractState<AccountInfoTypes.Fields>(result.contracts, contractId)
    }

    async function getAddress(accountInfo: AccountInfoTypes.State) {
      const result = await AccountResolver.tests.getAddress({
        address: resolverFixture.address,
        initialFields: resolverFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        testArgs: { node },
        existingContracts: [record, accountInfo, ...resolverFixture.dependencies]
      })
      return result.returns
    }

    const alphAddress = randomAssetAddress()
    await expectAssertionError(
      setAddress(randomAssetAddress(), alphAddress),
      resolverFixture.address,
      Number(ErrorCodes.InvalidCaller)
    )

    const accontInfoState0 = await setAddress(nodeOwner, alphAddress)
    expect(await getAddress(accontInfoState0)).toEqual(alphAddress)

    const newAlphAddress = binToHex(base58.decode(randomAssetAddress()))
    const accountInfoState1 = await setAddress(nodeOwner, newAlphAddress, accontInfoState0)
    expect(await getAddress(accountInfoState1)).toEqual(newAlphAddress)
  })

  it('should set/get pubkey', async () => {
    const registrarFixture = createPrimaryRegistrar(randomAssetAddress())
    const resolverFixture = createAccountResolver(registrarFixture)
    const nodeOwner = randomAssetAddress()
    const node = binToHex(randomBytes(4))
    const record = createPrimaryRecord(subContractAddress(registrarFixture.contractId, node, DefaultGroup), nodeOwner)

    const contractId = subContractId(resolverFixture.contractId, node, DefaultGroup)
    async function setPubkey(caller: string, pubkey: string, accountInfoOpt?: AccountInfoTypes.State) {
      const accountInfo = accountInfoOpt ?? createAccountInfo(resolverFixture.selfState.contractId, '', '', addressFromContractId(contractId))
      const result = await AccountResolver.tests.setPubkey({
        address: resolverFixture.address,
        initialFields: resolverFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: caller, asset: { alphAmount: alph(2) } }],
        testArgs: { node, pubkey },
        existingContracts: [record, accountInfo, ...resolverFixture.dependencies]
      })
      const accountInfoState = getContractState<AccountInfoTypes.Fields>(result.contracts, contractId)
      expect(accountInfoState.fields.pubkey).toEqual(pubkey)
      expect(result.events.length).toEqual(1)
      const event = result.events[0] as AccountResolverTypes.PubkeyUpdatedEvent
      expect(event.fields.node).toEqual(node)
      expect(event.fields.newPubkey).toEqual(pubkey)
      return accountInfoState
    }

    async function getPubkey(accountInfo: AccountInfoTypes.State) {
      const result = await AccountResolver.tests.getPubkey({
        address: resolverFixture.address,
        initialFields: resolverFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        testArgs: { node },
        existingContracts: [record, accountInfo, ...resolverFixture.dependencies]
      })
      return result.returns
    }

    const pubkey = binToHex(randomBytes(32))
    await expectAssertionError(setPubkey(randomAssetAddress(), pubkey), resolverFixture.address, Number(ErrorCodes.InvalidCaller))

    const accountInfoState0 = await setPubkey(nodeOwner, pubkey)
    expect(await getPubkey(accountInfoState0)).toEqual(pubkey)

    const newPubKey = binToHex(randomBytes(32))
    const accountInfoState1 = await setPubkey(nodeOwner, newPubKey, accountInfoState0)
    expect(await getPubkey(accountInfoState1)).toEqual(newPubKey)
  })
})