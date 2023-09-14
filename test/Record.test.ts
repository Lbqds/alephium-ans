import { Address, Contract, ContractDestroyedEvent, ContractState, ONE_ALPH, web3 } from "@alephium/web3"
import {
  randomAssetAddress,
  buildProject,
  createRecord
} from "./fixtures/ANSFixture"
import { RecordTypes, RecordTest } from "../artifacts/ts"
import { randomContractAddress } from "@alephium/web3-test"

describe("test record", () => {

  beforeAll(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
    await buildProject()
  })

  function createRecordTest(record: ContractState<RecordTypes.Fields>, address: Address) {
    return RecordTest.stateForTest({ record: record.contractId }, undefined, address)
  }

  test('destroy record', async () => {
    const contractAddress = randomContractAddress()
    const record = createRecord(randomContractAddress(), contractAddress)
    const recordTest = createRecordTest(record, contractAddress)

    async function destroy(caller: Address) {
      return await RecordTest.tests.destroyRecord({
        address: recordTest.address,
        initialFields: recordTest.fields,
        initialAsset: { alphAmount: ONE_ALPH, tokens: [{ id: record.contractId, amount: 1n }] },
        inputAssets: [{ address: caller, asset: { alphAmount: ONE_ALPH } }],
        existingContracts: [record]
      })
    }

    const result = await destroy(randomAssetAddress())
    const destroyEvent = result.events.find((e) => e.eventIndex === Contract.ContractDestroyedEventIndex)! as ContractDestroyedEvent
    expect(destroyEvent.fields.address).toEqual(record.address)
  })
})