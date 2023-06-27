import { Deployer, DeployFunction, Network } from '@alephium/cli'
import { Settings } from '../alephium.config'
import {
  AccountInfo,
  AccountResolverTypes,
  AccountResolver
} from '../artifacts/ts'

const deployResolver: DeployFunction<Settings> = async (deployer: Deployer, network: Network<Settings>): Promise<void> => {
  const accountInfo = {
    resolver: '',
    pubkey: '',
    addresses: ''
  }
  const accountInfoTemplateResult = await deployer.deployContract(AccountInfo, { initialFields: accountInfo })
  const registrarId = deployer.account.group === network.settings.primaryGroup
    ? deployer.getDeployContractResult('PrimaryRegistrar').contractInstance.contractId
    : deployer.getDeployContractResult('SecondaryRegistrar').contractInstance.contractId
  const initialFields: AccountResolverTypes.Fields = {
    registrar: registrarId,
    accountInfoTemplateId: accountInfoTemplateResult.contractInstance.contractId
  }
  const result = await deployer.deployContract(AccountResolver, { initialFields: initialFields })
  console.log(`AccountResolver contract address: ${result.contractInstance.address}, contract id: ${result.contractInstance.contractId}`)
}

export default deployResolver
