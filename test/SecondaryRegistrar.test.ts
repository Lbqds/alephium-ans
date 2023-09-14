import { addressFromContractId, binToHex, ContractState, subContractId, web3 } from "@alephium/web3"
import {
  alph,
  defaultInitialAsset,
  randomAssetAddress,
  createPubkeyResolver,
  DefaultGroup,
  buildProject,
  createSecondaryRegistrar,
  getContractState,
  createSecondaryRecord,
  getRecordTokenPath,
  ErrorCodes
} from "./fixtures/ANSFixture"
import { keccak256 } from "ethers/lib/utils"
import { SecondaryRecordTypes, SecondaryRegistrar } from "../artifacts/ts"
import { expectAssertionError, randomContractId } from "@alephium/web3-test"

describe("test secondary registrar", () => {
  const encoder = new TextEncoder()

  beforeAll(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
    await buildProject()
  })

  const primaryRegistrarId = randomContractId()
  const registrarFixture = createSecondaryRegistrar(primaryRegistrarId)
  const resolverFixture = createPubkeyResolver(registrarFixture)

  const name = encoder.encode("test")
  const node = keccak256(name).slice(2)
  const secondaryRecordId = subContractId(registrarFixture.contractId, node, DefaultGroup)

  function getCredentialTokenId(ttl: bigint): string {
    const path = getRecordTokenPath(node, ttl)
    return subContractId(primaryRegistrarId, path, DefaultGroup)
  }

  async function register(nodeOwner: string, credentialTokenId: string, ttl: bigint, extraContracts: ContractState[] = []) {
    return SecondaryRegistrar.tests.register({
      address: registrarFixture.address,
      initialFields: registrarFixture.initialFields(),
      initialAsset: defaultInitialAsset,
      inputAssets: [{ address: nodeOwner, asset: { alphAmount: alph(2), tokens: [{ id: credentialTokenId, amount: 1n }] } }],
      testArgs: {
        name: binToHex(name),
        owner: nodeOwner,
        payer: nodeOwner,
        resolver: resolverFixture.contractId,
        credentialTokenId,
        ttl
      },
      existingContracts: [...resolverFixture.states(), ...extraContracts]
    })
  }

  test('register', async () => {
    const nodeOwner = randomAssetAddress()
    const ttl = 100n
    const credentialTokenId = getCredentialTokenId(ttl)

    const testResult = await register(nodeOwner, credentialTokenId, ttl)
    const recordState = getContractState<SecondaryRecordTypes.Fields>(testResult.contracts, secondaryRecordId)
    expect(recordState.fields.owner).toEqual(nodeOwner)
    expect(recordState.fields.resolver).toEqual(resolverFixture.contractId)
    expect(recordState.fields.ttl).toEqual(ttl)

    const contractOutput = testResult.txOutputs.find((o) => o.address === addressFromContractId(secondaryRecordId))!
    expect(contractOutput.tokens).toEqual([])

    expectAssertionError(register(nodeOwner, randomContractId(), ttl), registrarFixture.address, Number(ErrorCodes.InvalidCredentialToken))
    expectAssertionError(register(nodeOwner, credentialTokenId, ttl + 1n), registrarFixture.address, Number(ErrorCodes.InvalidCredentialToken))
  })

  test('remove the expired record and create a new record', async () => {
    const nodeOwner = randomAssetAddress()
    const secondaryRecord = createSecondaryRecord(addressFromContractId(secondaryRecordId), registrarFixture.contractId, nodeOwner, '', 100n)
    const invalidCredentialTokenId = getCredentialTokenId(99n)
    expectAssertionError(register(nodeOwner, invalidCredentialTokenId, 99n, [secondaryRecord]), registrarFixture.address, Number(ErrorCodes.InvalidCredentialToken))

    const ttl = 101n
    const credentialTokenId = getCredentialTokenId(ttl)
    const testResult = await register(nodeOwner, credentialTokenId, ttl, [secondaryRecord])
    const newSecondaryRecord = getContractState<SecondaryRecordTypes.Fields>(testResult.contracts, secondaryRecordId)
    expect(newSecondaryRecord.fields.ttl).toEqual(ttl)
  })
})