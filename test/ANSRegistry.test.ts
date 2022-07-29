import {
  addressFromContractId,
  binToHex,
  subContractId,
  TestContractResult
} from '@alephium/web3'
import { randomBytes } from 'crypto'
import {
  alph,
  createANSRegistry,
  createRecord,
  defaultGasFee,
  defaultInitialAsset,
  expectAssertionFailed,
  oneAlph,
  randomAssetAddress,
  randomContractId,
  testProvider
} from './fixtures/ANSFixture'
import { ethers } from 'ethers'
import { keccak256 } from 'ethers/lib/utils'

describe('test registrar', () => {
  it('should test update admin', async () => {
    const adminAddress = randomAssetAddress()
    const newAdminAddress = randomAssetAddress()
    const ansRegistryInfo = await createANSRegistry(adminAddress)
    const ansRegistry = ansRegistryInfo.contract

    async function test(caller: string): Promise<TestContractResult> {
      return ansRegistry.testPublicMethod(testProvider, 'updateAdmin', {
        initialFields: ansRegistryInfo.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{
          address: caller,
          asset: {
            alphAmount: oneAlph
          }
        }],
        testArgs: {
          "newAdmin": newAdminAddress
        }
      })
    }

    const testResult = await test(adminAddress)
    const state = testResult.contracts[0]
    expect(state.fields["admin"]).toEqual(newAdminAddress)

    await expectAssertionFailed(() => test(randomAssetAddress()))
  })

  it('should test create new node', async () => {
    const adminAddress = randomAssetAddress()
    const ansRegistryInfo = await createANSRegistry(adminAddress)
    const ansRegistry = ansRegistryInfo.contract

    async function test(caller: string, node: string, owner: string): Promise<TestContractResult> {
      return ansRegistry.testPublicMethod(testProvider, 'newNode', {
        address: ansRegistryInfo.state.address,
        initialFields: ansRegistryInfo.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{
          address: caller,
          asset: {
            alphAmount: alph(2)
          }
        }],
        testArgs: {
          "node": node,
          "ownerContractId": owner
        },
        existingContracts: ansRegistryInfo.dependencies
      })
    }

    const node = binToHex(randomBytes(4))
    const owner = randomContractId()
    const testResult = await test(adminAddress, node, owner)
    const recordContract = testResult.contracts[0]
    expect(recordContract.fields["registrar"]).toEqual(owner)
    expect(recordContract.fields["owner"]).toEqual(addressFromContractId(owner))
    const ansRegistryId = ansRegistryInfo.state.contractId
    expect(recordContract.contractId).toEqual(subContractId(ansRegistryId, node))

    const assetOutput = testResult.txOutputs[1]
    expect(assetOutput.alphAmount).toEqual(alph(2) - oneAlph - defaultGasFee)

    await expectAssertionFailed(() => test(randomAssetAddress(), node, owner))
  })

  it('should test create sub node', async () => {
    const adminAddress = randomAssetAddress()
    const rootNode = binToHex(randomBytes(4))
    const rootNodeOwner = randomAssetAddress()
    const ansRegistryInfo = await createANSRegistry(adminAddress)
    const ansRegistry = ansRegistryInfo.contract
    const ansRegistryId = ansRegistryInfo.state.contractId
    const rootNodeRecord = await createRecord({
      "registrar": '',
      "owner": rootNodeOwner,
      "ttl": 0,
      "resolver": '',
      "refundAddress": rootNodeOwner
    }, addressFromContractId(subContractId(ansRegistryId, rootNode)))

    async function test(caller: string, label: string, owner: string): Promise<TestContractResult> {
      return ansRegistry.testPublicMethod(testProvider, 'setSubNodeRecord', {
        address: ansRegistryInfo.state.address,
        initialFields: ansRegistryInfo.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{
          address: caller,
          asset: {
            alphAmount: alph(2)
          }
        }],
        testArgs: {
          "node": rootNode,
          "label": label,
          "owner": owner,
          "ttl": 0,
          "resolver": '',
          "payer": caller
        },
        existingContracts: [rootNodeRecord, ...ansRegistryInfo.dependencies]
      })
    }

    const subNodeLabel = binToHex(randomBytes(4))
    const subNodeOwner = randomAssetAddress()
    const testResult = await test(rootNodeOwner, subNodeLabel, subNodeOwner)
    const subNodeRecord = testResult.contracts[0]
    expect(subNodeRecord.fields["owner"]).toEqual(subNodeOwner)
    const path = ethers.utils.keccak256(Buffer.from(rootNode + subNodeLabel, 'hex'))
    expect(subNodeRecord.contractId).toEqual(subContractId(ansRegistryId, path.slice(2)))

    const contractOutput = testResult.txOutputs[0]
    expect(contractOutput.tokens).toEqual([{
      id: subNodeRecord.contractId,
      amount: 1
    }])

    const assetOutput = testResult.txOutputs[1]
    expect(assetOutput.alphAmount).toEqual(alph(2) - oneAlph - defaultGasFee)

    await expectAssertionFailed(() => test(randomAssetAddress(), subNodeLabel, subNodeOwner))
  })
})
