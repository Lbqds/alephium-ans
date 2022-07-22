import { addressFromContractId, Asset, binToHex, Contract, contractIdFromAddress, ContractState, Fields, NodeProvider, subContractId } from "@alephium/web3"
import { randomBytes } from "crypto"
import * as base58 from 'bs58'

export const testProvider = new NodeProvider("http://127.0.0.1:22973")
export const oneAlph = BigInt("1000000000000000000")
export const defaultInitialAsset: Asset = {
  alphAmount: oneAlph
}
export const gasPrice = BigInt("100000000000")
export const maxGasPerTx = BigInt("625000")
export const defaultGasFee = gasPrice * maxGasPerTx

export class ContractInfo {
  contract: Contract
  state: ContractState
  dependencies: ContractState[]

  states(): ContractState[] {
      return [this.state].concat(this.dependencies)
  }

  initialFields(): Fields {
    return this.state.fields
  }

  constructor(contract: Contract, state: ContractState, dependencies: ContractState[]) {
      this.contract = contract
      this.state = state
      this.dependencies = dependencies
  }
}

async function createRecordTemplate(): Promise<ContractInfo> {
  const contract = await Contract.fromSource(testProvider, 'record.ral')
  const state = contract.toState({
    "registrar": "",
    "owner": randomAssetAddress(),
    "ttl": 0,
    "resolver": "",
    "refundAddress": randomAssetAddress()
  }, defaultInitialAsset)
  return new ContractInfo(contract, state, [])
}

export async function createANSRegistry(admin: string): Promise<ContractInfo> {
  const contract = await Contract.fromSource(testProvider, 'ans_registry.ral')
  const recordInfo = await createRecordTemplate()
  const state = contract.toState({
    "admin": admin,
    "recordTemplateId": recordInfo.state.contractId
  }, defaultInitialAsset)
  return new ContractInfo(contract, state, recordInfo.states())
}

export async function createRecord(initFields: Fields, address: string): Promise<ContractState> {
  const record = await Contract.fromSource(testProvider, 'record.ral')
  const contractId = binToHex(contractIdFromAddress(address))
  return record.toState(initFields, {
    alphAmount: oneAlph,
    tokens: [{
      id: contractId,
      amount: 1
    }]
  }, address)
}

export function subContractAddress(parentId: string, path: string): string {
  return addressFromContractId(subContractId(parentId, path))
}

export function zeroPad(value: string, byteLength: number): string {
  const expectedLength = 2 * byteLength
  if (value.length < expectedLength) {
      const prefix = Array(expectedLength - value.length).fill('0').join("")
      return prefix + value
  }
  return value
}

async function createAddressInfoTemplate(): Promise<ContractInfo> {
  const contract = await Contract.fromSource(testProvider, 'address_info.ral')
  const state = contract.toState({
    "parentId": "",
    "addresses": ""
  }, defaultInitialAsset)
  return new ContractInfo(contract, state, [])
}

export async function createAddressResolver(ansRegistryInfo: ContractInfo): Promise<ContractInfo> {
  const contract = await Contract.fromSource(testProvider, 'address_resolver.ral')
  const addressInfoTemplate = await createAddressInfoTemplate()
  const state = contract.toState({
    "ansRegistryId": ansRegistryInfo.state.contractId,
    "addressInfoTemplateId": addressInfoTemplate.state.contractId
  }, defaultInitialAsset)
  return new ContractInfo(contract, state, [...addressInfoTemplate.states(), ...ansRegistryInfo.states()])
}

async function createNameInfoTemplate(): Promise<ContractInfo> {
  const contract = await Contract.fromSource(testProvider, 'name_info.ral')
  const state = contract.toState({
    "parentId": "",
    "name": ""
  }, defaultInitialAsset)
  return new ContractInfo(contract, state, [])
}

export async function createNameResolver(ansRegistryInfo: ContractInfo): Promise<ContractInfo> {
  const contract = await Contract.fromSource(testProvider, 'name_resolver.ral')
  const nameInfoTemplate = await createNameInfoTemplate()
  const state = contract.toState({
    "ansRegistryId": ansRegistryInfo.state.contractId,
    "nameInfoTemplateId": nameInfoTemplate.state.contractId
  }, defaultInitialAsset)
  return new ContractInfo(contract, state, [...nameInfoTemplate.states(), ...ansRegistryInfo.states()])
}

async function createPubkeyInfoTemplate(): Promise<ContractInfo> {
  const contract = await Contract.fromSource(testProvider, 'pubkey_info.ral')
  const state = contract.toState({
    "parentId": "",
    "pubkey": ""
  }, defaultInitialAsset)
  return new ContractInfo(contract, state, [])
}

export async function createPubkeyResolver(ansRegistryInfo: ContractInfo): Promise<ContractInfo> {
  const contract = await Contract.fromSource(testProvider, 'pubkey_resolver.ral')
  const pubkeyInfoTemplate = await createPubkeyInfoTemplate()
  const state = contract.toState({
    "ansRegistryId": ansRegistryInfo.state.contractId,
    "pubkeyInfoTemplateId": pubkeyInfoTemplate.state.contractId
  }, defaultInitialAsset)
  return new ContractInfo(contract, state, [...pubkeyInfoTemplate.states(), ...ansRegistryInfo.states()])
}

export async function createDefaultResolver(ansRegistryInfo: ContractInfo): Promise<ContractInfo> {
  const addressInfoTemplate = await createAddressInfoTemplate()
  const nameInfoTemplate = await createNameInfoTemplate()
  const pubkeyInfoTemplate = await createPubkeyInfoTemplate()
  const contract = await Contract.fromSource(testProvider, 'default_resolver.ral')
  const state = contract.toState({
    "ansRegistryId": ansRegistryInfo.state.contractId,
    "addressInfoTemplateId": addressInfoTemplate.state.contractId,
    "nameInfoTemplateId": nameInfoTemplate.state.contractId,
    "pubkeyInfoTemplateId": pubkeyInfoTemplate.state.contractId,
  }, defaultInitialAsset)
  return new ContractInfo(contract, state, [
    ...ansRegistryInfo.states(),
    addressInfoTemplate.state,
    nameInfoTemplate.state,
    pubkeyInfoTemplate.state
  ])
}

export function alph(num: number): bigint {
  return oneAlph * BigInt(num)
}

interface Failed {
  error: {
      detail: string
  }
}

async function expectFailed<T>(func: () => Promise<T>, details: string[]) {
  try {
      await func()
  } catch (exp) {
      const detail = (exp as Failed).error.detail
      expect(details).toContain(detail)
  }
}

export async function expectAssertionFailed<T>(func: () => Promise<T>) {
  await expectFailed(func, ['AssertionFailed', 'AssertionFailedWithErrorCode'])
}

export function randomAssetAddress(): string {
  const prefix = Buffer.from([0x00])
  const bytes = Buffer.concat([prefix, randomBytes(32)])
  return base58.encode(bytes)
}

export function randomContractId(): string {
  return binToHex(randomBytes(32))
}
