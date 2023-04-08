import { addressFromContractId, binToHex, ONE_ALPH, subContractId, web3 } from "@alephium/web3"
import {
  alph,
  createANSRegistry,
  createRecord,
  defaultInitialAsset,
  randomAssetAddress,
  expectAssertionFailed,
  subContractAddress,
  createDefaultResolver,
  randomContractId,
  ContractFixture,
  defaultGroup,
  getContractState,
  buildProject
} from "./fixtures/ANSFixture"
import { keccak256 } from "ethers/lib/utils"
import { ANSRegistryTypes, RecordTypes, Registrar, RegistrarTypes } from "../artifacts/ts"

describe("test registrar", () => {
  const RootNode = "b2453cbabd12c58b21d32b6c70e6c41c8ca2918d7f56c1b88e838edf168776bf"
  const MaxTTL = 1n << 255n
  const MinRentalPeriod = 2592000000
  const RentPrice = 1000n

  const encoder = new TextEncoder()

  beforeAll(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
    await buildProject()
  })

  async function createRegistrar(owner: string, ansRegistryFixture: ContractFixture<ANSRegistryTypes.Fields>) {
    const resolverFixture = await createDefaultResolver(ansRegistryFixture)
    const state = Registrar.stateForTest({
      registrarOwner: owner,
      ansRegistryId: ansRegistryFixture.contractId,
      defaultResolverId: resolverFixture.contractId
    }, defaultInitialAsset)
    const rootRecord = await createRecord({
      registrar: state.contractId,
      owner: addressFromContractId(state.contractId),
      ttl: MaxTTL,
      resolver: resolverFixture.contractId,
      refundAddress: owner
    }, subContractAddress(ansRegistryFixture.contractId, RootNode, defaultGroup))
    return new ContractFixture(state, [ rootRecord, ...ansRegistryFixture.states(), ...resolverFixture.states()])
  }

  it('should register sub record', async () => {
    const ansRegistryFixture = await createANSRegistry(randomAssetAddress())
    const registrarOwner = randomAssetAddress()
    const registrarFixture = await createRegistrar(registrarOwner, ansRegistryFixture)

    async function register(subNode: string, subNodeOwner: string, rentDuration: number) {
      return Registrar.tests.register({
        address: registrarFixture.address,
        initialFields: registrarFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: subNodeOwner, asset: { alphAmount: alph(2) } }],
        testArgs: {
          name: binToHex(encoder.encode(subNode)),
          owner: subNodeOwner,
          duration: BigInt(rentDuration),
          payer: subNodeOwner
        },
        existingContracts: registrarFixture.dependencies
      })
    }

    const name = "test"
    const subNodeOwner = randomAssetAddress()
    const testResult = await register(name, subNodeOwner, MinRentalPeriod)
    const subRecordState = testResult.contracts[0] as RecordTypes.State
    expect(subRecordState.fields.owner).toEqual(subNodeOwner)
    expect(subRecordState.fields.registrar).toEqual(registrarFixture.contractId)
    const label = keccak256(encoder.encode(name)).slice(2)
    const subNode = keccak256(Buffer.from(RootNode + label, 'hex')).slice(2)
    const expectedContractId = subContractId(ansRegistryFixture.contractId, subNode, defaultGroup)
    expect(subRecordState.contractId).toEqual(expectedContractId)

    const contractOutput = testResult.txOutputs[0]
    expect(contractOutput.tokens).toEqual([{
      id: subRecordState.contractId,
      amount: 1
    }])

    const rentFee = RentPrice * BigInt(MinRentalPeriod)
    const registrarOutput = testResult.txOutputs[1]
    expect(registrarOutput.alphAmount).toEqual(rentFee + ONE_ALPH)

    const newNodeEvents = testResult.events.filter(e => e.name === 'NewNode') as RegistrarTypes.NewNodeEvent[]
    expect(newNodeEvents.length).toEqual(1)
    expect(newNodeEvents[0].fields).toEqual({ node: subNode, owner: subNodeOwner })

    await expectAssertionFailed(async () => register(name, subNodeOwner, MinRentalPeriod - 1))
  })

  it('should remove the expired record on registration', async () => {
    const ansRegistryFixture = await createANSRegistry(randomAssetAddress())
    const resolverFixture = await createDefaultResolver(ansRegistryFixture)
    const registrarOwner = randomAssetAddress()
    const registrarFixture = await createRegistrar(registrarOwner, ansRegistryFixture)
    const name = "test"
    const previousOwner = randomAssetAddress()
    const newOwner = randomAssetAddress()
    const subNodeLabel = keccak256(encoder.encode(name)).slice(2)
    const subNode = keccak256(Buffer.from(RootNode + subNodeLabel, 'hex')).slice(2)
    const subRecordAddress = subContractAddress(ansRegistryFixture.contractId, subNode, defaultGroup)

    async function register(subNode: string, newOwner: string, rentDuration: number) {
      const subRecord = createRecord({
        registrar: registrarFixture.contractId,
        owner: previousOwner,
        ttl: 0n,
        resolver: resolverFixture.contractId,
        refundAddress: previousOwner
      }, subRecordAddress)
      return Registrar.tests.register({
        address: registrarFixture.address,
        initialFields: registrarFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: newOwner, asset: { alphAmount: alph(2) } }],
        testArgs: {
          name: binToHex(encoder.encode(subNode)),
          owner: newOwner,
          duration: BigInt(rentDuration),
          payer: newOwner
        },
        existingContracts: [subRecord, ...registrarFixture.dependencies]
      })
    }

    const testResult = await register(name, newOwner, MinRentalPeriod)
    const expectedContractId = subContractId(ansRegistryFixture.contractId, subNode, defaultGroup)
    const subRecordState = getContractState<RecordTypes.Fields>(testResult.contracts, expectedContractId)
    expect(subRecordState.fields.owner).toEqual(newOwner)
    expect(subRecordState.fields.registrar).toEqual(registrarFixture.contractId)
    expect(subRecordState.contractId).toEqual(expectedContractId)

    const contractOutput = testResult.txOutputs.find(c => c.address === subRecordAddress)!
    expect(contractOutput.tokens).toEqual([{
      id: subRecordState.contractId,
      amount: 1
    }])

    const refundOutput = testResult.txOutputs.find(c => c.address === previousOwner)!
    expect(refundOutput.alphAmount).toEqual(ONE_ALPH)

    const rentFee = RentPrice * BigInt(MinRentalPeriod)
    const registrarOutput = testResult.txOutputs.find(c => c.address == registrarFixture.address)!
    expect(registrarOutput.alphAmount).toEqual(rentFee + ONE_ALPH)

    const newNodeEvents = testResult.events.filter(e => e.name === 'NewNode') as RegistrarTypes.NewNodeEvent[]
    expect(newNodeEvents.length).toEqual(1)
    expect(newNodeEvents[0].fields).toEqual({ node: subNode, owner: newOwner })
  })

  it('should renew sub record', async () => {
    const ansRegistryFixture = await createANSRegistry(randomAssetAddress())
    const registrarOwner = randomAssetAddress()
    const registrarFixture = await createRegistrar(registrarOwner, ansRegistryFixture)
    const subNodeLabel = keccak256(encoder.encode("test")).slice(2)
    const subNode = keccak256(Buffer.from(RootNode + subNodeLabel)).slice(2)
    const subNodeOwner = randomAssetAddress()
    const subRecordAddress = subContractAddress(ansRegistryFixture.contractId, subNode, defaultGroup)

    async function renew(caller: string, duration: number, currentTTL: number) {
      const subRecord = createRecord({
        registrar: registrarFixture.contractId,
        owner: subNodeOwner,
        ttl: BigInt(currentTTL),
        resolver: '',
        refundAddress: subNodeOwner
      }, subRecordAddress)

      return Registrar.tests.renew({
        address: registrarFixture.address,
        initialFields: registrarFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: caller, asset: { alphAmount: alph(2) }}],
        testArgs: { node: subNode, duration: BigInt(duration), payer: caller },
        existingContracts: [subRecord, ...registrarFixture.dependencies]
      })
    }

    const ttl = Date.now()
    const testResult = await renew(subNodeOwner, MinRentalPeriod, ttl)
    const subRecordState = getContractState<RecordTypes.Fields>(testResult.contracts, subRecordAddress)
    expect(subRecordState.fields.ttl).toEqual(ttl + MinRentalPeriod)

    const rentFee = RentPrice * BigInt(MinRentalPeriod)
    const registrarOutput = testResult.txOutputs[0]
    expect(registrarOutput.alphAmount).toEqual(rentFee + ONE_ALPH)

    expect(testResult.events.length).toEqual(1)
    const events = testResult.events as RegistrarTypes.NewTTLEvent[]
    expect(events[0].fields).toEqual({
      node: subNode,
      owner: subNodeOwner,
      ttl: ttl + MinRentalPeriod
    })

    await expectAssertionFailed(async () => renew(randomAssetAddress(), MinRentalPeriod, ttl))
    await expectAssertionFailed(async () => renew(randomAssetAddress(), MinRentalPeriod - 1, ttl))
    await expectAssertionFailed(async () => renew(randomAssetAddress(), MinRentalPeriod, ttl - MinRentalPeriod * 2))
  })

  it('should unregister sub record', async () => {
    const ansRegistryFixture = await createANSRegistry(randomAssetAddress())
    const registrarOwner = randomAssetAddress()
    const registrarFixture = await createRegistrar(registrarOwner, ansRegistryFixture)
    const subNodeLabel = keccak256(encoder.encode("test")).slice(2)
    const subNode = keccak256(Buffer.from(RootNode + subNodeLabel)).slice(2)
    const subNodeOwner = randomAssetAddress()
    const subRecordAddress = subContractAddress(ansRegistryFixture.contractId, subNode, defaultGroup)

    async function unregister(caller: string) {
      const subRecord = createRecord({
        registrar: registrarFixture.contractId,
        owner: subNodeOwner,
        ttl: 0n,
        resolver: '',
        refundAddress: subNodeOwner
      }, subRecordAddress)
      return Registrar.tests.unregister({
        address: registrarFixture.address,
        initialFields: registrarFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: caller, asset: { alphAmount: ONE_ALPH }}],
        testArgs: { node: subNode },
        existingContracts: [subRecord, ...registrarFixture.dependencies]
      })
    }

    const testResult = await unregister(subNodeOwner)
    const subRecordContract = testResult.contracts.find(c => c.address === subRecordAddress)
    expect(subRecordContract).toEqual(undefined)
  })

  it('should update record profile', async () => {
    const ansRegistryFixture = await createANSRegistry(randomAssetAddress())
    const registrarOwner = randomAssetAddress()
    const registrarFixture = await createRegistrar(registrarOwner, ansRegistryFixture)
    const subNodeLabel = keccak256(encoder.encode("test")).slice(2)
    const subNode = keccak256(Buffer.from(RootNode + subNodeLabel)).slice(2)
    const subNodeOwner = randomAssetAddress()
    const subRecordAddress = subContractAddress(ansRegistryFixture.contractId, subNode, defaultGroup)
    const subRecord = createRecord({
      registrar: registrarFixture.contractId,
      owner: subNodeOwner,
      ttl: 0n,
      resolver: '',
      refundAddress: subNodeOwner
    }, subRecordAddress)

    async function setOwner(caller: string, newOwner: string) {
      return Registrar.tests.setOwner({
        address: registrarFixture.address,
        initialFields: registrarFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: caller, asset: { alphAmount: ONE_ALPH }}],
        testArgs: { node: subNode, newOwner },
        existingContracts: [subRecord, ...registrarFixture.dependencies]
      })
    }

    const newOwner = randomAssetAddress()
    const setOwnerResult = await setOwner(subNodeOwner, newOwner)
    const subNodeState0 = getContractState<RecordTypes.Fields>(setOwnerResult.contracts, subRecordAddress)
    expect(subNodeState0.fields.owner).toEqual(newOwner)
    expect(setOwnerResult.events.length).toEqual(1)
    const events0 = setOwnerResult.events as RegistrarTypes.TransferEvent[]
    expect(events0[0].fields).toEqual({
      node: subNode,
      oldOwner: subNodeOwner,
      newOwner: newOwner
    })

    await expectAssertionFailed(async () => setOwner(randomAssetAddress(), newOwner))

    async function setResolver(caller: string, resolverId: string) {
      return Registrar.tests.setResolver({
        address: registrarFixture.address,
        initialFields: registrarFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: caller, asset: { alphAmount: ONE_ALPH }}],
        testArgs: { node: subNode, resolverId },
        existingContracts: [subRecord, ...registrarFixture.dependencies]
      })
    }

    const newResolverId = randomContractId()
    const setResolverResult = await setResolver(subNodeOwner, newResolverId)
    const subNodeState1 = getContractState<RecordTypes.Fields>(setResolverResult.contracts, subRecordAddress)
    expect(subNodeState1.fields.resolver).toEqual(newResolverId)
    expect(setResolverResult.events.length).toEqual(1)
    const events1 = setResolverResult.events as RegistrarTypes.NewResolverEvent[]
    expect(events1[0].fields).toEqual({
      node: subNode,
      owner: subNodeOwner,
      resolverId: newResolverId
    })

    await expectAssertionFailed(async () => setResolver(randomAssetAddress(), newResolverId))
  })
})
