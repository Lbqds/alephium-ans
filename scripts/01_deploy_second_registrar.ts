import { Deployer, DeployFunction, Network } from '@alephium/cli'
import { contractIdFromAddress, binToHex } from '@alephium/web3'
import { Settings } from '../alephium.config'
import { SecondaryRegistrar, SecondaryRegistrarTypes, Record } from '../artifacts/ts'

const deploySecondaryRegistrar: DeployFunction<Settings> = async (deployer: Deployer, network: Network<Settings>): Promise<void> => {
  if (deployer.account.group === network.settings.primaryGroup) {
    return
  }
  if (network.settings.primaryRegistrarAddress === undefined) {
    throw new Error(`PrimaryRegistrary not deployed yet`)
  }
  const recordTemplateResult = await deployer.deployContract(Record, { initialFields: Record.getInitialFieldsWithDefaultValues() })
  const initialFields: SecondaryRegistrarTypes.Fields = {
    primaryRegistrar: binToHex(contractIdFromAddress(network.settings.primaryRegistrarAddress)),
    recordTemplateId: recordTemplateResult.contractInstance.contractId
  }
  const result = await deployer.deployContract(SecondaryRegistrar, { initialFields: initialFields })
  console.log(`SecondaryRegistrar contract address: ${result.contractInstance.address}, contract id: ${result.contractInstance.contractId}`)
}

export default deploySecondaryRegistrar
