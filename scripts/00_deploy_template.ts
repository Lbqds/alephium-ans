import { Deployer, DeployFunction } from '@alephium/cli'
import { addressFromContractId } from '@alephium/web3'
import { Record, RecordTypes } from '../artifacts/ts'

const DummyAddress = addressFromContractId('0'.repeat(64))

const deployRecordTemplate: DeployFunction<undefined> = async (deployer: Deployer): Promise<void> => {
  const initialFields: RecordTypes.Fields = {
    registrar: '',
    owner: DummyAddress,
    ttl: 0n,
    resolver: '',
    refundAddress: DummyAddress
  }
  const result = await deployer.deployContract(Record, { initialFields: initialFields })
  console.log(`Record template contract address: ${result.contractInstance.address}, contract id: ${result.contractInstance.contractId}`)
}

export default deployRecordTemplate
