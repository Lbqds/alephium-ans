import { Deployer, DeployFunction, Network } from '@alephium/cli'
import { addressFromContractId } from '@alephium/web3'
import { Settings } from '../alephium.config'
import { PrimaryRegistrar, PrimaryRegistrarTypes, PrimaryRecord, PrimaryRecordTypes } from '../artifacts/ts'

const DummyAddress = addressFromContractId('0'.repeat(64))

const deployPrimaryRegistrar: DeployFunction<Settings> = async (deployer: Deployer, network: Network<Settings>): Promise<void> => {
  if (deployer.account.group !== network.settings.primaryGroup) {
    return
  }
  const recordInitialFields: PrimaryRecordTypes.Fields = {
    owner: DummyAddress,
    resolver: '',
    refundAddress: DummyAddress
  }
  const recordTemplateResult = await deployer.deployContract(PrimaryRecord, { initialFields: recordInitialFields })
  const initialFields: PrimaryRegistrarTypes.Fields = {
    registrarOwner: network.settings.registrarOwner,
    recordTemplateId: recordTemplateResult.contractInstance.contractId
  }
  const result = await deployer.deployContract(PrimaryRegistrar, { initialFields: initialFields })
  network.settings.primaryRegistrarAddress = result.contractInstance.address
  console.log(`PrimaryRegistrar contract address: ${result.contractInstance.address}, contract id: ${result.contractInstance.contractId}`)
}

export default deployPrimaryRegistrar
