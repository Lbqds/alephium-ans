import { addressFromContractId, binToHex, ContractState, subContractId, web3 } from "@alephium/web3"
import {
  alph,
  defaultInitialAsset,
  randomAssetAddress,
  createAccountResolver,
  DefaultGroup,
  buildProject,
  createPrimaryRegistrar,
  getContractState,
  ErrorCodes,
  createPrimaryRecord
} from "./fixtures/ANSFixture"
import { keccak256 } from "ethers/lib/utils"
import { PrimaryRecordTypes, PrimaryRegistrar, PrimaryRegistrarTypes } from "../artifacts/ts"
import { expectAssertionError } from "@alephium/web3-test"

describe("test primary registrar", () => {
  const encoder = new TextEncoder()

  beforeAll(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
    await buildProject()
  })

  test('register', async () => {
    const registrarOwner = randomAssetAddress()
    const registrarFixture = createPrimaryRegistrar(registrarOwner)
    const resolverFixture = createAccountResolver(registrarFixture)

    const name = encoder.encode("test")
    const label = keccak256(name).slice(2)
    const node = keccak256(Buffer.from(label, 'hex')).slice(2)
    const recordId = subContractId(registrarFixture.contractId, node, DefaultGroup)

    async function register(nodeOwner: string, extraContracts: ContractState[] = []) {
      return PrimaryRegistrar.tests.register({
        address: registrarFixture.address,
        initialFields: registrarFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: nodeOwner, asset: { alphAmount: alph(2) } }],
        testArgs: {
          name: binToHex(name),
          owner: nodeOwner,
          payer: nodeOwner,
          resolver: resolverFixture.contractId
        },
        existingContracts: [...resolverFixture.states(), ...extraContracts]
      })
    }

    const nodeOwner = randomAssetAddress()
    const testResult = await register(nodeOwner)
    const recordState = getContractState<PrimaryRecordTypes.Fields>(testResult.contracts, recordId)
    expect(recordState.fields.owner).toEqual(nodeOwner)
    expect(recordState.fields.resolver).toEqual(resolverFixture.contractId)

    const contractOutput = testResult.txOutputs.find((o) => o.address === addressFromContractId(recordId))!
    expect(contractOutput.tokens).toEqual([{ id: recordState.contractId, amount: 1n }])

    const event = testResult.events.find(e => e.name === 'NameRegistered')! as PrimaryRegistrarTypes.NameRegisteredEvent
    expect(event.fields).toEqual({ name: binToHex(name), owner: nodeOwner })

    const record = createPrimaryRecord(addressFromContractId(recordId))
    expectAssertionError(register(nodeOwner, [record]), registrarFixture.address, Number(ErrorCodes.NameHasBeenRegistered))
  })
})
