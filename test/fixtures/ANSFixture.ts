import {
  addressFromContractId,
  Asset,
  binToHex,
  contractIdFromAddress,
  ContractState,
  Fields,
  ONE_ALPH,
  Project,
  subContractId
} from "@alephium/web3"
import { randomBytes } from "crypto"
import * as base58 from 'bs58'
import {
  ANSRegistry,
  ANSRegistryTypes,
  AccountResolver,
  AccountResolverTypes,
  Record,
  RecordTypes,
  AccountInfo,
  AccountInfoTypes,
  Registrar,
  RegistrarTypes
} from "../../artifacts/ts"

export const defaultInitialAsset: Asset = {
  alphAmount: ONE_ALPH
}
export const GasPrice = 100000000000n
export const MaxGasPerTx = 625000n
export const DefaultGasFee = GasPrice * MaxGasPerTx
export const DefaultGroup = 0
export const RootNode = "b2453cbabd12c58b21d32b6c70e6c41c8ca2918d7f56c1b88e838edf168776bf"
export const MaxTTL = 1n << 255n

export const ErrorCodes = ANSRegistry.consts.ErrorCodes

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

function createRecordTemplate(): ContractFixture<RecordTypes.Fields> {
  const state = Record.stateForTest({
    registrar: "",
    owner: randomAssetAddress(),
    ttl: 0n,
    resolver: "",
    refundAddress: randomAssetAddress()
  }, defaultInitialAsset)
  return new ContractFixture(state, [])
}

export function createANSRegistry(admin: string): ContractFixture<ANSRegistryTypes.Fields> {
  const recordFixture = createRecordTemplate()
  const state = ANSRegistry.stateForTest({
    admin: admin,
    recordTemplateId: recordFixture.contractId
  }, defaultInitialAsset)
  return new ContractFixture(state, recordFixture.states())
}

export function createRecord(initFields: RecordTypes.Fields, address: string): RecordTypes.State {
  const contractId = binToHex(contractIdFromAddress(address))
  return Record.stateForTest(initFields, {
    alphAmount: ONE_ALPH,
    tokens: [{ id: contractId, amount: 1n }]
  }, address)
}

export function subContractAddress(parentId: string, path: string, groupIndex: number): string {
  return addressFromContractId(subContractId(parentId, path, groupIndex))
}

export function zeroPad(value: string, byteLength: number): string {
  const expectedLength = 2 * byteLength
  if (value.length < expectedLength) {
      const prefix = Array(expectedLength - value.length).fill('0').join("")
      return prefix + value
  }
  return value
}

function createAccountInfoTemplate(): ContractFixture<AccountInfoTypes.Fields> {
  const state = AccountInfo.stateForTest({
    resolver: '',
    pubkey: '',
    addresses: ''
  }, defaultInitialAsset)
  return new ContractFixture(state, [])
}

export function createAccountResolver(registrarFixture: ContractFixture<RegistrarTypes.Fields>): ContractFixture<AccountResolverTypes.Fields> {
  const accountInfoTemplate = createAccountInfoTemplate()
  const state = AccountResolver.stateForTest({
    ansRegistry: registrarFixture.selfState.fields.ansRegistry,
    registrar: registrarFixture.contractId,
    accountInfoTemplateId: accountInfoTemplate.contractId,
  }, defaultInitialAsset)
  return new ContractFixture(
    state,
    [
      ...registrarFixture.states(),
      accountInfoTemplate.selfState,
    ]
  )
}

export function createRegistrar(
  owner: string,
  ansRegistryFixture: ContractFixture<ANSRegistryTypes.Fields>
) {
  const state = Registrar.stateForTest({
    registrarOwner: owner,
    ansRegistry: ansRegistryFixture.contractId
  }, defaultInitialAsset)
  const rootRecord = createRecord({
    registrar: state.contractId,
    owner: addressFromContractId(state.contractId),
    ttl: MaxTTL,
    resolver: '',
    refundAddress: owner
  }, subContractAddress(ansRegistryFixture.contractId, RootNode, DefaultGroup))
  return new ContractFixture(state, [rootRecord, ...ansRegistryFixture.states()])
}

export function alph(num: number): bigint {
  return ONE_ALPH * BigInt(num)
}

export function randomAssetAddress(): string {
  const prefix = Buffer.from([0x00])
  const bytes = Buffer.concat([prefix, randomBytes(32)])
  return base58.encode(bytes)
}

export function randomContractId(): string {
  return binToHex(randomBytes(32))
}

export function getContractState<T extends Fields>(contracts: ContractState[], idOrAddress: string): ContractState<T> {
  return contracts.find((c) => c.contractId === idOrAddress || c.address === idOrAddress)! as ContractState<T>
}

export async function buildProject(): Promise<void> {
  if (Project.currentProject === undefined) {
    await Project.build({ ignoreUnusedConstantsWarnings: true })
  }
}
