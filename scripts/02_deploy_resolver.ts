import { Deployer, DeployFunction } from '@alephium/cli'
import { ContractFactory, Fields } from '@alephium/web3'
import {
  AddressInfo,
  DefaultResolverTypes,
  NameInfo,
  PubkeyInfo,
  DefaultResolver
} from '../artifacts/ts'

async function deployTemplateContract<F extends Fields>(
  deployer: Deployer,
  factory: ContractFactory<any, F>,
  initialFields: F
): Promise<string> {
  const result = await deployer.deployContract(factory, { initialFields: initialFields })
  return result.contractInstance.contractId
}

const deployResolver: DeployFunction<undefined> = async (deployer: Deployer): Promise<void> => {
  const addressInfoTemplateId = await deployTemplateContract(
    deployer,
    AddressInfo,
    { parentId: '', addresses: '' }
  )
  const nameInfoTemplateId = await deployTemplateContract(
    deployer,
    NameInfo,
    { parentId: '', name: '' }
  )
  const pubkeyInfoTemplateId = await deployTemplateContract(
    deployer,
    PubkeyInfo,
    { parentId: '', pubkey: '' }
  )
  const ansRegistryId = deployer.getDeployContractResult('ANSRegistry').contractInstance.contractId
  const initialFields: DefaultResolverTypes.Fields = {
    ansRegistryId,
    addressInfoTemplateId,
    nameInfoTemplateId,
    pubkeyInfoTemplateId
  }
  const result = await deployer.deployContract(DefaultResolver, { initialFields: initialFields })
  console.log(`Default resolver contract address: ${result.contractInstance.address}, contract id: ${result.contractInstance.contractId}`)
}

export default deployResolver
