import { Deployer, DeployFunction } from '@alephium/cli'
import { ContractFactory, Fields } from '@alephium/web3'
import {
  RecordInfo,
  DefaultResolverTypes,
  DefaultResolver
} from '../artifacts/ts'

const deployResolver: DeployFunction<undefined> = async (deployer: Deployer): Promise<void> => {
  const recordInfoFields = {
    resolver: '',
    pubkey: '',
    addresses: ''
  }
  const recordInfoTemplateResult = await deployer.deployContract(RecordInfo, { initialFields: recordInfoFields })
  const ansRegistryId = deployer.getDeployContractResult('ANSRegistry').contractInstance.contractId
  const registrarId = deployer.getDeployContractResult('Registrar').contractInstance.contractId
  const initialFields: DefaultResolverTypes.Fields = {
    ansRegistry: ansRegistryId,
    registrar: registrarId,
    recordInfoTemplateId: recordInfoTemplateResult.contractInstance.contractId
  }
  const result = await deployer.deployContract(DefaultResolver, { initialFields: initialFields })
  console.log(`Default resolver contract address: ${result.contractInstance.address}, contract id: ${result.contractInstance.contractId}`)
}

export default deployResolver
