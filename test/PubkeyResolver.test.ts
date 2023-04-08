import { addressFromContractId, binToHex, subContractId, web3 } from "@alephium/web3"
import { randomBytes } from "crypto"
import { PubkeyInfo, PubkeyInfoTypes, PubkeyResolverTest } from "../artifacts/ts"
import {
  alph,
  createANSRegistry,
  createRecord,
  defaultInitialAsset,
  randomAssetAddress,
  subContractAddress,
  createPubkeyResolver,
  buildProject,
  defaultGroup,
  getContractState
} from "./fixtures/ANSFixture"

describe("test pubkey resolver", () => {
  async function createPubkeyInfo(parentId: string, pubkey: string, address: string): Promise<PubkeyInfoTypes.State> {
    return PubkeyInfo.stateForTest({ parentId, pubkey }, defaultInitialAsset, address)
  }

  beforeAll(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
    await buildProject()
  })

  it('should set/get pubkey info', async () => {
    const ansRegistryFixture = await createANSRegistry(randomAssetAddress())
    const pubkeyResolverFixture = await createPubkeyResolver(ansRegistryFixture)
    const ansRegistryId = ansRegistryFixture.contractId
    const nodeOwner = randomAssetAddress()
    const node = binToHex(randomBytes(4))
    const record = await createRecord({
      registrar: '',
      owner: nodeOwner,
      ttl: 0n,
      resolver: '',
      refundAddress: nodeOwner
    }, addressFromContractId(subContractId(ansRegistryId, node, defaultGroup)))
    const path = '02' + node
    const pubkeyInfoAddress = subContractAddress(pubkeyResolverFixture.contractId, path, defaultGroup)
    const pubkey = binToHex(randomBytes(33))
    const pubkeyInfo = await createPubkeyInfo(
      pubkeyResolverFixture.contractId,
      pubkey,
      pubkeyInfoAddress
    )

    async function setPubkey(node: string) {
      return PubkeyResolverTest.tests.setPubkey({
        address: pubkeyResolverFixture.address,
        initialFields: pubkeyResolverFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: nodeOwner, asset: { alphAmount: alph(2) } }],
        testArgs: { node, pubkey },
        existingContracts: [record, pubkeyInfo, ...pubkeyResolverFixture.dependencies]
      })
    }

    async function getPubkey(node: string) {
      return PubkeyResolverTest.tests.getPubkey({
        address: pubkeyResolverFixture.address,
        initialFields: pubkeyResolverFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: nodeOwner, asset: { alphAmount: alph(2) } }],
        testArgs: { node },
        existingContracts: [record, pubkeyInfo, ...pubkeyResolverFixture.dependencies]
      })
    }

    const testResult0 = await setPubkey(node)
    const pubkeyInfoFields = getContractState(testResult0.contracts, pubkeyInfoAddress).fields
    expect(pubkeyInfoFields.pubkey).toEqual(pubkey)
    const testResult1 = await getPubkey(node)
    expect(testResult1.returns).toEqual(pubkey)
  })
})
