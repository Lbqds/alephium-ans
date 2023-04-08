import { Deployer, DeployFunction } from '@alephium/cli'
import { ANSRegistry, ANSRegistryTypes,  } from '../artifacts/ts'

const deployANSRegistry: DeployFunction<undefined> = async (deployer: Deployer): Promise<void> => {
  const recordTemplateId = deployer.getDeployContractResult('Record').contractInstance.contractId
  const initialFields: ANSRegistryTypes.Fields = {
    admin: deployer.account.address,
    recordTemplateId
  }
  const result = await deployer.deployContract(ANSRegistry, { initialFields: initialFields })
  console.log(`ANSRegistry contract address: ${result.contractInstance.address}, contract id: ${result.contractInstance.contractId}`)
}

export default deployANSRegistry
