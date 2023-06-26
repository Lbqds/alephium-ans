import { addressFromContractId, binToHex, subContractId, web3 } from "@alephium/web3"
import { randomBytes } from "crypto"
import {
  alph,
  createANSRegistry,
  createRecord,
  defaultInitialAsset,
  randomAssetAddress,
  subContractAddress,
  getContractState,
  buildProject,
  DefaultGroup,
  createDefaultResolver,
  ErrorCodes
} from "./fixtures/ANSFixture"
import * as base58 from 'bs58'
import { DefaultResolver, DefaultResolverTypes, RecordInfo, RecordInfoTypes } from "../artifacts/ts"
import { expectAssertionError } from "@alephium/web3-test"

describe("test default resolver", () => {
  const AlphChainId = 1234
  const EthChainId = 60

  beforeAll(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
    await buildProject()
  })

  function createRecordInfo(resolver: string, pubkey: string, addresses: string, contractAddress: string): RecordInfoTypes.State {
    return RecordInfo.stateForTest(
      { resolver, pubkey, addresses },
      defaultInitialAsset,
      contractAddress,
    )
  }

  it('should create new record info', async () => {
    const ansRegistryFixture = createANSRegistry(randomAssetAddress())
    const resolverFixture = createDefaultResolver(ansRegistryFixture)
    const node = binToHex(randomBytes(4))
    const nodeOwner = randomAssetAddress()
    const record = createRecord({
      registrar: '',
      owner: nodeOwner,
      ttl: 0n,
      resolver: '',
      refundAddress: nodeOwner
    }, subContractAddress(ansRegistryFixture.contractId, node, DefaultGroup))
    const pubkey = binToHex(randomBytes(32))
    const addresses = binToHex(randomBytes(33))

    async function newRecordInfo(caller: string) {
      return await DefaultResolver.tests.newRecordInfo({
        address: resolverFixture.address,
        initialFields: resolverFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: caller, asset: { alphAmount: alph(2) } }],
        testArgs: { node, payer: nodeOwner, pubkey, addresses  },
        existingContracts: [record, ...resolverFixture.states()]
      })
    }

    await expectAssertionError(newRecordInfo(randomAssetAddress()), resolverFixture.address, Number(ErrorCodes.InvalidCaller))

    const result = await newRecordInfo(nodeOwner)
    const recordInfoId = subContractId(resolverFixture.contractId, node, 0)
    const recordInfoState = getContractState<RecordInfoTypes.Fields>(result.contracts, recordInfoId)
    expect(recordInfoState.fields.pubkey).toEqual(pubkey)
    expect(recordInfoState.fields.addresses).toEqual(addresses)
    expect(result.events.length).toEqual(2)

    const event = result.events[1] as DefaultResolverTypes.NewRecordInfoCreatedEvent
    expect(event.fields.node).toEqual(node)
    expect(event.fields.pubkey).toEqual(pubkey)
    expect(event.fields.addresses).toEqual(addresses)
  })

  it('should set/get addresses', async () => {
    const ansRegistryFixture = createANSRegistry(randomAssetAddress())
    const resolverFixture = createDefaultResolver(ansRegistryFixture)
    const ansRegistryId = ansRegistryFixture.contractId
    const nodeOwner = randomAssetAddress()
    const node = binToHex(randomBytes(4))
    const record = createRecord({
      registrar: '',
      owner: nodeOwner,
      ttl: 0n,
      resolver: '',
      refundAddress: nodeOwner
    }, subContractAddress(ansRegistryId, node, DefaultGroup))

    const contractId = subContractId(resolverFixture.contractId, node, DefaultGroup)

    async function setAddress(caller: string, chainId: number, address: string, recordInfoOpt?: RecordInfoTypes.State) {
      const recordInfo = recordInfoOpt ?? createRecordInfo(resolverFixture.selfState.contractId, '', '', addressFromContractId(contractId))
      const result = await DefaultResolver.tests.setAddress({
        address: resolverFixture.address,
        initialFields: resolverFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: caller, asset: { alphAmount: alph(2) } }],
        testArgs: { node, chainId: BigInt(chainId), address },
        existingContracts: [record, recordInfo, ...resolverFixture.dependencies]
      })
      expect(result.events.length).toEqual(1)
      const event = result.events[0] as DefaultResolverTypes.AddressUpdatedEvent
      expect(event.fields.node).toEqual(node)
      expect(event.fields.chainId).toEqual(BigInt(chainId))
      expect(event.fields.newAddress).toEqual(address)
      return getContractState<RecordInfoTypes.Fields>(result.contracts, contractId)
    }

    async function getAddress(chainId: number, recordInfo: RecordInfoTypes.State) {
      const result = await DefaultResolver.tests.getAddress({
        address: resolverFixture.address,
        initialFields: resolverFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        testArgs: { node, chainId: BigInt(chainId) },
        existingContracts: [record, recordInfo, ...resolverFixture.dependencies]
      })
      return result.returns
    }

    const alphAddress = binToHex(base58.decode(nodeOwner))
    await expectAssertionError(
      setAddress(randomAssetAddress(), AlphChainId, alphAddress),
      resolverFixture.address,
      Number(ErrorCodes.InvalidCaller)
    )

    const recordInfoState0 = await setAddress(nodeOwner, AlphChainId, alphAddress)
    expect(await getAddress(AlphChainId, recordInfoState0)).toEqual(alphAddress)

    const newAlphAddress = binToHex(base58.decode(randomAssetAddress()))
    const recordInfoState1 = await setAddress(nodeOwner, AlphChainId, newAlphAddress, recordInfoState0)
    expect(await getAddress(AlphChainId, recordInfoState1)).toEqual(newAlphAddress)

    const ethAddress = binToHex(randomBytes(20))
    const recordInfoState2 = await setAddress(nodeOwner, EthChainId, ethAddress, recordInfoState1)
    expect(await getAddress(AlphChainId, recordInfoState2)).toEqual(newAlphAddress)
    expect(await getAddress(EthChainId, recordInfoState2)).toEqual(ethAddress)
  })

  it('should set pubkey', async () => {
    const ansRegistryFixture = createANSRegistry(randomAssetAddress())
    const resolverFixture = createDefaultResolver(ansRegistryFixture)
    const ansRegistryId = ansRegistryFixture.contractId
    const nodeOwner = randomAssetAddress()
    const node = binToHex(randomBytes(4))
    const record = createRecord({
      registrar: '',
      owner: nodeOwner,
      ttl: 0n,
      resolver: '',
      refundAddress: nodeOwner
    }, subContractAddress(ansRegistryId, node, DefaultGroup))

    const contractId = subContractId(resolverFixture.contractId, node, DefaultGroup)
    async function setPubkey(caller: string, pubkey: string, recordInfoOpt?: RecordInfoTypes.State) {
      const recordInfo = recordInfoOpt ?? createRecordInfo(resolverFixture.selfState.contractId, '', '', addressFromContractId(contractId))
      const result = await DefaultResolver.tests.setPubkey({
        address: resolverFixture.address,
        initialFields: resolverFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: caller, asset: { alphAmount: alph(2) } }],
        testArgs: { node, pubkey },
        existingContracts: [record, recordInfo, ...resolverFixture.dependencies]
      })
      const recordInfoState = getContractState<RecordInfoTypes.Fields>(result.contracts, contractId)
      expect(recordInfoState.fields.pubkey).toEqual(pubkey)
      expect(result.events.length).toEqual(1)
      const event = result.events[0] as DefaultResolverTypes.PubkeyUpdatedEvent
      expect(event.fields.node).toEqual(node)
      expect(event.fields.newPubkey).toEqual(pubkey)
      return recordInfoState
    }

    async function getPubkey(recordInfo: RecordInfoTypes.State) {
      const result = await DefaultResolver.tests.getPubKey({
        address: resolverFixture.address,
        initialFields: resolverFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        testArgs: { node },
        existingContracts: [record, recordInfo, ...resolverFixture.dependencies]
      })
      return result.returns
    }

    const pubkey = binToHex(randomBytes(32))
    await expectAssertionError(setPubkey(randomAssetAddress(), pubkey), resolverFixture.address, Number(ErrorCodes.InvalidCaller))

    const recordInfoState0 = await setPubkey(nodeOwner, pubkey)
    expect(await getPubkey(recordInfoState0)).toEqual(pubkey)

    const newPubKey = binToHex(randomBytes(32))
    const recordInfoState1 = await setPubkey(nodeOwner, newPubKey, recordInfoState0)
    expect(await getPubkey(recordInfoState1)).toEqual(newPubKey)
  })
})