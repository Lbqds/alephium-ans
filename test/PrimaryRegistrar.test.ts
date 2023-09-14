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
  createPrimaryRecord,
  DefaultGasFee,
  createRecordToken,
  getRecordTokenPath
} from "./fixtures/ANSFixture"
import { keccak256 } from "ethers/lib/utils"
import { PrimaryRecordTypes, PrimaryRegistrar, PrimaryRegistrarTypes } from "../artifacts/ts"
import { expectAssertionError } from "@alephium/web3-test"

const MinRentDuration = PrimaryRegistrar.consts.MinRentDuration

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
        existingContracts: [...registrarFixture.states(), ...extraContracts],
        blockTimeStamp: currentTs
      })
    }

    const nodeOwner = randomAssetAddress()
    const testResult = await register(nodeOwner, MinRentDuration, 0)

    const registrarState = getContractState<PrimaryRegistrarTypes.Fields>(testResult.contracts, registrarFixture.contractId)
    expect(registrarState.asset.alphAmount).toEqual(ONE_ALPH + cost(MinRentDuration))

    const recordState = getContractState<PrimaryRecordTypes.Fields>(testResult.contracts, recordId)
    expect(recordState.fields.owner).toEqual(nodeOwner)
    expect(recordState.fields.ttl).toEqual(MinRentDuration)

    const recordTokenPath = getRecordTokenPath(node, MinRentDuration)
    const recordTokenId = subContractId(registrarFixture.contractId, recordTokenPath, DefaultGroup)
    expect(recordState.fields.recordTokenId).toEqual(recordTokenId)

    const assetOutput = testResult.txOutputs.find((o) => o.address === nodeOwner)!
    const recordToken = assetOutput.tokens?.find((t) => t.id === recordTokenId)
    expect(recordToken).toEqual({ id: recordTokenId, amount: 1n })

    const event = testResult.events.find(e => e.name === 'NameRegistered')! as PrimaryRegistrarTypes.NameRegisteredEvent
    expect(event.fields).toEqual({ name: binToHex(name), owner: nodeOwner, ttl: MinRentDuration })

    const record = createPrimaryRecord(
      addressFromContractId(recordId),
      registrarFixture.contractId,
      randomAssetAddress(),
      100n
    )
    expectAssertionError(register(nodeOwner, MinRentDuration, 99, [record]), registrarFixture.address, Number(ErrorCodes.NameHasBeenRegistered))
  })

  test('register with an expired name', async () => {
    const registrarOwner = randomAssetAddress()
    const registrarFixture = createPrimaryRegistrar(registrarOwner)

    const name = encoder.encode("test")
    const node = keccak256(name).slice(2)
    const recordId = subContractId(registrarFixture.contractId, node, DefaultGroup)
    const prevNodeOwner = randomAssetAddress()
    const expiredRecordTokenId = subContractId(registrarFixture.contractId, getRecordTokenPath(node, 100n), DefaultGroup)
    const expiredRecord = createPrimaryRecord(
      addressFromContractId(recordId),
      registrarFixture.contractId,
      prevNodeOwner,
      100n,
      expiredRecordTokenId
    )
    const expiredRecordToken = createRecordToken(registrarFixture.contractId, binToHex(name), addressFromContractId(expiredRecordTokenId))

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
        existingContracts: [...registrarFixture.states(), expiredRecord, expiredRecordToken],
        blockTimeStamp: 101
      })
    }

    const nodeOwner = randomAssetAddress()
    const testResult = await register(nodeOwner, MinRentDuration)

    const registrarState = getContractState<PrimaryRegistrarTypes.Fields>(testResult.contracts, registrarFixture.contractId)
    expect(registrarState.asset.alphAmount).toEqual(ONE_ALPH + cost(MinRentDuration))

    const recordState = getContractState<PrimaryRecordTypes.Fields>(testResult.contracts, recordId)
    expect(recordState.fields.owner).toEqual(nodeOwner)
    const ttl = MinRentDuration + 101n
    expect(recordState.fields.ttl).toEqual(ttl)

    const recordTokenPath = getRecordTokenPath(node, ttl)
    const recordTokenId = subContractId(registrarFixture.contractId, recordTokenPath, DefaultGroup)
    expect(recordState.fields.recordTokenId).toEqual(recordTokenId)

    const assetOutput = testResult.txOutputs.find((o) => o.address === nodeOwner)!
    const recordToken = assetOutput.tokens?.find((t) => t.id === recordTokenId)
    expect(recordToken).toEqual({ id: recordTokenId, amount: 1n })

    const event = testResult.events.find(e => e.name === 'NameRegistered')! as PrimaryRegistrarTypes.NameRegisteredEvent
    expect(event.fields).toEqual({ name: binToHex(name), owner: nodeOwner, ttl })

    expect(testResult.contracts.find((c) => c.contractId === expiredRecordTokenId)).toEqual(undefined)

    const prevNodeOwnerOutput = testResult.txOutputs.find((o) => o.address === prevNodeOwner)!
    expect(prevNodeOwnerOutput.alphAmount).toEqual(alph(2))
  })

  test('renew', async () => {
    const registrarOwner = randomAssetAddress()
    const registrarFixture = createPrimaryRegistrar(registrarOwner)

    const name = encoder.encode("test")
    const node = keccak256(name).slice(2)
    const recordId = subContractId(registrarFixture.contractId, node, DefaultGroup)

    async function renew(nodeOwner: string, duration: bigint, currentTs: number, recordTokenId: string, contractStates: ContractState[] = []) {
      const alphAmount = alph(1) + cost(duration) + DUST_AMOUNT + DefaultGasFee
      return PrimaryRegistrar.tests.renew({
        address: registrarFixture.address,
        initialFields: registrarFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: nodeOwner, asset: { alphAmount, tokens: [{ id: recordTokenId, amount: 1n }] } }],
        testArgs: {
          name: binToHex(name),
          payer: nodeOwner,
          duration: duration
        },
        existingContracts: [...registrarFixture.states(), ...contractStates],
        blockTimeStamp: currentTs
      })
    }

    function getRecord(ttl: bigint): [ContractState, ContractState] {
      const recordTokenId = subContractId(registrarFixture.contractId, getRecordTokenPath(node, BigInt(ttl)), DefaultGroup)
      const record = createPrimaryRecord(
        addressFromContractId(recordId),
        registrarFixture.contractId,
        nodeOwner,
        ttl,
        recordTokenId
      )
      const recordToken = createRecordToken(registrarFixture.contractId, binToHex(name), addressFromContractId(recordTokenId))
      return [record, recordToken]
    }

    const nodeOwner = randomAssetAddress()
    const [record, prevRecordToken] = getRecord(100n)
    expectAssertionError(renew(nodeOwner, MinRentDuration, 101, prevRecordToken.contractId, [record, prevRecordToken]), registrarFixture.address, Number(ErrorCodes.NameHasExpired))

    const testResult = await renew(nodeOwner, MinRentDuration, 99, prevRecordToken.contractId, [record, prevRecordToken])
    const registrarState = getContractState<PrimaryRegistrarTypes.Fields>(testResult.contracts, registrarFixture.contractId)
    expect(registrarState.asset.alphAmount).toEqual(ONE_ALPH + cost(MinRentDuration))

    const ttl = 100n + MinRentDuration
    const recordTokenId = subContractId(registrarFixture.contractId, getRecordTokenPath(node, ttl), DefaultGroup)

    const recordState = getContractState<PrimaryRecordTypes.Fields>(testResult.contracts, recordId)
    expect(recordState.fields.ttl).toEqual(ttl)
    expect(recordState.fields.recordTokenId).toEqual(recordTokenId)

    const assetOutput = testResult.txOutputs.find((o) => o.address === nodeOwner)!
    const recordToken = assetOutput.tokens?.find((t) => t.id === recordTokenId)
    expect(recordToken).toEqual({ id: recordTokenId, amount: 1n })

    const event = testResult.events.find(e => e.name === 'NameRenewed')! as PrimaryRegistrarTypes.NameRenewedEvent
    expect(event.fields).toEqual({ name: binToHex(name), ttl })

    expect(testResult.contracts.find((c) => c.contractId === prevRecordToken.contractId)).toEqual(undefined)
  })
})
