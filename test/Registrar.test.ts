import { binToHex, Contract, ONE_ALPH, subContractId, web3 } from "@alephium/web3"
import {
  alph,
  createANSRegistry,
  createRecord,
  defaultInitialAsset,
  randomAssetAddress,
  subContractAddress,
  createAccountResolver,
  randomContractId,
  DefaultGroup,
  getContractState,
  buildProject,
  ErrorCodes,
  RootNode,
  createRegistrar
} from "./fixtures/ANSFixture"
import { keccak256 } from "ethers/lib/utils"
import { AccountResolverTypes, AccountInfo, RecordTypes, Registrar, RegistrarTypes } from "../artifacts/ts"
import { expectAssertionError } from "@alephium/web3-test"

describe("test registrar", () => {
  const MinRentalPeriod = 2592000000
  const RentPrice = 1000n

  const encoder = new TextEncoder()

  beforeAll(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
    await buildProject()
  })

  it('should register sub record', async () => {
    const ansRegistryFixture = createANSRegistry(randomAssetAddress())
    const registrarOwner = randomAssetAddress()
    const registrarFixture = createRegistrar(registrarOwner, ansRegistryFixture)
    const resolverFixture = createAccountResolver(registrarFixture)

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
          payer: subNodeOwner,
          resolver: resolverFixture.contractId
        },
        existingContracts: resolverFixture.states()
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
    const expectedContractId = subContractId(ansRegistryFixture.contractId, subNode, DefaultGroup)
    expect(subRecordState.contractId).toEqual(expectedContractId)

    const contractOutput = testResult.txOutputs[0]
    expect(contractOutput.tokens).toEqual([{
      id: subRecordState.contractId,
      amount: 1n
    }])

    const rentFee = RentPrice * BigInt(MinRentalPeriod)
    const registrarOutput = testResult.txOutputs[1]
    expect(registrarOutput.alphAmount).toEqual(rentFee + ONE_ALPH)

    const newNodeEvents = testResult.events.filter(e => e.name === 'NewNode') as RegistrarTypes.NewNodeEvent[]
    expect(newNodeEvents.length).toEqual(1)
    expect(newNodeEvents[0].fields).toEqual({ node: subNode, owner: subNodeOwner })

    await expectAssertionError(register(name, subNodeOwner, MinRentalPeriod - 1), registrarFixture.address, Number(ErrorCodes.InvalidArgs))
  })

  it('should remove the expired record on registration', async () => {
    const ansRegistryFixture = createANSRegistry(randomAssetAddress())
    const registrarOwner = randomAssetAddress()
    const registrarFixture = createRegistrar(registrarOwner, ansRegistryFixture)
    const resolverFixture = createAccountResolver(registrarFixture)
    const name = "test"
    const previousOwner = randomAssetAddress()
    const newOwner = randomAssetAddress()
    const subNodeLabel = keccak256(encoder.encode(name)).slice(2)
    const subNode = keccak256(Buffer.from(RootNode + subNodeLabel, 'hex')).slice(2)
    const subRecordAddress = subContractAddress(ansRegistryFixture.contractId, subNode, DefaultGroup)

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
          payer: newOwner,
          resolver: resolverFixture.contractId
        },
        existingContracts: [subRecord, ...resolverFixture.states()]
      })
    }

    const testResult = await register(name, newOwner, MinRentalPeriod)
    const expectedContractId = subContractId(ansRegistryFixture.contractId, subNode, DefaultGroup)
    const subRecordState = getContractState<RecordTypes.Fields>(testResult.contracts, expectedContractId)
    expect(subRecordState.fields.owner).toEqual(newOwner)
    expect(subRecordState.fields.registrar).toEqual(registrarFixture.contractId)
    expect(subRecordState.contractId).toEqual(expectedContractId)

    const contractOutput = testResult.txOutputs.find(c => c.address === subRecordAddress)!
    expect(contractOutput.tokens).toEqual([{
      id: subRecordState.contractId,
      amount: 1n
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
    const ansRegistryFixture = createANSRegistry(randomAssetAddress())
    const registrarOwner = randomAssetAddress()
    const registrarFixture = createRegistrar(registrarOwner, ansRegistryFixture)
    const subNodeLabel = keccak256(encoder.encode("test")).slice(2)
    const subNode = keccak256(Buffer.from(RootNode + subNodeLabel)).slice(2)
    const subNodeOwner = randomAssetAddress()
    const subRecordAddress = subContractAddress(ansRegistryFixture.contractId, subNode, DefaultGroup)

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
    expect(subRecordState.fields.ttl).toEqual(BigInt(ttl + MinRentalPeriod))

    const rentFee = RentPrice * BigInt(MinRentalPeriod)
    const registrarOutput = testResult.txOutputs[0]
    expect(registrarOutput.alphAmount).toEqual(rentFee + ONE_ALPH)

    expect(testResult.events.length).toEqual(1)
    const events = testResult.events as RegistrarTypes.NewTTLEvent[]
    expect(events[0].fields).toEqual({
      node: subNode,
      owner: subNodeOwner,
      ttl: BigInt(ttl + MinRentalPeriod)
    })

    await expectAssertionError(renew(randomAssetAddress(), MinRentalPeriod, ttl), registrarFixture.address, Number(ErrorCodes.InvalidCaller))
    await expectAssertionError(renew(subNodeOwner, MinRentalPeriod - 1, ttl), registrarFixture.address, Number(ErrorCodes.InvalidArgs))
    await expectAssertionError(renew(subNodeOwner, MinRentalPeriod, ttl - MinRentalPeriod * 2), registrarFixture.address, Number(ErrorCodes.InvalidArgs))
  })

  it('should unregister sub record', async () => {
    const ansRegistryFixture = createANSRegistry(randomAssetAddress())
    const registrarOwner = randomAssetAddress()
    const registrarFixture = createRegistrar(registrarOwner, ansRegistryFixture)
    const resolverFixture = createAccountResolver(registrarFixture)
    const subNodeLabel = keccak256(encoder.encode("test")).slice(2)
    const subNode = keccak256(Buffer.from(RootNode + subNodeLabel)).slice(2)
    const subNodeOwner = randomAssetAddress()
    const subRecordAddress = subContractAddress(ansRegistryFixture.contractId, subNode, DefaultGroup)
    const subRecord = createRecord({
      registrar: registrarFixture.contractId,
      owner: subNodeOwner,
      ttl: 0n,
      resolver: resolverFixture.contractId,
      refundAddress: subNodeOwner
    }, subRecordAddress)
    const accountInfo = AccountInfo.stateForTest(
      { resolver: resolverFixture.contractId, pubkey: '', addresses: '' },
      defaultInitialAsset,
      subContractAddress(resolverFixture.contractId, subNode, DefaultGroup)
    )

    async function unregister(caller: string) {
      return Registrar.tests.unregister({
        address: registrarFixture.address,
        initialFields: registrarFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: caller, asset: { alphAmount: ONE_ALPH }}],
        testArgs: { node: subNode },
        existingContracts: [subRecord, ...resolverFixture.states(), accountInfo]
      })
    }

    const testResult = await unregister(subNodeOwner)
    const subRecordContract = testResult.contracts.find(c => c.address === subRecordAddress)
    expect(subRecordContract).toEqual(undefined)
    expect(testResult.events.length).toEqual(3)

    expect(testResult.events.filter((e) => e.eventIndex === Contract.ContractDestroyedEventIndex).length).toEqual(2)
    const accountInfoRemovedEvent = testResult.events.find((e) => e.eventIndex === 3)! as AccountResolverTypes.AccountInfoRemovedEvent
    expect(accountInfoRemovedEvent.fields.node).toEqual(subNode)
  })

  it('should update record profile', async () => {
    const ansRegistryFixture = createANSRegistry(randomAssetAddress())
    const registrarOwner = randomAssetAddress()
    const registrarFixture = createRegistrar(registrarOwner, ansRegistryFixture)
    const subNodeLabel = keccak256(encoder.encode("test")).slice(2)
    const subNode = keccak256(Buffer.from(RootNode + subNodeLabel)).slice(2)
    const subNodeOwner = randomAssetAddress()
    const subRecordAddress = subContractAddress(ansRegistryFixture.contractId, subNode, DefaultGroup)
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

    await expectAssertionError(setOwner(randomAssetAddress(), newOwner), registrarFixture.address, Number(ErrorCodes.InvalidCaller))

    async function setResolver(caller: string, resolver: string) {
      return Registrar.tests.setResolver({
        address: registrarFixture.address,
        initialFields: registrarFixture.initialFields(),
        initialAsset: defaultInitialAsset,
        inputAssets: [{ address: caller, asset: { alphAmount: ONE_ALPH }}],
        testArgs: { node: subNode, resolver },
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

    await expectAssertionError(setResolver(randomAssetAddress(), newResolverId), registrarFixture.address, Number(ErrorCodes.InvalidCaller))
  })
})
