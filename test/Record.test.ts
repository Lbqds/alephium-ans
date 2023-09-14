import { Address, binToHex, Contract, ContractDestroyedEvent, ContractState, ONE_ALPH, web3 } from "@alephium/web3"
import {
  randomAssetAddress,
  buildProject,
  createPrimaryRecord,
  createSecondaryRecord
} from "./fixtures/ANSFixture"
import { PrimaryRecordOwner, PrimaryRecordTypes, SecondaryRecordOwner, SecondaryRecordTypes } from "../artifacts/ts"
import { randomBytes } from "crypto"
import { randomContractAddress } from "@alephium/web3-test"

describe("test record", () => {

  beforeAll(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
    await buildProject()
  })

  function createPrimaryRecordOwner(primaryRecord: ContractState<PrimaryRecordTypes.Fields>, address: Address) {
    return PrimaryRecordOwner.stateForTest({ record: primaryRecord.contractId }, undefined, address)
  }

  function createSecondaryRecordOwner(secondaryRecord: ContractState<SecondaryRecordTypes.Fields>, address: Address) {
    return SecondaryRecordOwner.stateForTest({ record: secondaryRecord.contractId }, undefined, address)
  }

  test('destroy primary record', async () => {
    const contractAddress = randomContractAddress()
    const primaryRecord = createPrimaryRecord(randomContractAddress(), contractAddress)
    const primaryRecordOwner = createPrimaryRecordOwner(primaryRecord, contractAddress)

    async function destroy(caller: Address) {
      return await PrimaryRecordOwner.tests.destroyRecord({
        address: primaryRecordOwner.address,
        initialFields: primaryRecordOwner.fields,
        initialAsset: { alphAmount: ONE_ALPH, tokens: [{ id: primaryRecord.contractId, amount: 1n }] },
        inputAssets: [{ address: caller, asset: { alphAmount: ONE_ALPH } }],
        testArgs: { node: binToHex(randomBytes(4)) },
        existingContracts: [primaryRecord]
      })
    }

    const result = await destroy(randomAssetAddress())
    const destroyEvent = result.events.find((e) => e.eventIndex === Contract.ContractDestroyedEventIndex)! as ContractDestroyedEvent
    expect(destroyEvent.fields.address).toEqual(primaryRecord.address)
  })

  test('destroy secondary record', async () => {
    const contractAddress = randomContractAddress()
    const secondaryRecord = createSecondaryRecord(randomContractAddress(), contractAddress)
    const secondaryRecordOwner = createSecondaryRecordOwner(secondaryRecord, contractAddress)

    async function destroy(caller: Address) {
      return await SecondaryRecordOwner.tests.destroyRecord({
        address: secondaryRecordOwner.address,
        initialFields: secondaryRecordOwner.fields,
        initialAsset: { alphAmount: ONE_ALPH },
        inputAssets: [{ address: caller, asset: { alphAmount: ONE_ALPH } }],
        testArgs: { node: binToHex(randomBytes(4)) },
        existingContracts: [secondaryRecord]
      })
    }

    const result = await destroy(randomAssetAddress())
    const destroyEvent = result.events.find((e) => e.eventIndex === Contract.ContractDestroyedEventIndex)! as ContractDestroyedEvent
    expect(destroyEvent.fields.address).toEqual(secondaryRecord.address)
  })
})