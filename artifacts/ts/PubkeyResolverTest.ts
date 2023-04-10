/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import {
  Address,
  Contract,
  ContractState,
  TestContractResult,
  HexString,
  ContractFactory,
  SubscribeOptions,
  EventSubscription,
  CallContractParams,
  CallContractResult,
  TestContractParams,
  ContractEvent,
  subscribeContractEvent,
  subscribeContractEvents,
  testMethod,
  callMethod,
  multicallMethods,
  fetchContractState,
  ContractInstance,
  getContractEventsCurrentCount,
} from "@alephium/web3";
import { default as PubkeyResolverTestContractJson } from "../tests/pubkey_resolver_test.ral.json";

// Custom types for the contract
export namespace PubkeyResolverTestTypes {
  export type Fields = {
    ansRegistryId: HexString;
    pubkeyInfoTemplateId: HexString;
  };

  export type State = ContractState<Fields>;

  export interface CallMethodTable {
    getPubkey: {
      params: CallContractParams<{ node: HexString }>;
      result: CallContractResult<HexString>;
    };
    getOwner: {
      params: CallContractParams<{ node: HexString }>;
      result: CallContractResult<Address>;
    };
  }
  export type CallMethodParams<T extends keyof CallMethodTable> =
    CallMethodTable[T]["params"];
  export type CallMethodResult<T extends keyof CallMethodTable> =
    CallMethodTable[T]["result"];
  export type MultiCallParams = Partial<{
    [Name in keyof CallMethodTable]: CallMethodTable[Name]["params"];
  }>;
  export type MultiCallResults<T extends MultiCallParams> = {
    [MaybeName in keyof T]: MaybeName extends keyof CallMethodTable
      ? CallMethodTable[MaybeName]["result"]
      : undefined;
  };
}

class Factory extends ContractFactory<
  PubkeyResolverTestInstance,
  PubkeyResolverTestTypes.Fields
> {
  at(address: string): PubkeyResolverTestInstance {
    return new PubkeyResolverTestInstance(address);
  }

  tests = {
    createPubkeyInfo: async (
      params: TestContractParams<
        PubkeyResolverTestTypes.Fields,
        { node: HexString; pubkey: HexString; payer: Address }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "createPubkeyInfo", params);
    },
    setPubkey: async (
      params: TestContractParams<
        PubkeyResolverTestTypes.Fields,
        { node: HexString; pubkey: HexString }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "setPubkey", params);
    },
    getPubkey: async (
      params: TestContractParams<
        PubkeyResolverTestTypes.Fields,
        { node: HexString }
      >
    ): Promise<TestContractResult<HexString>> => {
      return testMethod(this, "getPubkey", params);
    },
    removePubkeyInfo: async (
      params: TestContractParams<
        PubkeyResolverTestTypes.Fields,
        { node: HexString; refundAddress: Address }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "removePubkeyInfo", params);
    },
    getOwner: async (
      params: TestContractParams<
        PubkeyResolverTestTypes.Fields,
        { node: HexString }
      >
    ): Promise<TestContractResult<Address>> => {
      return testMethod(this, "getOwner", params);
    },
  };
}

// Use this object to test and deploy the contract
export const PubkeyResolverTest = new Factory(
  Contract.fromJson(
    PubkeyResolverTestContractJson,
    "",
    "b206e05931725581ed4ea4ac42363167398dc4ce909c1855b213e46424182202"
  )
);

// Use this class to interact with the blockchain
export class PubkeyResolverTestInstance extends ContractInstance {
  constructor(address: Address) {
    super(address);
  }

  async fetchState(): Promise<PubkeyResolverTestTypes.State> {
    return fetchContractState(PubkeyResolverTest, this);
  }

  methods = {
    getPubkey: async (
      params: PubkeyResolverTestTypes.CallMethodParams<"getPubkey">
    ): Promise<PubkeyResolverTestTypes.CallMethodResult<"getPubkey">> => {
      return callMethod(PubkeyResolverTest, this, "getPubkey", params);
    },
    getOwner: async (
      params: PubkeyResolverTestTypes.CallMethodParams<"getOwner">
    ): Promise<PubkeyResolverTestTypes.CallMethodResult<"getOwner">> => {
      return callMethod(PubkeyResolverTest, this, "getOwner", params);
    },
  };

  async multicall<Calls extends PubkeyResolverTestTypes.MultiCallParams>(
    calls: Calls
  ): Promise<PubkeyResolverTestTypes.MultiCallResults<Calls>> {
    return (await multicallMethods(
      PubkeyResolverTest,
      this,
      calls
    )) as PubkeyResolverTestTypes.MultiCallResults<Calls>;
  }
}
