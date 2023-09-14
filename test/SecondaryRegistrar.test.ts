import { addressFromContractId, binToHex, ContractState, subContractId, web3 } from "@alephium/web3"
import {
  alph,
  defaultInitialAsset,
  randomAssetAddress,
  DefaultGroup,
  buildProject,
  createSecondaryRegistrar,
  getContractState,
  createRecord,
  getCredentialTokenPath,
  ErrorCodes,
  randomContractId
} from "./fixtures/ANSFixture"
import { keccak256 } from "ethers/lib/utils"
import { RecordTypes, SecondaryRegistrar } from "../artifacts/ts"
import { expectAssertionError } from "@alephium/web3-test"

describe("test secondary registrar", () => {
  const encoder = new TextEncoder()

  beforeAll(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
    await buildProject()
  })

  const primaryRegistrarId = randomContractId()
  const registrarFixture = createSecondaryRegistrar(primaryRegistrarId)

  const name = encoder.encode("test")
  const node = keccak256(name).slice(2)
  const secondaryRecordId = subContractId(registrarFixture.contractId, node, DefaultGroup)

  function getCredentialTokenId(ttl: bigint): string {
    const path = getCredentialTokenPath(node, ttl)
    return subContractId(primaryRegistrarId, path, DefaultGroup)
  }

  async function register(nodeOwner: string, credentialTokenId: string, ttl: bigint, currentTs: number, extraContracts: ContractState[] = []) {
    return SecondaryRegistrar.tests.register({
      address: registrarFixture.address,
      initialFields: registrarFixture.initialFields(),
      initialAsset: defaultInitialAsset,
      inputAssets: [{ address: nodeOwner, asset: { alphAmount: alph(2), tokens: [{ id: credentialTokenId, amount: 1n }] } }],
      testArgs: {
        name: binToHex(name),
        owner: nodeOwner,
        payer: nodeOwner,
        credentialTokenId,
        ttl
      },
      existingContracts: [...registrarFixture.states(), ...extraContracts],
      blockTimeStamp: currentTs
    })
  }

  test('register', async () => {
    const nodeOwner = randomAssetAddress()
    const ttl = 100n
    const credentialTokenId = getCredentialTokenId(ttl)

    const testResult = await register(nodeOwner, credentialTokenId, ttl, 99)
    const recordState = getContractState<RecordTypes.Fields>(testResult.contracts, secondaryRecordId)
    expect(recordState.fields.owner).toEqual(nodeOwner)
    expect(recordState.fields.ttl).toEqual(ttl)

    const contractOutput = testResult.txOutputs.find((o) => o.address === addressFromContractId(secondaryRecordId))!
    expect(contractOutput.tokens).toEqual([])

    expectAssertionError(register(nodeOwner, credentialTokenId, ttl, 100), registrarFixture.address, Number(ErrorCodes.InvalidArgs))
    expectAssertionError(register(nodeOwner, randomContractId(), ttl, 99), registrarFixture.address, Number(ErrorCodes.InvalidCredentialToken))
    expectAssertionError(register(nodeOwner, credentialTokenId, ttl + 1n, 99), registrarFixture.address, Number(ErrorCodes.InvalidCredentialToken))
  })

  test('remove the expired record and create a new record', async () => {
    const nodeOwner = randomAssetAddress()
    const secondaryRecord = createRecord(addressFromContractId(secondaryRecordId), registrarFixture.contractId, nodeOwner, 100n)
    const invalidCredentialTokenId = getCredentialTokenId(99n)
    expectAssertionError(register(nodeOwner, invalidCredentialTokenId, 99n, 98, [secondaryRecord]), registrarFixture.address, Number(ErrorCodes.InvalidCredentialToken))

    const ttl = 101n
    const credentialTokenId = getCredentialTokenId(ttl)
    const testResult = await register(nodeOwner, credentialTokenId, ttl, 98, [secondaryRecord])
    const newSecondaryRecord = getContractState<RecordTypes.Fields>(testResult.contracts, secondaryRecordId)
    expect(newSecondaryRecord.fields.ttl).toEqual(ttl)
  })
})