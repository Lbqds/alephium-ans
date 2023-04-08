import { addressFromContractId, binToHex, subContractId, web3 } from "@alephium/web3"
import { randomBytes } from "crypto"
import { NameInfo, NameInfoTypes, NameResolverTest } from "../artifacts/ts"
import {
  alph,
  createANSRegistry,
  createRecord,
  defaultInitialAsset,
  randomAssetAddress,
  subContractAddress,
  createNameResolver,
  defaultGroup,
  getContractState,
  buildProject
} from "./fixtures/ANSFixture"

describe("test name resolver", () => {
  const encoder = new TextEncoder()

  beforeAll(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
    await buildProject()
  })

  async function createNameInfo(parentId: string, name: string, address: string): Promise<NameInfoTypes.State> {
    return NameInfo.stateForTest({ parentId, name }, defaultInitialAsset, address)
  }

  it('should set/get name info', async () => {
    const ansRegistryFixture = await createANSRegistry(randomAssetAddress())
    const nameResolverFixture = await createNameResolver(ansRegistryFixture)
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
    const path = '01' + node
    const nameInfoAddress = subContractAddress(nameResolverFixture.contractId, path, defaultGroup)
    const name = 'test'
    const nameInfo = await createNameInfo(
      nameResolverFixture.contractId,
      binToHex(encoder.encode(name)),
      nameInfoAddress
    )

    async function setName(node: string) {
      return NameResolverTest.tests.setName({
        address: nameResolverFixture.address,
        initialFields: nameResolverFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: nodeOwner, asset: { alphAmount: alph(2) } }],
        testArgs: { node, name: binToHex(encoder.encode(name)) },
        existingContracts: [record, nameInfo, ...nameResolverFixture.dependencies]
      })
    }

    async function getName(node: string) {
      return NameResolverTest.tests.getName({
        address: nameResolverFixture.address,
        initialFields: nameResolverFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: nodeOwner, asset: { alphAmount: alph(2) } }],
        testArgs: { node },
        existingContracts: [record, nameInfo, ...nameResolverFixture.dependencies]
      })
    }

    const encodedName = binToHex(encoder.encode(name))
    const testResult0 = await setName(node)
    const nameInfoFields = getContractState(testResult0.contracts, nameInfoAddress).fields
    expect(nameInfoFields.name).toEqual(encodedName)
    const testResult1 = await getName(node)
    expect(testResult1.returns).toEqual(encodedName)
  })
})
