import { addressFromContractId, binToHex, subContractId, web3 } from "@alephium/web3"
import { randomBytes } from "crypto"
import {
  alph,
  defaultInitialAsset,
  randomAssetAddress,
  subContractAddress,
  getContractState,
  buildProject,
  DefaultGroup,
  createPubkeyResolver,
  ErrorCodes,
  createPrimaryRegistrar,
  createPrimaryRecord
} from "./fixtures/ANSFixture"
import { PubkeyResolver, PubkeyResolverTypes, PubkeyInfo, PubkeyInfoTypes } from "../artifacts/ts"
import { expectAssertionError } from "@alephium/web3-test"

describe("test default resolver", () => {
  beforeAll(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
    await buildProject()
  })

  function createPubkeyInfo(resolver: string, pubkey: string, contractAddress: string): PubkeyInfoTypes.State {
    return PubkeyInfo.stateForTest(
      { resolver, pubkey },
      defaultInitialAsset,
      contractAddress,
    )
  }

  it('should create new record info', async () => {
    const registrarFixture = createPrimaryRegistrar(randomAssetAddress())
    const resolverFixture = createPubkeyResolver(registrarFixture)
    const node = binToHex(randomBytes(4))
    const nodeOwner = randomAssetAddress()
    const record = createPrimaryRecord(subContractAddress(registrarFixture.contractId, node, DefaultGroup), registrarFixture.contractId, nodeOwner)
    const pubkey = binToHex(randomBytes(32))

    async function newPubkeyInfo(caller: string) {
      return await PubkeyResolver.tests.newPubkeyInfo({
        address: resolverFixture.address,
        initialFields: resolverFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: caller, asset: { alphAmount: alph(2) } }],
        testArgs: { node, payer: nodeOwner, pubkey  },
        existingContracts: [record, ...resolverFixture.states()]
      })
    }

    await expectAssertionError(newPubkeyInfo(randomAssetAddress()), resolverFixture.address, Number(ErrorCodes.InvalidCaller))

    const result = await newPubkeyInfo(nodeOwner)
    const pubkeyInfoId = subContractId(resolverFixture.contractId, node, 0)
    const pubkeyInfoState = getContractState<PubkeyInfoTypes.Fields>(result.contracts, pubkeyInfoId)
    expect(pubkeyInfoState.fields.pubkey).toEqual(pubkey)
    expect(result.events.length).toEqual(2)

    const event = result.events[1] as PubkeyResolverTypes.NewPubkeyInfoCreatedEvent
    expect(event.fields.node).toEqual(node)
    expect(event.fields.pubkey).toEqual(pubkey)
  })

  it('should set/get pubkey', async () => {
    const registrarFixture = createPrimaryRegistrar(randomAssetAddress())
    const resolverFixture = createPubkeyResolver(registrarFixture)
    const nodeOwner = randomAssetAddress()
    const node = binToHex(randomBytes(4))
    const record = createPrimaryRecord(subContractAddress(registrarFixture.contractId, node, DefaultGroup), registrarFixture.contractId, nodeOwner)

    const contractId = subContractId(resolverFixture.contractId, node, DefaultGroup)
    async function setPubkey(caller: string, pubkey: string, pubkeyInfoOpt?: PubkeyInfoTypes.State) {
      const pubkeyInfo = pubkeyInfoOpt ?? createPubkeyInfo(resolverFixture.selfState.contractId, '', addressFromContractId(contractId))
      const result = await PubkeyResolver.tests.setPubkey({
        address: resolverFixture.address,
        initialFields: resolverFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: caller, asset: { alphAmount: alph(2) } }],
        testArgs: { node, pubkey },
        existingContracts: [record, pubkeyInfo, ...resolverFixture.dependencies]
      })
      const pubkeyInfoState = getContractState<PubkeyInfoTypes.Fields>(result.contracts, contractId)
      expect(pubkeyInfoState.fields.pubkey).toEqual(pubkey)
      expect(result.events.length).toEqual(1)
      const event = result.events[0] as PubkeyResolverTypes.PubkeyUpdatedEvent
      expect(event.fields.node).toEqual(node)
      expect(event.fields.newPubkey).toEqual(pubkey)
      return pubkeyInfoState
    }

    async function getPubkey(pubkeyInfo: PubkeyInfoTypes.State) {
      const result = await PubkeyResolver.tests.getPubkey({
        address: resolverFixture.address,
        initialFields: resolverFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        testArgs: { node },
        existingContracts: [record, pubkeyInfo, ...resolverFixture.dependencies]
      })
      return result.returns
    }

    const pubkey = binToHex(randomBytes(32))
    await expectAssertionError(setPubkey(randomAssetAddress(), pubkey), resolverFixture.address, Number(ErrorCodes.InvalidCaller))

    const pubkeyInfoState0 = await setPubkey(nodeOwner, pubkey)
    expect(await getPubkey(pubkeyInfoState0)).toEqual(pubkey)

    const newPubKey = binToHex(randomBytes(32))
    const pubkeyInfoState1 = await setPubkey(nodeOwner, newPubKey, pubkeyInfoState0)
    expect(await getPubkey(pubkeyInfoState1)).toEqual(newPubKey)
  })
})