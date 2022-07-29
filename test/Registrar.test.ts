import {
  addressFromContractId,
  Arguments,
  binToHex,
  Contract,
  subContractId,
  TestContractResult
} from "@alephium/web3"
import {
  alph,
  oneAlph,
  ContractInfo,
  createANSRegistry,
  createRecord,
  defaultInitialAsset,
  randomAssetAddress,
  testProvider,
  expectAssertionFailed,
  subContractAddress,
  createDefaultResolver,
  randomContractId
} from "./fixtures/ANSFixture"
import { keccak256 } from "ethers/lib/utils"

describe("test registrar", () => {
  const RootNode = "b2453cbabd12c58b21d32b6c70e6c41c8ca2918d7f56c1b88e838edf168776bf"
  const MaxTTL = BigInt(1) << BigInt(255)
  const MinRentalPeriod = 2592000000
  const RentPrice = BigInt("1000")

  const encoder = new TextEncoder()

  async function createRegistrar(owner: string, ansRegistryInfo: ContractInfo): Promise<ContractInfo> {
    const resolverInfo = await createDefaultResolver(ansRegistryInfo)
    const contract = await Contract.fromSource(testProvider, 'registrar.ral')
    const state = contract.toState({
      "registrarOwner": owner,
      "ansRegistryId": ansRegistryInfo.state.contractId,
      "defaultResolverId": resolverInfo.state.contractId
    }, defaultInitialAsset)
    const rootRecord = await createRecord({
      "registrar": state.contractId,
      "owner": addressFromContractId(state.contractId),
      "ttl": MaxTTL,
      "resolver": resolverInfo.state.contractId,
      "refundAddress": owner
    }, subContractAddress(ansRegistryInfo.state.contractId, RootNode))
    return new ContractInfo(contract, state, [
      rootRecord,
      ...ansRegistryInfo.states(),
      ...resolverInfo.states()
    ])
  }

  it('should register sub record', async () => {
    const ansRegistryInfo = await createANSRegistry(randomAssetAddress())
    const registrarOwner = randomAssetAddress()
    const registrarInfo = await createRegistrar(registrarOwner, ansRegistryInfo)

    async function register(
      subNode: string,
      subNodeOwner: string,
      rentDuration: number
    ): Promise<TestContractResult> {
      const registrar = registrarInfo.contract
      return registrar.testPublicMethod(testProvider, 'register', {
        address: registrarInfo.state.address,
        initialFields: registrarInfo.state.fields,
        initialAsset: defaultInitialAsset,
        inputAssets: [{
          address: subNodeOwner,
          asset: {
            alphAmount: alph(2)
          }
        }],
        testArgs: {
          "name": binToHex(encoder.encode(subNode)),
          "owner": subNodeOwner,
          "duration": rentDuration,
          "payer": subNodeOwner
        },
        existingContracts: registrarInfo.dependencies
      })
    }

    const name = "test"
    const subNodeOwner = randomAssetAddress()
    const testResult = await register(name, subNodeOwner, MinRentalPeriod)
    const subRecordContract = testResult.contracts[0]
    expect(subRecordContract.fields["owner"]).toEqual(subNodeOwner)
    expect(subRecordContract.fields["registrar"]).toEqual(registrarInfo.state.contractId)
    const label = keccak256(encoder.encode(name)).slice(2)
    const subNode = keccak256(Buffer.from(RootNode + label, 'hex')).slice(2)
    const expectedContractId = subContractId(ansRegistryInfo.state.contractId, subNode)
    expect(subRecordContract.contractId).toEqual(expectedContractId)

    const contractOutput = testResult.txOutputs[0]
    expect(contractOutput.tokens).toEqual([{
      id: subRecordContract.contractId,
      amount: 1
    }])

    const rentFee = RentPrice * BigInt(MinRentalPeriod)
    const registrarOutput = testResult.txOutputs[1]
    expect(registrarOutput.alphAmount).toEqual(rentFee + oneAlph)

    const newNodeEvents = testResult.events.filter(e => e.name === "NewNode")
    expect(newNodeEvents.length).toEqual(1)
    expect(newNodeEvents[0].fields).toEqual({
      "node": subNode,
      "owner": subNodeOwner
    })

    await expectAssertionFailed(async () => register(name, subNodeOwner, MinRentalPeriod - 1))
  })

  it('should renew sub record', async () => {
    const ansRegistryInfo = await createANSRegistry(randomAssetAddress())
    const registrarOwner = randomAssetAddress()
    const registrarInfo = await createRegistrar(registrarOwner, ansRegistryInfo)
    const subNodeLabel = keccak256(encoder.encode("test")).slice(2)
    const subNode = keccak256(Buffer.from(RootNode + subNodeLabel)).slice(2)
    const subNodeOwner = randomAssetAddress()
    const subRecordAddress = subContractAddress(ansRegistryInfo.state.contractId, subNode)

    async function renew(
      caller: string,
      duration: number,
      currentTTL: number
    ): Promise<TestContractResult> {
      const subRecord = await createRecord({
        "registrar": registrarInfo.state.contractId,
        "owner": subNodeOwner,
        "ttl": currentTTL,
        "resolver": "",
        "refundAddress": subNodeOwner
      }, subRecordAddress)

      const registrar = registrarInfo.contract
      return registrar.testPublicMethod(testProvider, 'renew', {
        address: registrarInfo.state.address,
        initialFields: registrarInfo.state.fields,
        initialAsset: defaultInitialAsset,
        inputAssets: [{
          address: caller,
          asset: {
            alphAmount: alph(2)
          }
        }],
        testArgs: {
          "node": subNode,
          "duration": duration,
          "payer": caller 
        },
        existingContracts: [subRecord, ...registrarInfo.dependencies]
      })
    }

    const ttl = Date.now()
    const testResult = await renew(subNodeOwner, MinRentalPeriod, ttl)
    const subRecordContract = testResult.contracts.filter(c => c.address === subRecordAddress)[0]
    expect(subRecordContract.fields["ttl"]).toEqual(ttl + MinRentalPeriod)

    const rentFee = RentPrice * BigInt(MinRentalPeriod)
    const registrarOutput = testResult.txOutputs[0]
    expect(registrarOutput.alphAmount).toEqual(rentFee + oneAlph)
    expect(testResult.events[0].fields).toEqual({
      "node": subNode,
      "owner": subNodeOwner,
      "ttl": ttl + MinRentalPeriod
    })

    await expectAssertionFailed(async () => renew(randomAssetAddress(), MinRentalPeriod, ttl))
    await expectAssertionFailed(async () => renew(randomAssetAddress(), MinRentalPeriod - 1, ttl))
    await expectAssertionFailed(async () => renew(randomAssetAddress(), MinRentalPeriod, ttl - MinRentalPeriod * 2))
  })

  it('should unregister sub record', async () => {
    const ansRegistryInfo = await createANSRegistry(randomAssetAddress())
    const registrarOwner = randomAssetAddress()
    const registrarInfo = await createRegistrar(registrarOwner, ansRegistryInfo)
    const subNodeLabel = keccak256(encoder.encode("test")).slice(2)
    const subNode = keccak256(Buffer.from(RootNode + subNodeLabel)).slice(2)
    const subNodeOwner = randomAssetAddress()
    const subRecordAddress = subContractAddress(ansRegistryInfo.state.contractId, subNode)

    async function unregister(caller: string): Promise<TestContractResult> {
      const subRecord = await createRecord({
        "registrar": registrarInfo.state.contractId,
        "owner": subNodeOwner,
        "ttl": 0,
        "resolver": "",
        "refundAddress": subNodeOwner
      }, subRecordAddress)

      const registrar = registrarInfo.contract
      return registrar.testPublicMethod(testProvider, 'unregister', {
        address: registrarInfo.state.address,
        initialFields: registrarInfo.state.fields,
        initialAsset: defaultInitialAsset,
        inputAssets: [{
          address: caller,
          asset: {
            alphAmount: oneAlph
          }
        }],
        testArgs: {
          "node": subNode
        },
        existingContracts: [subRecord, ...registrarInfo.dependencies]
      })
    }

    const testResult = await unregister(subNodeOwner)
    const subRecordContract = testResult.contracts.filter(c => c.address === subRecordAddress)
    expect(subRecordContract.length).toEqual(0)
  })

  it('should update record profile', async () => {
    const ansRegistryInfo = await createANSRegistry(randomAssetAddress())
    const registrarOwner = randomAssetAddress()
    const registrarInfo = await createRegistrar(registrarOwner, ansRegistryInfo)
    const subNodeLabel = keccak256(encoder.encode("test")).slice(2)
    const subNode = keccak256(Buffer.from(RootNode + subNodeLabel)).slice(2)
    const subNodeOwner = randomAssetAddress()
    const subRecordAddress = subContractAddress(ansRegistryInfo.state.contractId, subNode)

    async function test(caller: string, method: string, args: Arguments): Promise<TestContractResult> {
      const subRecord = await createRecord({
        "registrar": registrarInfo.state.contractId,
        "owner": subNodeOwner,
        "ttl": 0,
        "resolver": "",
        "refundAddress": subNodeOwner
      }, subRecordAddress)

      const registrar = registrarInfo.contract
      return registrar.testPublicMethod(testProvider, method, {
        address: registrarInfo.state.address,
        initialFields: registrarInfo.state.fields,
        initialAsset: defaultInitialAsset,
        inputAssets: [{
          address: caller,
          asset: {
            alphAmount: oneAlph
          }
        }],
        testArgs: args,
        existingContracts: [subRecord, ...registrarInfo.dependencies]
      })
    }

    const newOwner = randomAssetAddress()
    const setOwnerArgs = {"node": subNode, "newOwner": newOwner}
    const setOwnerResult = await test(subNodeOwner, "setOwner", setOwnerArgs)
    let subNodeState = setOwnerResult.contracts.filter(c => c.address === subRecordAddress)[0]
    expect(subNodeState.fields["owner"]).toEqual(newOwner)
    expect(setOwnerResult.events[0].fields).toEqual({
      "node": subNode,
      "oldOwner": subNodeOwner,
      "newOwner": newOwner
    })

    await expectAssertionFailed(async () => test(randomAssetAddress(), "setOwner", setOwnerArgs))

    const newResolverId = randomContractId()
    const setResolverArgs = {"node": subNode, "resolverId": newResolverId}
    const setResolverResult = await test(subNodeOwner, "setResolver", setResolverArgs)
    subNodeState = setResolverResult.contracts.filter(c => c.address === subRecordAddress)[0]
    expect(subNodeState.fields["resolver"]).toEqual(newResolverId)
    expect(setResolverResult.events[0].fields).toEqual({
      "node": subNode,
      "owner": subNodeOwner,
      "resolverId": newResolverId
    })

    await expectAssertionFailed(async () => test(randomAssetAddress(), "setResolver", setResolverArgs))
  })
})
