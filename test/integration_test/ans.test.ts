import { DUST_AMOUNT, ONE_ALPH, addressFromContractId, binToHex, groupOfAddress, sleep, subContractId, web3 } from "@alephium/web3"
import { PrivateKeyWallet } from "@alephium/web3-wallet"
import { BurnCredentialToken, CredentialToken, MintCredentialToken, PrimaryRegistrar, PrimaryRegistrarInstance, Record, RecordInstance, RecordTypes, RegisterPrimaryRecord, RegisterSecondaryRecord, RenewPrimaryRecord, SecondaryRegistrar, SecondaryRegistrarInstance } from "../../artifacts/ts"
import { keccak256 } from "ethers/lib/utils"
import { getSigner, transfer } from "@alephium/web3-test"

web3.setCurrentNodeProvider('http://127.0.0.1:22973')

const testPrivateKeys = [
  'a642942e67258589cd2b1822c631506632db5a12aabcf413604e785300d762a5',
  'ec8c4e863e4027d5217c382bfc67bd2638f21d6f956653505229f1d242123a9a',
  'bd7dd0c4abd3cf8ba2d169c8320a2cc8bc8ab583b0db9a32d4352d6f5b15d037',
  '93ae1392f36a592aca154ea14e51b791c248beaea1b63117c57cc46d56e5f482'
]

const testWallets = testPrivateKeys.map((privateKey) => new PrivateKeyWallet({ privateKey }))
const encoder = new TextEncoder()

const MinRegistrationDuration = 10n * 1000n

function cost(duration: bigint): bigint {
  return 1000n * duration
}

async function deploySecondaryRegistrar(group: number, primaryRegistrarId: string) {
  const wallet = testWallets[group]
  const recordTemplate = await Record.deploy(wallet, { initialFields: Record.getInitialFieldsWithDefaultValues() })
  return await SecondaryRegistrar.deploy(wallet, {
    initialFields: {
      primaryRegistrar: primaryRegistrarId,
      recordTemplateId: recordTemplate.contractInstance.contractId,
    }
  })
}

async function deployPrimaryRegistrar() {
  const wallet = testWallets[0]
  const recordTemplate = await Record.deploy(wallet, { initialFields: Record.getInitialFieldsWithDefaultValues() })
  const credentialTokenTemplate = await CredentialToken.deploy(wallet, {
    initialFields: { registrar: '', name: '' }
  })
  return await PrimaryRegistrar.deploy(wallet, {
    initialFields: {
      registrarOwner: wallet.address,
      recordTemplateId: recordTemplate.contractInstance.contractId,
      credentialTokenTemplateId: credentialTokenTemplate.contractInstance.contractId,
      minRegistrationDuration: MinRegistrationDuration
    }
  })
}

async function registerPrimaryRecord(
  wallet: PrivateKeyWallet,
  primaryRegistrarId: string,
  name: string,
  duration: bigint
) {
  expect(wallet.group).toEqual(0)
  return await RegisterPrimaryRecord.execute(wallet, {
    initialFields: {
      registrar: primaryRegistrarId,
      name: binToHex(encoder.encode(name)),
      duration
    },
    attoAlphAmount: ONE_ALPH + cost(duration)
  })
}

async function renewPrimaryRecord(
  wallet: PrivateKeyWallet,
  primaryRegistrarId: string,
  name: string,
  duration: bigint
) {
  expect(wallet.group).toEqual(0)
  return await RenewPrimaryRecord.execute(wallet, {
    initialFields: {
      registrar: primaryRegistrarId,
      name: binToHex(encoder.encode(name)),
      duration
    },
    attoAlphAmount: cost(duration) + DUST_AMOUNT
  })
}

async function mintCredentialToken(
  wallet: PrivateKeyWallet,
  primaryRegistrarId: string,
  name: string
) {
  expect(wallet.group).toEqual(0)
  return await MintCredentialToken.execute(wallet, {
    initialFields: {
      registrar: primaryRegistrarId,
      name: binToHex(encoder.encode(name))
    },
    attoAlphAmount: ONE_ALPH + DUST_AMOUNT
  })
}

