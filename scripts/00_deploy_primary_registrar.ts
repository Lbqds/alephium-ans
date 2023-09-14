import { Deployer, DeployFunction, Network } from '@alephium/cli'
import { Settings } from '../alephium.config'
import { PrimaryRegistrar, PrimaryRegistrarTypes, Record, CredentialToken } from '../artifacts/ts'

const deployPrimaryRegistrar: DeployFunction<Settings> = async (deployer: Deployer, network: Network<Settings>): Promise<void> => {
  if (deployer.account.group !== network.settings.primaryGroup) {
    return
  }
  const recordTemplateResult = await deployer.deployContract(Record, { initialFields: Record.getInitialFieldsWithDefaultValues() })
  const credentialTokenTemplateResult = await deployer.deployContract(CredentialToken, {
    initialFields: { registrar: '', name: '' }
  })
  const initialFields: PrimaryRegistrarTypes.Fields = {
    registrarOwner: network.settings.registrarOwner,
    recordTemplateId: recordTemplateResult.contractInstance.contractId,
    credentialTokenTemplateId: credentialTokenTemplateResult.contractInstance.contractId
  }
  const result = await deployer.deployContract(PrimaryRegistrar, { initialFields: initialFields })
  network.settings.primaryRegistrarAddress = result.contractInstance.address
  console.log(`PrimaryRegistrar contract address: ${result.contractInstance.address}, contract id: ${result.contractInstance.contractId}`)
}

export default deployPrimaryRegistrar
