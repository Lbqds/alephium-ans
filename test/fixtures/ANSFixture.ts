import {
  Address,
  addressFromContractId,
  Asset,
  binToHex,
  ContractState,
  Fields,
  HexString,
  ONE_ALPH,
  Project,
  subContractId
} from "@alephium/web3"
import { randomBytes } from "crypto"
import * as base58 from 'bs58'
import {
  PubkeyResolver,
  PubkeyResolverTypes,
  PubkeyInfo,
  PubkeyInfoTypes,
  PrimaryRegistrar,
  PrimaryRecordTypes,
  PrimaryRecord,
  SecondaryRecordTypes,
  SecondaryRecord,
  SecondaryRegistrar,
  RecordTokenTypes,
  RecordToken
} from "../../artifacts/ts"
import { randomContractAddress } from "@alephium/web3-test"

export const defaultInitialAsset: Asset = {
  alphAmount: ONE_ALPH
}
export const GasPrice = 100000000000n
export const MaxGasPerTx = 625000n
export const DefaultGasFee = GasPrice * MaxGasPerTx
export const DefaultGroup = 0
export const MaxTTL = 1n << 255n

export const ErrorCodes = PrimaryRegistrar.consts.ErrorCodes

export class ContractFixture<T extends Fields> {
  selfState: ContractState<T>
  dependencies: ContractState[]
  address: string
  contractId: string

  states(): ContractState[] {
    return this.dependencies.concat([this.selfState])
  }

  initialFields(): T {
    return this.selfState.fields
  }

  constructor(selfState: ContractState<T>, dependencies: ContractState[]) {
    this.selfState = selfState
    this.dependencies = dependencies
    this.address = selfState.address
    this.contractId = selfState.contractId
  }
}

export function createPrimaryRecord(
  address: Address,
  registrar: string,
  owner = randomAssetAddress(),
  resolver = '',
  ttl = 0n,
  recordTokenId = ''
): ContractState<PrimaryRecordTypes.Fields> {
  return PrimaryRecord.stateForTest({
    registrar,
    owner,
    resolver,
    refundAddress: owner,
    ttl,
    recordTokenId
  }, undefined, address)
}

export function createSecondaryRecord(
  address: Address,
  registrar: string,
  owner = randomAssetAddress(),
  resolver: string = '',
  ttl = 0n
): ContractState<SecondaryRecordTypes.Fields> {
  return SecondaryRecord.stateForTest({
    registrar,
    owner,
    resolver,
    refundAddress: owner,
    ttl
  }, undefined, address)
}

export function createRecordToken(
  registrar: HexString,
  name: HexString,
  address = randomContractAddress()
): ContractState<RecordTokenTypes.Fields> {
  return RecordToken.stateForTest({ registrar, name }, undefined, address)
}

export function subContractAddress(parentId: string, path: string, groupIndex: number): string {
  return addressFromContractId(subContractId(parentId, path, groupIndex))
}

function createPubkeyInfoTemplate(): ContractFixture<PubkeyInfoTypes.Fields> {
  const state = PubkeyInfo.stateForTest({ resolver: '', pubkey: '' }, defaultInitialAsset)
  return new ContractFixture(state, [])
}

export function createPubkeyResolver(registrarFixture: ContractFixture<Fields>): ContractFixture<PubkeyResolverTypes.Fields> {
  const pubkeyInfoTemplate = createPubkeyInfoTemplate()
  const state = PubkeyResolver.stateForTest({
    registrar: registrarFixture.contractId,
    pubkeyInfoTemplateId: pubkeyInfoTemplate.contractId,
  }, defaultInitialAsset)
  return new ContractFixture(
    state,
    [
      ...registrarFixture.states(),
      pubkeyInfoTemplate.selfState,
    ]
  )
}

export function createPrimaryRegistrar(owner: string) {
  const primaryRecordTemplate = createPrimaryRecord(randomContractAddress(), '')
  const recordTokenTemplate = createRecordToken('', '')
  const state = PrimaryRegistrar.stateForTest({
    registrarOwner: owner,
    recordTemplateId: primaryRecordTemplate.contractId,
    recordTokenTemplateId: recordTokenTemplate.contractId
  }, defaultInitialAsset)
  return new ContractFixture(state, [primaryRecordTemplate, recordTokenTemplate])
}

export function createSecondaryRegistrar(primaryRegistrarId: string) {
  const template = createSecondaryRecord(randomContractAddress(), '')
  const state = SecondaryRegistrar.stateForTest({
    primaryRegistrar: primaryRegistrarId,
    recordTemplateId: template.contractId
  })
  return new ContractFixture(state, [template])
}

export function alph(num: number): bigint {
  return ONE_ALPH * BigInt(num)
}

export function randomAssetAddress(): string {
  const prefix = Buffer.from([0x00])
  const bytes = Buffer.concat([prefix, randomBytes(32)])
  return base58.encode(bytes)
}

export function randomContractId(groupIndex: number): string {
  const contractId = binToHex(randomBytes(32))
  return contractId.slice(0, -2) + groupIndex.toString(16).padStart(2, '0')
}

export function getContractState<T extends Fields>(contracts: ContractState[], idOrAddress: string): ContractState<T> {
  return contracts.find((c) => c.contractId === idOrAddress || c.address === idOrAddress)! as ContractState<T>
}

export async function buildProject(): Promise<void> {
  if (Project.currentProject === undefined) {
    await Project.build({ ignoreUnusedConstantsWarnings: true })
  }
}

export async function expectVMAssertionError(promise: Promise<any>, errorCode: string) {
  try {
    await promise
  } catch (error) {
    if (error instanceof Error) {
      expect(error.message).toEqual(`[API Error] - VM execution error: ${errorCode}`)
      return
    }
    throw error
  }
}

export function getRecordTokenPath(node: HexString, ttl: bigint): HexString {
  return node + ttl.toString(16).padStart(64, '0')
}
