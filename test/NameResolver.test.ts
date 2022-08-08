import {
  addressFromContractId,
  Arguments,
  binToHex,
  Contract,
  ContractState,
  subContractId,
  TestContractResult
} from "@alephium/web3"
import { randomBytes } from "crypto"
import {
  alph,
  createANSRegistry,
  createRecord,
  defaultInitialAsset,
  randomAssetAddress,
  testProvider,
  subContractAddress,
  createNameResolver
} from "./fixtures/ANSFixture"

describe("test name resolver", () => {
  const encoder = new TextEncoder()

  async function createNameInfo(parentId: string, name: string, address: string): Promise<ContractState> {
    const contract = await Contract.fromSource(testProvider, 'name_info.ral')
    return contract.toState({
      "parentId": parentId,
      "name": name
    }, defaultInitialAsset, address)
  }

  it('should set/get name info', async () => {
    const ansRegistryInfo = await createANSRegistry(randomAssetAddress())
    const nameResolverInfo = await createNameResolver(ansRegistryInfo)
    const ansRegistryId = ansRegistryInfo.state.contractId
    const nodeOwner = randomAssetAddress()
    const node = binToHex(randomBytes(4))
    const record = await createRecord({
      "registrar": '',
      "owner": nodeOwner,
      "ttl": 0,
      "resolver": '',
      "refundAddress": nodeOwner
    }, addressFromContractId(subContractId(ansRegistryId, node)))
    const path = '01' + node
    const nameInfoAddress = subContractAddress(nameResolverInfo.state.contractId, path)
    let name = ""

    async function test(method: string, args: Arguments): Promise<TestContractResult> {
      const nameInfo = await createNameInfo(
        nameResolverInfo.state.contractId,
        binToHex(encoder.encode(name)),
        nameInfoAddress
      )
      const nameResolver = nameResolverInfo.contract
      return nameResolver.testPublicMethod(testProvider, method, {
        address: nameResolverInfo.state.address,
        initialFields: nameResolverInfo.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{
          address: nodeOwner,
          asset: {
            alphAmount: alph(2)
          }
        }],
        testArgs: args,
        existingContracts: [record, nameInfo, ...nameResolverInfo.dependencies]
      })
    }

    async function setName(node: string): Promise<TestContractResult> {
      return test("setName", {
        "node": node,
        "name": binToHex(encoder.encode(name))
      })
    }

    async function getName(node: string): Promise<TestContractResult> {
      return test("getName", {"node": node})
    }

    name = "test"
    const encodedName = binToHex(encoder.encode(name))
    let testResult = await setName(node)
    const nameInfoContract = testResult.contracts.filter(c => c.address === nameInfoAddress)[0]
    expect(nameInfoContract.fields["name"]).toEqual(encodedName)
    testResult = await getName(node)
    expect(testResult.returns).toEqual([encodedName])
  })
})
