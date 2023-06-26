import { Deployer, DeployFunction } from '@alephium/cli'
import { RegistrarTypes, Registrar } from '../artifacts/ts'

const deployRegistrar: DeployFunction<undefined> = async (deployer: Deployer): Promise<void> => {
  const ansRegistryId = deployer.getDeployContractResult('ANSRegistry').contractInstance.contractId
  const initialFields: RegistrarTypes.Fields = {
    registrarOwner: deployer.account.address,
    ansRegistry: ansRegistryId
  }
  const result = await deployer.deployContract(Registrar, { initialFields: initialFields })
  console.log(`Registrar contract address: ${result.contractInstance.address}, contract id: ${result.contractInstance.contractId}`)
}

export default deployRegistrar
