import { addressFromContractId, subContractId, NetworkId, groupOfAddress, web3 } from "@alephium/web3";
import { keccak256, toUtf8Bytes } from "ethers/lib/utils";
import { createContext, useContext } from "react";
import { ReactNode } from "react";
import configuration from "../alephium.config";
import { default as allDeployments } from "../artifacts/.deployments.devnet.json"
import { Record, RecordTypes } from "../artifacts/ts";
const uts46 = require("idna-uts46-hx/uts46bundle.js")

// namehash("alph")
const NodeUrl = process.env.NEXT_PUBLIC_NETWORK === 'devnet'
  ? 'http://127.0.0.1:22973'
  : '' // TODO: support testnet

web3.setCurrentNodeProvider(NodeUrl)

export interface NetworkConfig {
  network: NetworkId
  groupIndex: number
  primaryRegistrarId: string
}

export const Config = loadConfig(process.env.NEXT_PUBLIC_NETWORK as NetworkId)

function loadConfig(networkId: NetworkId): NetworkConfig {
  if (networkId === 'mainnet' || networkId === 'testnet') {
    throw new Error('Not support now')
  }
  const primaryGroup = configuration.networks[networkId].settings.primaryGroup
  const deployments = allDeployments.find((d) => groupOfAddress(d.deployerAddress) === primaryGroup)
  if (deployments === undefined) {
    throw new Error('The contracts have not been deployed to the primary group')
  }

  try {
    return {
      network: networkId,
      groupIndex: groupOfAddress(deployments.deployerAddress),
      primaryRegistrarId: deployments.contracts.PrimaryRegistrar!.contractInstance.contractId,
    }
  } catch (error) {
    console.log(`Failed to load deployments on ${networkId}, error: ${error}`)
    throw error
  }
}

export interface ANS {
  isAvailable(node: string): Promise<boolean>
  getPrimaryRecord(node: string): Promise<RecordTypes.Fields>
}

// @ts-ignore
export const ANSContext: Context<ANS> = createContext<ANS>()

export function useANS(): ANS {
  return useContext(ANSContext)
}

export function normalize(name: string): Uint8Array {
  return toUtf8Bytes(uts46.toUnicode(name, {useStd3ASCII: true}))
}

// TODO: support other TLDs
export function validateName(name: string) {
  if (name === '') throw new Error('Empty name')
  if (name.includes('.')) throw new Error('Only support ALPH 2LD')
  try {
    normalize(name)
  } catch (e) {
    throw new Error(String(e))
  }
}

function getPrimaryRecordContractId(name: string): string {
  const node = keccak256(normalize(name)).slice(2)
  return subContractId(Config.primaryRegistrarId, node, Config.groupIndex)
}

function getPrimaryRecordContractAddress(name: string): string {
  return addressFromContractId(getPrimaryRecordContractId(name))
}

const defaultANS: ANS = {
  async isAvailable(name: string): Promise<boolean> {
    try {
      const recordContractAddress = getPrimaryRecordContractAddress(name)
      await web3.getCurrentNodeProvider().contracts.getContractsAddressState(
        recordContractAddress,
        {group: Config.groupIndex}
      )
      return false
    } catch(e) {
      return true
    }
  },

  async getPrimaryRecord(name: string): Promise<RecordTypes.Fields> {
    const recordContractAddress = getPrimaryRecordContractAddress(name)
    const recordInstance = Record.at(recordContractAddress)
    const state = await recordInstance.fetchState()
    return state.fields
  },
}

export const ANSProvider = ({
  children
}: {
  children: ReactNode;
}) => {
  return <ANSContext.Provider value={defaultANS}>{children}</ANSContext.Provider>
}
