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
  AddressInfo,
  AddressInfoTypes,
  AddressResolverTest,
  AddressResolverTestTypes,
  ANSRegistry,
  ANSRegistryTypes,
  DefaultResolver,
  DefaultResolverTypes,
  NameInfo,
  NameInfoTypes,
  NameResolverTest,
  NameResolverTestTypes,
  PubkeyInfo,
  PubkeyInfoTypes,
  PubkeyResolverTest,
  PubkeyResolverTestTypes,
  Record,
  RecordTypes
} from "../../artifacts/ts"

export const defaultInitialAsset: Asset = {
  alphAmount: ONE_ALPH
}
export const gasPrice = 100000000000n
export const maxGasPerTx = 625000n
export const defaultGasFee = gasPrice * maxGasPerTx
export const defaultGroup = 0

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

async function createRecordTemplate(): Promise<ContractFixture<RecordTypes.Fields>> {
  const state = Record.stateForTest({
    registrar: "",
    owner: randomAssetAddress(),
    ttl: 0n,
    resolver: "",
    refundAddress: randomAssetAddress()
  }, defaultInitialAsset)
  return new ContractFixture(state, [])
}

export async function createANSRegistry(admin: string): Promise<ContractFixture<ANSRegistryTypes.Fields>> {
  const recordFixture = await createRecordTemplate()
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

async function createAddressInfoTemplate(): Promise<ContractFixture<AddressInfoTypes.Fields>> {
  const state = AddressInfo.stateForTest({
    parentId: '',
    addresses: ''
  }, defaultInitialAsset)
  return new ContractFixture(state, [])
}

export async function createAddressResolver(ansRegistryFixture: ContractFixture<ANSRegistryTypes.Fields>): Promise<ContractFixture<AddressResolverTestTypes.Fields>> {
  const addressInfoTemplate = await createAddressInfoTemplate()
  const state = AddressResolverTest.stateForTest({
    ansRegistryId: ansRegistryFixture.contractId,
    addressInfoTemplateId: addressInfoTemplate.contractId
  }, defaultInitialAsset)
  return new ContractFixture(state, addressInfoTemplate.states().concat(ansRegistryFixture.states()))
}

async function createNameInfoTemplate(): Promise<ContractFixture<NameInfoTypes.Fields>> {
  const state = NameInfo.stateForTest(
    { parentId: '', name: '' },
    defaultInitialAsset
  )
  return new ContractFixture(state, [])
}

export async function createNameResolver(ansRegistryFixture: ContractFixture<ANSRegistryTypes.Fields>): Promise<ContractFixture<NameResolverTestTypes.Fields>> {
  const nameInfoTemplate = await createNameInfoTemplate()
  const state = NameResolverTest.stateForTest({
    ansRegistryId: ansRegistryFixture.contractId,
    nameInfoTemplateId: nameInfoTemplate.contractId
  }, defaultInitialAsset)
  return new ContractFixture(state, nameInfoTemplate.states().concat(ansRegistryFixture.states()))
}

async function createPubkeyInfoTemplate(): Promise<ContractFixture<PubkeyInfoTypes.Fields>> {
  const state = PubkeyInfo.stateForTest(
    { parentId: '', pubkey: '' },
    defaultInitialAsset
  )
  return new ContractFixture(state, [])
}

export async function createPubkeyResolver(ansRegistryFixture: ContractFixture<ANSRegistryTypes.Fields>): Promise<ContractFixture<PubkeyResolverTestTypes.Fields>> {
  const pubkeyInfoTemplate = await createPubkeyInfoTemplate()
  const state = PubkeyResolverTest.stateForTest({
    ansRegistryId: ansRegistryFixture.contractId,
    pubkeyInfoTemplateId: pubkeyInfoTemplate.contractId
  }, defaultInitialAsset)
  return new ContractFixture(state, pubkeyInfoTemplate.states().concat(ansRegistryFixture.states()))
}

export async function createDefaultResolver(ansRegistryFixture: ContractFixture<ANSRegistryTypes.Fields>): Promise<ContractFixture<DefaultResolverTypes.Fields>> {
  const addressInfoTemplate = await createAddressInfoTemplate()
  const nameInfoTemplate = await createNameInfoTemplate()
  const pubkeyInfoTemplate = await createPubkeyInfoTemplate()
  const state = DefaultResolver.stateForTest({
    ansRegistryId: ansRegistryFixture.contractId,
    addressInfoTemplateId: addressInfoTemplate.contractId,
    nameInfoTemplateId: nameInfoTemplate.contractId,
    pubkeyInfoTemplateId: pubkeyInfoTemplate.contractId,
  }, defaultInitialAsset)
  return new ContractFixture(
    state,
    [
      ...ansRegistryFixture.states(),
      addressInfoTemplate.selfState,
      nameInfoTemplate.selfState,
      pubkeyInfoTemplate.selfState
    ]
  )
}

export function alph(num: number): bigint {
  return ONE_ALPH * BigInt(num)
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

export function getContractState<T extends Fields>(contracts: ContractState[], idOrAddress: string): ContractState<T> {
  return contracts.find((c) => c.contractId === idOrAddress || c.address === idOrAddress)! as ContractState<T>
}

export async function buildProject(): Promise<void> {
  if (Project.currentProject === undefined) {
    await Project.build({ ignoreUnusedConstantsWarnings: true })
  }
}
