import { addressFromContractId, binToHex, ContractState, DUST_AMOUNT, ONE_ALPH, subContractId, web3 } from "@alephium/web3"
import {
  alph,
  defaultInitialAsset,
  randomAssetAddress,
  DefaultGroup,
  buildProject,
  createPrimaryRegistrar,
  getContractState,
  ErrorCodes,
  createRecord,
  DefaultGasFee,
  createCredentialToken,
  getCredentialTokenPath,
  expectVMAssertionError,
  MinRegistrationDuration
} from "./fixtures/ANSFixture"
import { keccak256 } from "ethers/lib/utils"
import { RecordTypes, PrimaryRegistrar, PrimaryRegistrarTypes } from "../artifacts/ts"
import { expectAssertionError, randomContractId } from "@alephium/web3-test"

function cost(duration: bigint): bigint {
  return 1000n * duration
}

describe("test primary registrar", () => {
  const encoder = new TextEncoder()

  beforeAll(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
    await buildProject()
  })

  test('register', async () => {
    const registrarOwner = randomAssetAddress()
    const registrarFixture = createPrimaryRegistrar(registrarOwner)

    const name = encoder.encode("test")
    const node = keccak256(name).slice(2)
    const recordId = subContractId(registrarFixture.contractId, node, DefaultGroup)

    async function register(nodeOwner: string, duration: bigint, currentTs: number, extraContracts: ContractState[] = []) {
      const alphAmount = alph(1) + cost(duration) + DUST_AMOUNT + DefaultGasFee
      return PrimaryRegistrar.tests.register({
        address: registrarFixture.address,
        initialFields: registrarFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: nodeOwner, asset: { alphAmount } }],
        testArgs: {
          name: binToHex(name),
          owner: nodeOwner,
          payer: nodeOwner,
          duration: duration
        },
        existingContracts: [...registrarFixture.states(), ...extraContracts],
        blockTimeStamp: currentTs
      })
    }

    const nodeOwner = randomAssetAddress()
    const testResult = await register(nodeOwner, MinRegistrationDuration, 0)

    const registrarState = getContractState<PrimaryRegistrarTypes.Fields>(testResult.contracts, registrarFixture.contractId)
    expect(registrarState.asset.alphAmount).toEqual(ONE_ALPH + cost(MinRegistrationDuration))

    const recordState = getContractState<RecordTypes.Fields>(testResult.contracts, recordId)
    expect(recordState.fields.owner).toEqual(nodeOwner)
    expect(recordState.fields.ttl).toEqual(MinRegistrationDuration)

    const event = testResult.events.find(e => e.name === 'NameRegistered')! as PrimaryRegistrarTypes.NameRegisteredEvent
    expect(event.fields).toEqual({ name: binToHex(name), owner: nodeOwner, ttl: MinRegistrationDuration })

    const record = createRecord(
      addressFromContractId(recordId),
      registrarFixture.contractId,
      randomAssetAddress(),
      100n
    )
    expectAssertionError(register(nodeOwner, MinRegistrationDuration, 99, [record]), registrarFixture.address, Number(ErrorCodes.NameHasBeenRegistered))
  })

  test('register with an expired name', async () => {
    const registrarOwner = randomAssetAddress()
    const registrarFixture = createPrimaryRegistrar(registrarOwner)

    const name = encoder.encode("test")
    const node = keccak256(name).slice(2)
    const recordId = subContractId(registrarFixture.contractId, node, DefaultGroup)
    const prevNodeOwner = randomAssetAddress()
    const expiredRecord = createRecord(
      addressFromContractId(recordId),
      registrarFixture.contractId,
      prevNodeOwner,
      100n
    )
    async function register(nodeOwner: string, duration: bigint) {
      const alphAmount = alph(2) + cost(duration) + DUST_AMOUNT + DefaultGasFee
      return PrimaryRegistrar.tests.register({
        address: registrarFixture.address,
        initialFields: registrarFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: nodeOwner, asset: { alphAmount } }],
        testArgs: {
          name: binToHex(name),
          owner: nodeOwner,
          payer: nodeOwner,
          duration: duration
        },
        existingContracts: [...registrarFixture.states(), expiredRecord],
        blockTimeStamp: 101
      })
    }

    const nodeOwner = randomAssetAddress()
    const testResult = await register(nodeOwner, MinRegistrationDuration)

    const registrarState = getContractState<PrimaryRegistrarTypes.Fields>(testResult.contracts, registrarFixture.contractId)
    expect(registrarState.asset.alphAmount).toEqual(ONE_ALPH + cost(MinRegistrationDuration))

    const recordState = getContractState<RecordTypes.Fields>(testResult.contracts, recordId)
    expect(recordState.fields.owner).toEqual(nodeOwner)
    const ttl = MinRegistrationDuration + 101n
    expect(recordState.fields.ttl).toEqual(ttl)

    const event = testResult.events.find(e => e.name === 'NameRegistered')! as PrimaryRegistrarTypes.NameRegisteredEvent
    expect(event.fields).toEqual({ name: binToHex(name), owner: nodeOwner, ttl })

    const prevNodeOwnerOutput = testResult.txOutputs.find((o) => o.address === prevNodeOwner)!
    expect(prevNodeOwnerOutput.alphAmount).toEqual(alph(1))
  })

  test('renew', async () => {
    const registrarOwner = randomAssetAddress()
    const registrarFixture = createPrimaryRegistrar(registrarOwner)

    const name = encoder.encode("test")
    const node = keccak256(name).slice(2)
    const recordId = subContractId(registrarFixture.contractId, node, DefaultGroup)

    async function renew(nodeOwner: string, duration: bigint, currentTs: number, contractStates: ContractState[] = []) {
      const alphAmount = alph(1) + cost(duration) + DUST_AMOUNT + DefaultGasFee
      return PrimaryRegistrar.tests.renew({
        address: registrarFixture.address,
        initialFields: registrarFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: nodeOwner, asset: { alphAmount } }],
        testArgs: {
          name: binToHex(name),
          payer: nodeOwner,
          duration: duration
        },
        existingContracts: [...registrarFixture.states(), ...contractStates],
        blockTimeStamp: currentTs
      })
    }

    function getRecord(ttl: bigint): ContractState {
      return createRecord(addressFromContractId(recordId), registrarFixture.contractId, nodeOwner, ttl)
    }

    const nodeOwner = randomAssetAddress()
    const record = getRecord(100n)
    expectAssertionError(renew(nodeOwner, MinRegistrationDuration, 101, [record]), registrarFixture.address, Number(ErrorCodes.NameHasExpired))

    const testResult = await renew(nodeOwner, MinRegistrationDuration, 99, [record])
    const registrarState = getContractState<PrimaryRegistrarTypes.Fields>(testResult.contracts, registrarFixture.contractId)
    expect(registrarState.asset.alphAmount).toEqual(ONE_ALPH + cost(MinRegistrationDuration))

    const ttl = 100n + MinRegistrationDuration
    const recordState = getContractState<RecordTypes.Fields>(testResult.contracts, recordId)
    expect(recordState.fields.ttl).toEqual(ttl)

    const event = testResult.events.find(e => e.name === 'NameRenewed')! as PrimaryRegistrarTypes.NameRenewedEvent
    expect(event.fields).toEqual({ name: binToHex(name), ttl })
  })

  test('mint credential token', async () => {
    const registrarOwner = randomAssetAddress()
    const registrarFixture = createPrimaryRegistrar(registrarOwner)
    const nodeOwner = randomAssetAddress()

    const name = encoder.encode("test")
    const node = keccak256(name).slice(2)
    const recordId = subContractId(registrarFixture.contractId, node, DefaultGroup)

    function getRecordAndCredentialToken(ttl: bigint): [ContractState, ContractState] {
      const credentialTokenId = subContractId(registrarFixture.contractId, getCredentialTokenPath(node, BigInt(ttl)), DefaultGroup)
      const record = createRecord(
        addressFromContractId(recordId),
        registrarFixture.contractId,
        nodeOwner,
        ttl
      )
      const credentialToken = createCredentialToken(registrarFixture.contractId, binToHex(name), addressFromContractId(credentialTokenId))
      return [record, credentialToken]
    }

    async function mintCredentialToken(nodeOwner: string, currentTs: number, contractStates: ContractState[] = []) {
      return PrimaryRegistrar.tests.mintCredentialToken({
        address: registrarFixture.address,
        initialFields: registrarFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: nodeOwner, asset: { alphAmount: alph(2) } }],
        testArgs: {
          name: binToHex(name),
          payer: nodeOwner
        },
        existingContracts: [...registrarFixture.states(), ...contractStates],
        blockTimeStamp: currentTs
      })
    }

    const [record, credentialToken] = getRecordAndCredentialToken(100n)
    expectAssertionError(mintCredentialToken(randomAssetAddress(), 99, [record]), registrarFixture.address, Number(ErrorCodes.InvalidCaller))
    expectAssertionError(mintCredentialToken(nodeOwner, 101, [record]), registrarFixture.address, Number(ErrorCodes.NameHasExpired))

    const testResult = await mintCredentialToken(nodeOwner, 99, [record])
    const assetOutput = testResult.txOutputs.find((o) => o.address === nodeOwner)!
    expect(assetOutput.tokens).toEqual([{ id: credentialToken.contractId, amount: 1n }])
  })

  test('burn credential token', async () => {
    const registrarOwner = randomAssetAddress()
    const registrarFixture = createPrimaryRegistrar(registrarOwner)
    const nodeOwner = randomAssetAddress()

    const name = encoder.encode("test")
    const node = keccak256(name).slice(2)
    const recordId = subContractId(registrarFixture.contractId, node, DefaultGroup)

    function getRecordAndCredentialToken(ttl: bigint): [ContractState, ContractState] {
      const credentialTokenId = subContractId(registrarFixture.contractId, getCredentialTokenPath(node, BigInt(ttl)), DefaultGroup)
      const record = createRecord(
        addressFromContractId(recordId),
        registrarFixture.contractId,
        nodeOwner,
        ttl
      )
      const credentialToken = createCredentialToken(registrarFixture.contractId, binToHex(name), addressFromContractId(credentialTokenId))
      return [record, credentialToken]
    }

    async function burnCredentialToken(nodeOwner: string, currentTs: number, credentialTokenId: string, contractStates: ContractState[] = []) {
      return PrimaryRegistrar.tests.burnCredentialToken({
        address: registrarFixture.address,
        initialFields: registrarFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: nodeOwner, asset: { alphAmount: alph(1), tokens: [{ id: credentialTokenId, amount: 1n }] } }],
        testArgs: {
          name: binToHex(name),
          payer: nodeOwner
        },
        existingContracts: [...registrarFixture.states(), ...contractStates],
        blockTimeStamp: currentTs
      })
    }

    const [record, credentialToken] = getRecordAndCredentialToken(100n)
    expectAssertionError(burnCredentialToken(randomAssetAddress(), 99, credentialToken.contractId, [record, credentialToken]), registrarFixture.address, Number(ErrorCodes.InvalidCaller))
    expectAssertionError(burnCredentialToken(nodeOwner, 101, credentialToken.contractId, [record, credentialToken]), registrarFixture.address, Number(ErrorCodes.NameHasExpired))
    expectVMAssertionError(burnCredentialToken(nodeOwner, 99, randomContractId(), [record, credentialToken]), 'NotEnoughApprovedBalance')

    const testResult = await burnCredentialToken(nodeOwner, 99, credentialToken.contractId, [record, credentialToken])
    expect(testResult.contracts.find((c) => c.contractId === credentialToken.contractId)).toEqual(undefined)
  })
})
