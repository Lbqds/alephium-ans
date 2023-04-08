import { addressFromContractId, binToHex, subContractId, web3 } from "@alephium/web3"
import { randomBytes } from "crypto"
import {
  alph,
  createANSRegistry,
  createRecord,
  defaultInitialAsset,
  randomAssetAddress,
  subContractAddress,
  zeroPad,
  createAddressResolver,
  getContractState,
  buildProject,
  defaultGroup
} from "./fixtures/ANSFixture"
import * as base58 from 'bs58'
import { AddressInfo, AddressInfoTypes, AddressResolverTest } from "../artifacts/ts"

describe("test address resolver", () => {
  const AlphChainId = 1234
  const EthChainId = 60

  beforeAll(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
    await buildProject()
  })

  function createAddressInfo(parentId: string, data: string, address: string): AddressInfoTypes.State {
    return AddressInfo.stateForTest(
      { parentId: parentId, addresses: data },
      defaultInitialAsset,
      address
    )
  }

  it('should set/get addresses', async () => {
    const ansRegistryFixture = await createANSRegistry(randomAssetAddress())
    const addressResolverFixture = await createAddressResolver(ansRegistryFixture)
    const ansRegistryId = ansRegistryFixture.contractId
    const nodeOwner = randomAssetAddress()
    const node = binToHex(randomBytes(4))
    const record = await createRecord({
      registrar: '',
      owner: nodeOwner,
      ttl: 0n,
      resolver: '',
      refundAddress: nodeOwner
    }, subContractAddress(ansRegistryId, node, defaultGroup))

    let addressData = ""
    const path = "00" + node
    const addressInfoId = subContractId(addressResolverFixture.contractId, path, defaultGroup)

    async function setAddress(caller: string, chainId: number, address: string) {
      const addressInfo = createAddressInfo(
        addressResolverFixture.selfState.contractId,
        addressData,
        addressFromContractId(addressInfoId)
      )
      return AddressResolverTest.tests.setAddress({
        address: addressResolverFixture.address,
        initialFields: addressResolverFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: caller, asset: { alphAmount: alph(2) } }],
        testArgs: { node, chainId: BigInt(chainId), address },
        existingContracts: [record, addressInfo, ...addressResolverFixture.dependencies]
      })
    }

    async function getAddress(caller: string, chainId: number) {
      const addressInfo = createAddressInfo(
        addressResolverFixture.selfState.contractId,
        addressData,
        addressFromContractId(addressInfoId)
      )
      return AddressResolverTest.tests.getAddress({
        address: addressResolverFixture.address,
        initialFields: addressResolverFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: caller, asset: { alphAmount: alph(2) } }],
        testArgs: { node, chainId: BigInt(chainId) },
        existingContracts: [record, addressInfo, ...addressResolverFixture.dependencies]
      })
    }

    const alphAddress = binToHex(base58.decode(nodeOwner))
    const testResult0 = await setAddress(nodeOwner, AlphChainId, alphAddress)
    const addressInfoFields0 = getContractState<AddressInfoTypes.Fields>(testResult0.contracts, addressInfoId).fields
    expect(addressInfoFields0.addresses).toEqual(
      zeroPad(AlphChainId.toString(16), 2) +
      "21" + // 33 bytes
      alphAddress
    )
    addressData = addressInfoFields0.addresses

    const ethAddress = binToHex(randomBytes(20))
    const testResult1 = await setAddress(nodeOwner, EthChainId, ethAddress)
    const addressInfoFields1 = getContractState<AddressInfoTypes.Fields>(testResult1.contracts, addressInfoId).fields
    expect(addressInfoFields1.addresses).toEqual(
      addressData +
      zeroPad(EthChainId.toString(16), 2) +
      "14" + // 20 bytes
      ethAddress
    )
    addressData = addressInfoFields1.addresses

    const testResult2 = await getAddress(nodeOwner, AlphChainId)
    expect(testResult2.returns).toEqual(alphAddress)
    const testResult3 = await getAddress(nodeOwner, EthChainId)
    expect(testResult3.returns).toEqual(ethAddress)
  })
})
