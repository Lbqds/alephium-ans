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
  createPubkeyResolver
} from "./fixtures/ANSFixture"

describe("test pubkey resolver", () => {
  async function createPubkeyInfo(parentId: string, pubkey: string, address: string): Promise<ContractState> {
    const contract = await Contract.fromSource(testProvider, 'pubkey_info.ral')
    return contract.toState({
      "parentId": parentId,
      "pubkey": pubkey
    }, defaultInitialAsset, address)
  }

  it('should set/get pubkey info', async () => {
    const ansRegistryInfo = await createANSRegistry(randomAssetAddress())
    const pubkeyResolverInfo = await createPubkeyResolver(ansRegistryInfo)
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
    const path = '02' + node
    const pubkeyInfoAddress = subContractAddress(pubkeyResolverInfo.state.contractId, path)
    let pubkey = ""

    async function test(method: string, args: Arguments): Promise<TestContractResult> {
      const pubkeyInfo = await createPubkeyInfo(
        pubkeyResolverInfo.state.contractId,
        pubkey,
        pubkeyInfoAddress
      )
      const pubkeyResolver = pubkeyResolverInfo.contract
      return pubkeyResolver.testPublicMethod(testProvider, method, {
        address: pubkeyResolverInfo.state.address,
        initialFields: pubkeyResolverInfo.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{
          address: nodeOwner,
          asset: {
            alphAmount: alph(2)
          }
        }],
        testArgs: args,
        existingContracts: [record, pubkeyInfo, ...pubkeyResolverInfo.dependencies]
      })
    }

    async function setPubkey(node: string): Promise<TestContractResult> {
      return test("setPubkey", {
        "node": node,
        "pubkey": pubkey
      })
    }

    async function getPubkey(node: string): Promise<TestContractResult> {
      return test("getPubkey", {"node": node})
    }

    pubkey = binToHex(randomBytes(33))
    let testResult = await setPubkey(node)
    const pubkeyInfoContract = testResult.contracts.filter(c => c.address === pubkeyInfoAddress)[0]
    expect(pubkeyInfoContract.fields["pubkey"]).toEqual(pubkey)
    testResult = await getPubkey(node)
    expect(testResult.returns).toEqual([pubkey])
  })
})
