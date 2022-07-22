import {
  NodeProvider,
  node,
  SignerWithNodeProvider,
  Contract,
  Script,
  addressFromContractId,
  Fields
} from '@alephium/web3'
import { testWallet, testAddress } from '@alephium/web3/test'

const DummyAddress = addressFromContractId('0'.repeat(64))

function isConfirmed(txStatus: node.TxStatus): txStatus is node.Confirmed {
  return (txStatus as node.Confirmed).blockHash !== undefined
}

export async function waitTxConfirmed(provider: NodeProvider, txId: string): Promise<node.Confirmed> {
  const status = await provider.transactions.getTransactionsStatus({txId: txId})
  if (!isConfirmed(status)) {
      await new Promise(r => setTimeout(r, 10000))
      return waitTxConfirmed(provider, txId)
  }
  return status as node.Confirmed;
}

async function deployContract(
  signer: SignerWithNodeProvider,
  contract: Contract,
  initFields: Fields
): Promise<string> {
  const deployTx = await contract.transactionForDeployment(signer, {
      initialFields: initFields
  })
  const submitResult = await signer.submitTransaction(deployTx.unsignedTx, deployTx.txId)
  await waitTxConfirmed(signer.provider, submitResult.txId)
  return deployTx.contractId
}


async function deployRecordTemplate(signer: SignerWithNodeProvider): Promise<string> {
  const record = await Contract.fromSource(signer.provider, 'record.ral')
  const initFields = {
    "registrar": "",
    "owner": DummyAddress,
    "ttl": 0,
    "resolver": "",
    "refundAddress": DummyAddress
  }
  return deployContract(signer, record, initFields)
}

async function deployANSRegistry(signer: SignerWithNodeProvider): Promise<string> {
  const recordTemplateId = await deployRecordTemplate(signer)
  const ansRegistry = await Contract.fromSource(signer.provider, 'ans_registry.ral')
  const accounts = await signer.getAccounts()
  const initFields = {
    "admin": accounts[0].address,
    "recordTemplateId": recordTemplateId
  }
  return deployContract(signer, ansRegistry, initFields)
}

async function deployAddressInfoTemplate(signer: SignerWithNodeProvider): Promise<string> {
  const addressInfo = await Contract.fromSource(signer.provider, 'address_info.ral')
  return deployContract(signer, addressInfo, {
    "parentId": "",
    "addresses": ""
  })
}

async function deployNameInfoTemplate(signer: SignerWithNodeProvider): Promise<string> {
  const nameInfo = await Contract.fromSource(signer.provider, 'name_info.ral')
  return deployContract(signer, nameInfo, {
    "parentId": "",
    "name": ""
  })
}

async function deployPubkeyInfoTemplate(signer: SignerWithNodeProvider): Promise<string> {
  const pubkeyInfo = await Contract.fromSource(signer.provider, 'pubkey_info.ral')
  return deployContract(signer, pubkeyInfo, {
    "parentId": "",
    "pubkey": ""
  })
}

async function deployDefaultResolver(
  signer: SignerWithNodeProvider,
  ansRegistryId: string
): Promise<string> {
  const addressInfoTemplateId = await deployAddressInfoTemplate(signer)
  const nameInfoTemplateId = await deployNameInfoTemplate(signer)
  const pubkeyInfoTemplateId = await deployPubkeyInfoTemplate(signer)
  const defaultResolver = await Contract.fromSource(signer.provider, 'default_resolver.ral')
  return deployContract(signer, defaultResolver, {
    "ansRegistryId": ansRegistryId,
    "addressInfoTemplateId": addressInfoTemplateId,
    "nameInfoTemplateId": nameInfoTemplateId,
    "pubkeyInfoTemplateId": pubkeyInfoTemplateId
  })
}

async function deployRegistrar(
  signer: SignerWithNodeProvider,
  ansRegistryId: string,
  registrarOwner: string
): Promise<string> {
  const defaultResolverId = await deployDefaultResolver(signer, ansRegistryId)
  const registrar = await Contract.fromSource(signer.provider, 'registrar.ral')
  const registrarId = await deployContract(signer, registrar, {
    "registrarOwner": registrarOwner,
    "ansRegistryId": ansRegistryId,
    "defaultResolverId": defaultResolverId
  })

  const setupScript = await Script.fromSource(signer.provider, 'setup_ans.ral')
  const scriptTx = await setupScript.transactionForDeployment(signer, {
    initialFields: {
      "ansRegistryId": ansRegistryId,
      "registrarId": registrarId
    }
  })
  const submitResult = await signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
  await waitTxConfirmed(signer.provider, submitResult.txId)
  return registrarId
}

export async function deploy(
  signer: SignerWithNodeProvider,
  registrarOwner: string
): Promise<string> {
  const ansRegistryId = await deployANSRegistry(signer)
  console.log("ANSRegistry id: " + ansRegistryId)
  return await deployRegistrar(signer, ansRegistryId, registrarOwner)
}

export async function deployOnDevnet() {
  const provider = new NodeProvider("http://127.0.0.1:22973")
  const signer = await testWallet(provider)
  const registrarId = await deploy(signer, testAddress)
  console.log("Registrar contract id: " + registrarId)
}

deployOnDevnet()
