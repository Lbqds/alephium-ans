import { Deployer, DeployFunction } from '@alephium/cli'
import {
  AccountInfo,
  AccountResolverTypes,
  AccountResolver
} from '../artifacts/ts'

const deployResolver: DeployFunction<undefined> = async (deployer: Deployer): Promise<void> => {
  const accountInfo = {
    resolver: '',
    pubkey: '',
    addresses: ''
  }
  const accountInfoTemplateResult = await deployer.deployContract(AccountInfo, { initialFields: accountInfo })
  const ansRegistryId = deployer.getDeployContractResult('ANSRegistry').contractInstance.contractId
  const registrarId = deployer.getDeployContractResult('Registrar').contractInstance.contractId
  const initialFields: AccountResolverTypes.Fields = {
    ansRegistry: ansRegistryId,
    registrar: registrarId,
    accountInfoTemplateId: accountInfoTemplateResult.contractInstance.contractId
  }
  const result = await deployer.deployContract(AccountResolver, { initialFields: initialFields })
  console.log(`Account resolver contract address: ${result.contractInstance.address}, contract id: ${result.contractInstance.contractId}`)
}

export default deployResolver