async function getCredentialTokenId(
  primaryRegistrar: string,
  name: string
) {
  const nameBytes = encoder.encode(name)
  const node = keccak256(nameBytes).slice(2)
  const contractId = subContractId(primaryRegistrar, node, 0)
  const primaryRecord = Record.at(addressFromContractId(contractId))
  const state = await primaryRecord.fetchState()
  const path = node + state.fields.ttl.toString(16).padStart(64, '0')
  return subContractId(primaryRegistrar, path, 0)
}

async function burnCredentialToken(
  wallet: PrivateKeyWallet,
  primaryRegistrar: string,
  name: string
) {
  expect(wallet.group).toEqual(0)
  const credentialTokenId = await getCredentialTokenId(primaryRegistrar, name)
  return await BurnCredentialToken.execute(wallet, {
    initialFields: {
      registrar: primaryRegistrar,
      name: binToHex(encoder.encode(name)),
      credentialTokenId: credentialTokenId,
    },
    tokens: [{ id: credentialTokenId, amount: 1n }]
  })
}

async function registerSecondaryRecord(
  wallet: PrivateKeyWallet,
  secondaryRegistrarId: string,
  name: string,
  ttl: bigint,
  credentialTokenId: string
) {
  expect(wallet.group).not.toEqual(0)
  return await RegisterSecondaryRecord.execute(wallet, {
    initialFields: {
      registrar: secondaryRegistrarId,
      name: binToHex(encoder.encode(name)),
      ttl,
      credentialTokenId
    },
    attoAlphAmount: ONE_ALPH + DUST_AMOUNT,
    tokens: [{ id: credentialTokenId, amount: 1n }]
  })
}

type ANSContracts = {
  primaryRegistrar: PrimaryRegistrarInstance,
  secondaryRegistrars: [SecondaryRegistrarInstance, SecondaryRegistrarInstance, SecondaryRegistrarInstance]
}


async function deployANSContracts(): Promise<ANSContracts> {
  const primaryRegistrar = await deployPrimaryRegistrar()
  const secondaryRegistrars: SecondaryRegistrarInstance[] = []
  for (let group = 1; group <= 3; group++) {
    const result = await deploySecondaryRegistrar(group, primaryRegistrar.contractInstance.contractId)
    secondaryRegistrars.push(result.contractInstance)
  }
  return {
    primaryRegistrar: primaryRegistrar.contractInstance,
    secondaryRegistrars: secondaryRegistrars as ANSContracts['secondaryRegistrars']
  }
}

async function getWallets(): Promise<PrivateKeyWallet[]> {
  const wallets: PrivateKeyWallet[] = []
  for (let group = 0; group <= 3; group++) {
    const wallet = await getSigner(ONE_ALPH * 10n, group)
    wallets.push(wallet)
  }
  return wallets
}

function getRecordId(registrarId: string, name: string): string {
  const nameBytes = encoder.encode(name)
  const node = keccak256(nameBytes).slice(2)
  return subContractId(registrarId, node, groupOfAddress(addressFromContractId(registrarId)))
}

