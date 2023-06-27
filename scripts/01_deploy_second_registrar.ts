import { Deployer, DeployFunction, Network } from '@alephium/cli'
import { addressFromContractId, contractIdFromAddress, binToHex } from '@alephium/web3'
import { Settings } from '../alephium.config'
import { SecondaryRegistrar, SecondaryRegistrarTypes, SecondaryRecord, SecondaryRecordTypes } from '../artifacts/ts'

const DummyAddress = addressFromContractId('0'.repeat(64))

const deploySecondaryRegistrar: DeployFunction<Settings> = async (deployer: Deployer, network: Network<Settings>): Promise<void> => {
  if (deployer.account.group === network.settings.primaryGroup) {
    return
  }
  if (network.settings.primaryRegistrarAddress === undefined) {
    throw new Error(`PrimaryRegistrary not deployed yet`)
  }
  const recordInitialFields: SecondaryRecordTypes.Fields = {
    registrar: '',
    owner: DummyAddress,
    resolver: '',
    refundAddress: DummyAddress
  }
  const recordTemplateResult = await deployer.deployContract(SecondaryRecord, { initialFields: recordInitialFields })
  const initialFields: SecondaryRegistrarTypes.Fields = {
    primaryRegistrar: binToHex(contractIdFromAddress(network.settings.primaryRegistrarAddress)),
    recordTemplateId: recordTemplateResult.contractInstance.contractId
  }
  const result = await deployer.deployContract(SecondaryRegistrar, { initialFields: initialFields })
  console.log(`SecondaryRegistrar contract address: ${result.contractInstance.address}, contract id: ${result.contractInstance.contractId}`)
}

export default deploySecondaryRegistrar
