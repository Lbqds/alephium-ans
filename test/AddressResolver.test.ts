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
  zeroPad,
  createAddressResolver
} from "./fixtures/ANSFixture"
import * as base58 from 'bs58'

describe("test address resolver", () => {
  const AlphChainId = 1234
  const EthChainId = 60

  async function createAddressInfo(parentId: string, data: string, address: string): Promise<ContractState> {
    const contract = await Contract.fromSource(testProvider, 'address_info.ral')
    return contract.toState({
      "parentId": parentId,
      "addresses": data
    }, defaultInitialAsset, address)
  }

  it('should set/get addresses', async () => {
    const ansRegistryInfo = await createANSRegistry(randomAssetAddress())
    const addressResolverInfo = await createAddressResolver(ansRegistryInfo)
    const ansRegistryId = ansRegistryInfo.state.contractId
    const nodeOwner = randomAssetAddress()
    const node = binToHex(randomBytes(4))
    const record = await createRecord({
      "registrar": '',
      "owner": nodeOwner,
      "ttl": 0,
      "resolver": '',
      "refundAddress": nodeOwner
    }, subContractAddress(ansRegistryId, node))

    let addressData = ""
    const path = "00" + node
    const addressInfoId = subContractId(addressResolverInfo.state.contractId, path)

    async function test(caller: string, method: string, args: Arguments): Promise<TestContractResult> {
      const addressInfo = await createAddressInfo(
        addressResolverInfo.state.contractId,
        addressData,
        addressFromContractId(addressInfoId)
      )
      const addressResolver = addressResolverInfo.contract
      return addressResolver.testPublicMethod(testProvider, method, {
        address: addressResolverInfo.state.address,
        initialFields: addressResolverInfo.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{
          address: caller,
          asset: {
            alphAmount: alph(2)
          }
        }],
        testArgs: args,
        existingContracts: [record, addressInfo, ...addressResolverInfo.dependencies]
      })
    }

    async function setAddress(caller: string, chainId: number, address: string): Promise<TestContractResult> {
      return test(caller, "setAddress", {
        "node": node,
        "chainId": chainId,
        "address": address
      })
    }

    async function getAddress(caller: string, chainId: number): Promise<TestContractResult> {
      return test(caller, "getAddress", {
        "node": node,
        "chainId": chainId
      })
    }

    const alphAddress = binToHex(base58.decode(nodeOwner))
    let testResult = await setAddress(nodeOwner, AlphChainId, alphAddress)
    let addressInfoContract = testResult.contracts.filter(c => c.contractId === addressInfoId)[0]
    expect(addressInfoContract.fields["addresses"]).toEqual(
      zeroPad(AlphChainId.toString(16), 2) +
      "21" + // 33 bytes
      alphAddress
    )
    addressData = addressInfoContract.fields["addresses"] as string

    const ethAddress = binToHex(randomBytes(20))
    testResult = await setAddress(nodeOwner, EthChainId, ethAddress)
    addressInfoContract = testResult.contracts.filter(c => c.contractId === addressInfoId)[0]
    expect(addressInfoContract.fields["addresses"]).toEqual(
      addressData +
      zeroPad(EthChainId.toString(16), 2) +
      "14" + // 20 bytes
      ethAddress
    )
    addressData = addressInfoContract.fields["addresses"] as string

    testResult = await getAddress(nodeOwner, AlphChainId)
    expect(testResult.returns).toEqual([alphAddress])
    testResult = await getAddress(nodeOwner, EthChainId)
    expect(testResult.returns).toEqual([ethAddress])
  })
})
