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
import { default as AccountInfoContractJson } from "../resolvers/AccountInfo.ral.json";
import { getContractByCodeHash } from "./contracts";

// Custom types for the contract
export namespace AccountInfoTypes {
  export type Fields = {
    resolver: HexString;
    pubkey: HexString;
    addresses: HexString;
  };

  export type State = ContractState<Fields>;

  export interface CallMethodTable {
    getAddress: {
      params: CallContractParams<{ chainId: bigint }>;
      result: CallContractResult<HexString>;
    };
    getPubkey: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<HexString>;
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
  AccountInfoInstance,
  AccountInfoTypes.Fields
> {
  consts = {
    ErrorCodes: {
      InvalidCaller: BigInt(0),
      InvalidArgs: BigInt(1),
      ExpectAssetAddress: BigInt(2),
      NameHasBeenRegistered: BigInt(3),
      ContractNotExists: BigInt(4),
      PrimaryRecordNotExists: BigInt(5),
    },
  };

  at(address: string): AccountInfoInstance {
    return new AccountInfoInstance(address);
  }

  tests = {
    setAddress: async (
      params: TestContractParams<
        AccountInfoTypes.Fields,
        { chainId: bigint; address: HexString }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "setAddress", params);
    },
    getAddress: async (
      params: TestContractParams<AccountInfoTypes.Fields, { chainId: bigint }>
    ): Promise<TestContractResult<HexString>> => {
      return testMethod(this, "getAddress", params);
    },
    setPubkey: async (
      params: TestContractParams<
        AccountInfoTypes.Fields,
        { newPubkey: HexString }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "setPubkey", params);
    },
    getPubkey: async (
      params: Omit<
        TestContractParams<AccountInfoTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResult<HexString>> => {
      return testMethod(this, "getPubkey", params);
    },
    destroy: async (
      params: TestContractParams<
        AccountInfoTypes.Fields,
        { refundAddress: Address }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "destroy", params);
    },
  };
}

// Use this object to test and deploy the contract
export const AccountInfo = new Factory(
  Contract.fromJson(
    AccountInfoContractJson,
    "",
    "9f41e2b03b94eee005a632fa7868b52b342910089286e5bc969e333283b47f23"
  )
);

// Use this class to interact with the blockchain
export class AccountInfoInstance extends ContractInstance {
  constructor(address: Address) {
    super(address);
  }

  async fetchState(): Promise<AccountInfoTypes.State> {
    return fetchContractState(AccountInfo, this);
  }

  methods = {
    getAddress: async (
      params: AccountInfoTypes.CallMethodParams<"getAddress">
    ): Promise<AccountInfoTypes.CallMethodResult<"getAddress">> => {
      return callMethod(
        AccountInfo,
        this,
        "getAddress",
        params,
        getContractByCodeHash
      );
    },
    getPubkey: async (
      params?: AccountInfoTypes.CallMethodParams<"getPubkey">
    ): Promise<AccountInfoTypes.CallMethodResult<"getPubkey">> => {
      return callMethod(
        AccountInfo,
        this,
        "getPubkey",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
  };

  async multicall<Calls extends AccountInfoTypes.MultiCallParams>(
    calls: Calls
  ): Promise<AccountInfoTypes.MultiCallResults<Calls>> {
    return (await multicallMethods(
      AccountInfo,
      this,
      calls,
      getContractByCodeHash
    )) as AccountInfoTypes.MultiCallResults<Calls>;
  }
}
