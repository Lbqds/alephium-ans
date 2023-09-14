import { Deployer, DeployFunction, Network } from '@alephium/cli'
import { Settings } from '../alephium.config'
import { PrimaryRegistrar, PrimaryRegistrarTypes, PrimaryRecord, RecordToken } from '../artifacts/ts'

const deployPrimaryRegistrar: DeployFunction<Settings> = async (deployer: Deployer, network: Network<Settings>): Promise<void> => {
  if (deployer.account.group !== network.settings.primaryGroup) {
    return
  }
  const recordTemplateResult = await deployer.deployContract(PrimaryRecord, { initialFields: PrimaryRecord.getInitialFieldsWithDefaultValues() })
  const recordTokenTemplateResult = await deployer.deployContract(RecordToken, {
    initialFields: { registrar: '', name: '' }
  })
  const initialFields: PrimaryRegistrarTypes.Fields = {
    registrarOwner: network.settings.registrarOwner,
    recordTemplateId: recordTemplateResult.contractInstance.contractId,
    recordTokenTemplateId: recordTokenTemplateResult.contractInstance.contractId
  }
  const result = await deployer.deployContract(PrimaryRegistrar, { initialFields: initialFields })
  network.settings.primaryRegistrarAddress = result.contractInstance.address
  console.log(`PrimaryRegistrar contract address: ${result.contractInstance.address}, contract id: ${result.contractInstance.contractId}`)
}

export default deployPrimaryRegistrar