describe('test ans contracts', () => {
  let ansContracts: ANSContracts
  let initWallets: PrivateKeyWallet[]

  beforeAll(async () => {
    ansContracts = await deployANSContracts()
    initWallets = await getWallets()
  })

  function getRegistrarId(group: number): string {
    if (group === 0) return ansContracts.primaryRegistrar.contractId
    return ansContracts.secondaryRegistrars[group-1].contractId
  }

  async function checkRecord(name: string, group: number, fields: RecordTypes.Fields) {
    const contractId = getRecordId(getRegistrarId(group), name)
    const record = Record.at(addressFromContractId(contractId))
    const state = await record.fetchState()
    expect(state.fields).toEqual(fields)
  }

  async function checkCredentialToken(address: string, credentialTokenId: string) {
    const balances = await web3.getCurrentNodeProvider().addresses.getAddressesAddressBalance(address)
    const token = balances.tokenBalances?.find((t) => t.id === credentialTokenId)
    expect(token).toEqual({ id: credentialTokenId, amount: "1" })
  }

  async function registerTo4Groups(name: string, wallets: PrivateKeyWallet[]): Promise<{ primaryRecord: RecordInstance, credentialTokenId: string, ttl: bigint }> {
    const primaryRegistrarId = getRegistrarId(0)
    await registerPrimaryRecord(wallets[0], primaryRegistrarId, name, MinRegistrationDuration)
    await mintCredentialToken(wallets[0], primaryRegistrarId, name)
    const primaryRecord = Record.at(addressFromContractId(getRecordId(primaryRegistrarId, name)))
    const ttl = (await primaryRecord.fetchState()).fields.ttl

    const credentialTokenId = await getCredentialTokenId(primaryRegistrarId, name)
    await checkCredentialToken(wallets[0].address, credentialTokenId)

    for (let group = 1; group <= 3; group++) {
      await transfer(wallets[group-1], wallets[group].address, credentialTokenId, 1n)
      await registerSecondaryRecord(wallets[group], getRegistrarId(group), name, ttl, credentialTokenId)
    }

    for (let group = 0; group <= 3; group++) {
      const record: RecordTypes.Fields = {
        registrar: getRegistrarId(group),
        owner: wallets[group].address,
        ttl,
        refundAddress: wallets[group].address
      }
      await checkRecord(name, group, record)
    }
    return { primaryRecord, credentialTokenId, ttl }
  }

  test('register to 4 groups', async () => {
    const primaryRegistrarId = getRegistrarId(0)
    const name = 'test0'
    const { credentialTokenId } = await registerTo4Groups(name, initWallets)

    await transfer(initWallets[3], initWallets[0].address, credentialTokenId, 1n)
    await burnCredentialToken(initWallets[0], primaryRegistrarId, name)
  }, 20 * 1000)

  test('register to 4 groups and renew', async () => {
    const primaryRegistrarId = getRegistrarId(0)
    const name = 'test1'
    const { credentialTokenId, ttl, primaryRecord } = await registerTo4Groups(name, initWallets)

    await transfer(initWallets[3], initWallets[0].address, credentialTokenId, 1n)
    await burnCredentialToken(initWallets[0], primaryRegistrarId, name)

    const duration = MinRegistrationDuration
    await renewPrimaryRecord(initWallets[0], primaryRegistrarId, name, duration)

    const newTTL = ttl + duration
    expect((await primaryRecord.fetchState()).fields.ttl).toEqual(newTTL)
    await mintCredentialToken(initWallets[0], primaryRegistrarId, name)
    const newCredentialTokenId = await getCredentialTokenId(primaryRegistrarId, name)
    for (let group = 1; group <= 3; group++) {
      await transfer(initWallets[group-1], initWallets[group].address, newCredentialTokenId, 1n)
      await registerSecondaryRecord(initWallets[group], getRegistrarId(group), name, newTTL, newCredentialTokenId)
    }

    for (let group = 0; group <= 3; group++) {
      const record: RecordTypes.Fields = {
        registrar: getRegistrarId(group),
        owner: initWallets[group].address,
        ttl: newTTL,
        refundAddress: initWallets[group].address
      }
      await checkRecord(name, group, record)
    }
  }, 40 * 1000)

  test('register with expired name', async () => {
    const primaryRegistrarId = getRegistrarId(0)
    const name = 'test2'
    const { credentialTokenId } = await registerTo4Groups(name, initWallets)
    await transfer(initWallets[3], initWallets[0].address, credentialTokenId, 1n)
    await burnCredentialToken(initWallets[0], primaryRegistrarId, name)

    await sleep(Number(MinRegistrationDuration) + 1000)

    const newWallets = await getWallets()
    const { credentialTokenId: newCredentialTokenId } = await registerTo4Groups(name, newWallets)

    await transfer(newWallets[3], newWallets[0].address, newCredentialTokenId, 1n)
    await burnCredentialToken(newWallets[0], primaryRegistrarId, name)
  }, 40 * 1000)
})
