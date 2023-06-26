import { Deployer, DeployFunction } from '@alephium/cli'
import { DUST_AMOUNT, ONE_ALPH } from '@alephium/web3'
import { SetupANS } from '../artifacts/ts'

const setupANS: DeployFunction<undefined> = async (deployer: Deployer): Promise<void> => {
  const ansRegistryId = deployer.getDeployContractResult('ANSRegistry').contractInstance.contractId
  const registrarId = deployer.getDeployContractResult('Registrar').contractInstance.contractId
  const initialFields = {
    ansRegistry: ansRegistryId,
    registrarId: registrarId
  }
  await deployer.runScript(SetupANS, {
    initialFields: initialFields,
    attoAlphAmount: ONE_ALPH + DUST_AMOUNT
  })
}

export default setupANS
