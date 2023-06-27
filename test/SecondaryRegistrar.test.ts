import { addressFromContractId, binToHex, Contract, ContractState, subContractId, Token, web3, ContractDestroyedEvent } from "@alephium/web3"
import {
  alph,
  defaultInitialAsset,
  randomAssetAddress,
  createAccountResolver,
  DefaultGroup,
  buildProject,
  createSecondaryRegistrar,
  getContractState,
  createSecondaryRecord,
  expectVMAssertionError
} from "./fixtures/ANSFixture"
import { keccak256 } from "ethers/lib/utils"
import { AccountInfo, AccountInfoTypes, SecondaryRecordTypes, SecondaryRegistrar, SecondaryRegistrarTypes } from "../artifacts/ts"
import { randomContractId } from "@alephium/web3-test"

describe("test secondary registrar", () => {
  const encoder = new TextEncoder()

  beforeAll(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
    await buildProject()
  })

  function createAccountInfo(resolver: string, contractAddress: string): AccountInfoTypes.State {
    return AccountInfo.stateForTest(
      { resolver, pubkey: '', addresses: '' },
      defaultInitialAsset,
      contractAddress,
    )
  }

  const primaryRegistrarId = randomContractId()
  const registrarFixture = createSecondaryRegistrar(primaryRegistrarId)
  const resolverFixture = createAccountResolver(registrarFixture)

  const name = encoder.encode("test")
  const label = keccak256(name).slice(2)
  const node = keccak256(Buffer.from(label, 'hex')).slice(2)
  const primaryRecordId = subContractId(primaryRegistrarId, node, DefaultGroup)
  const secondaryRecordId = subContractId(registrarFixture.contractId, node, DefaultGroup)

  async function register(nodeOwner: string, extraContracts: ContractState[] = [], tokens: Token[] = [{ id: primaryRecordId, amount: 1n }]) {
    return SecondaryRegistrar.tests.register({
      address: registrarFixture.address,
      initialFields: registrarFixture.initialFields(),
      initialAsset: defaultInitialAsset,
      inputAssets: [{ address: nodeOwner, asset: { alphAmount: alph(2), tokens: tokens } }],
      testArgs: {
        name: binToHex(name),
        owner: nodeOwner,
        payer: nodeOwner,
        resolver: resolverFixture.contractId
      },
      existingContracts: [...resolverFixture.states(), ...extraContracts]
    })
  }

  test('register', async () => {
    const nodeOwner = randomAssetAddress()
    const testResult = await register(nodeOwner)
    const recordState = getContractState<SecondaryRecordTypes.Fields>(testResult.contracts, secondaryRecordId)
    expect(recordState.fields.owner).toEqual(nodeOwner)
    expect(recordState.fields.resolver).toEqual(resolverFixture.contractId)

    const contractOutput = testResult.txOutputs.find((o) => o.address === addressFromContractId(secondaryRecordId))!
    expect(contractOutput.tokens).toEqual([])

    expect(testResult.events.length).toEqual(2)

    const event = testResult.events.find(e => e.name === 'NameRegistered')! as SecondaryRegistrarTypes.NameRegisteredEvent
    expect(event.fields).toEqual({ name: binToHex(name), owner: nodeOwner })

    expectVMAssertionError(register(nodeOwner, [], []), 'NoTokenBalanceForTheAddress')
  })

  test('remove the old record', async () => {
    const nodeOwner = randomAssetAddress()
    const secondaryRecord = createSecondaryRecord(addressFromContractId(secondaryRecordId), registrarFixture.contractId, resolverFixture.contractId)
    const accountInfoId = subContractId(resolverFixture.contractId, node, DefaultGroup)
    const accountInfo = createAccountInfo(resolverFixture.contractId, addressFromContractId(accountInfoId))
    const testResult = await register(nodeOwner, [secondaryRecord, accountInfo])

    expect(testResult.events.length).toEqual(5)
    const contractDestroyedEvents = testResult.events.filter((e) => e.eventIndex === Contract.ContractDestroyedEventIndex) as ContractDestroyedEvent[]
    expect(contractDestroyedEvents.find((e) => e.fields.address === secondaryRecord.address) !== undefined).toEqual(true)
    expect(contractDestroyedEvents.find((e) => e.fields.address === accountInfo.address) !== undefined).toEqual(true)
    expect(testResult.events.find((e) => e.name === 'AccountInfoRemoved') !== undefined).toEqual(true)

    const nameRegisteredEvent = testResult.events.find(e => e.name === 'NameRegistered')! as SecondaryRegistrarTypes.NameRegisteredEvent
    expect(nameRegisteredEvent.fields).toEqual({ name: binToHex(name), owner: nodeOwner })
  })
})