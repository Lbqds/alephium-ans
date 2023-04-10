import { addressFromContractId, binToHex, ONE_ALPH, subContractId, web3 } from '@alephium/web3'
import { randomBytes } from 'crypto'
import {
  alph,
  createANSRegistry,
  createRecord,
  defaultGasFee,
  defaultInitialAsset,
  randomAssetAddress,
  randomContractId,
  getContractState,
  defaultGroup,
  buildProject,
  ErrorCodes
} from './fixtures/ANSFixture'
import { ethers } from 'ethers'
import { ANSRegistry, ANSRegistryTypes, RecordTypes } from '../artifacts/ts'
import { expectAssertionError } from '@alephium/web3-test'

describe('test registrar', () => {
  beforeAll(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
    await buildProject()
  })

  it('should test update admin', async () => {
    const adminAddress = randomAssetAddress()
    const newAdminAddress = randomAssetAddress()
    const ansRegistryFixture = await createANSRegistry(adminAddress)

    async function test(caller: string) {
      return ANSRegistry.tests.updateAdmin({
        address: ansRegistryFixture.address,
        initialFields: ansRegistryFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: caller, asset: { alphAmount: ONE_ALPH } }],
        testArgs: { newAdmin: newAdminAddress },
        existingContracts: ansRegistryFixture.dependencies
      })
    }

    const testResult = await test(adminAddress)
    const state = getContractState<ANSRegistryTypes.Fields>(testResult.contracts, ansRegistryFixture.address)
    expect(state.fields.admin).toEqual(newAdminAddress)

    await expectAssertionError(test(randomAssetAddress()), ansRegistryFixture.address, ErrorCodes.InvalidCaller)
  })

  it('should test create new node', async () => {
    const adminAddress = randomAssetAddress()
    const ansRegistryFixture = await createANSRegistry(adminAddress)

    async function test(caller: string, node: string, owner: string) {
      return ANSRegistry.tests.newNode({
        address: ansRegistryFixture.address,
        initialFields: ansRegistryFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: caller, asset: { alphAmount: alph(2) }}],
        testArgs: { node, ownerContractId: owner },
        existingContracts: ansRegistryFixture.dependencies
      })
    }

    const node = binToHex(randomBytes(4))
    const owner = randomContractId()
    const testResult = await test(adminAddress, node, owner)
    const recordState = testResult.contracts[0] as RecordTypes.State
    expect(recordState.fields.registrar).toEqual(owner)
    expect(recordState.fields.owner).toEqual(addressFromContractId(owner))
    const ansRegistryId = ansRegistryFixture.contractId
    expect(recordState.contractId).toEqual(subContractId(ansRegistryId, node, defaultGroup))

    const assetOutput = testResult.txOutputs[1]
    expect(assetOutput.alphAmount).toEqual(alph(2) - ONE_ALPH - defaultGasFee)

    await expectAssertionError(test(randomAssetAddress(), node, owner), ansRegistryFixture.address, ErrorCodes.InvalidCaller)
  })

  it('should test create sub node', async () => {
    const adminAddress = randomAssetAddress()
    const rootNode = binToHex(randomBytes(4))
    const rootNodeOwner = randomAssetAddress()
    const ansRegistryFixture = await createANSRegistry(adminAddress)
    const ansRegistryId = ansRegistryFixture.contractId
    const rootNodeRecord = createRecord({
      registrar: '',
      owner: rootNodeOwner,
      ttl: 0n,
      resolver: '',
      refundAddress: rootNodeOwner
    }, addressFromContractId(subContractId(ansRegistryId, rootNode, defaultGroup)))

    async function test(caller: string, label: string, owner: string) {
      return ANSRegistry.tests.setSubNodeRecord({
        address: ansRegistryFixture.address,
        initialFields: ansRegistryFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: caller, asset: { alphAmount: alph(2) } }],
        testArgs: { node: rootNode, label, owner, ttl: 0n, resolver: '', payer: caller },
        existingContracts: [rootNodeRecord, ...ansRegistryFixture.dependencies]
      })
    }

    const subNodeLabel = binToHex(randomBytes(4))
    const subNodeOwner = randomAssetAddress()
    const testResult = await test(rootNodeOwner, subNodeLabel, subNodeOwner)
    const subNodeRecord = testResult.contracts[0] as RecordTypes.State
    expect(subNodeRecord.fields.owner).toEqual(subNodeOwner)
    const path = ethers.utils.keccak256(Buffer.from(rootNode + subNodeLabel, 'hex'))
    expect(subNodeRecord.contractId).toEqual(subContractId(ansRegistryId, path.slice(2), defaultGroup))

    const contractOutput = testResult.txOutputs[0]
    expect(contractOutput.tokens).toEqual([{
      id: subNodeRecord.contractId,
      amount: 1n
    }])

    const assetOutput = testResult.txOutputs[1]
    expect(assetOutput.alphAmount).toEqual(alph(2) - ONE_ALPH - defaultGasFee)

    await expectAssertionError(test(randomAssetAddress(), subNodeLabel, subNodeOwner), ansRegistryFixture.address, ErrorCodes.InvalidCaller)
  })
})
