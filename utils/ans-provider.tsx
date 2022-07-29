import { addressFromContractId, NodeProvider, subContractId, node } from "@alephium/web3";
import { keccak256, toUtf8Bytes } from "ethers/lib/utils";
import { createContext, useContext } from "react";
import { ReactNode } from "react";
import { default as ansContracts } from "../configs/contractIds.json"
const uts46 = require("idna-uts46-hx/uts46bundle.js")

const AlphRootNode = "b2453cbabd12c58b21d32b6c70e6c41c8ca2918d7f56c1b88e838edf168776bf"

export interface ANS {
  nodeProvider: NodeProvider

  isAvailable(node: string): Promise<boolean>
  getRecord(node: string): Promise<node.Val[]>
  getAddresses(node: string): Promise<Map<number, string>>
  getPubkey(node: string): Promise<string>
  getName(address: string): Promise<string>
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

function getSubNodeContractId(name: string): string {
  const label = keccak256(normalize(name)).slice(2)
  const subNodePath = keccak256(Buffer.from(AlphRootNode + label, 'hex')).slice(2)
  return subContractId(ansContracts.ansRegistryId, subNodePath)
}

function getSubNodeContractAddress(label: string): string {
  return addressFromContractId(getSubNodeContractId(label))
}

const defaultANS: ANS = {
  nodeProvider: new NodeProvider(ansContracts.nodeUrl),

  async isAvailable(name: string): Promise<boolean> {
    try {
      const recordContractAddress = getSubNodeContractAddress(name)
      await this.nodeProvider.contracts.getContractsAddressState(
        recordContractAddress,
        {group: ansContracts.group}
      )
      return false
    } catch(e) {
      return true
    }
  },

  async getRecord(name: string): Promise<node.Val[]> {
    const recordContractAddress = getSubNodeContractAddress(name)
    const state = await this.nodeProvider.contracts.getContractsAddressState(
      recordContractAddress,
      {group: ansContracts.group}
    )
    return state.fields
  },

  // TODO: implement
  async getAddresses(name: string): Promise<Map<number, string>> {
    return new Map<number, string>()
  },

  async getPubkey(name: string): Promise<string> {
    return name
  },

  async getName(address: string): Promise<string> {
    return address
  }
}

export const ANSProvider = ({
  children
}: {
  children: ReactNode;
}) => {
  return <ANSContext.Provider value={defaultANS}>{children}</ANSContext.Provider>
}
