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
import { default as AddressInfoContractJson } from "../address_info.ral.json";

// Custom types for the contract
export namespace AddressInfoTypes {
  export type Fields = {
    parentId: HexString;
    addresses: HexString;
  };

  export type State = ContractState<Fields>;

  export interface CallMethodTable {
    getAddress: {
      params: CallContractParams<{ chainId: bigint }>;
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
  AddressInfoInstance,
  AddressInfoTypes.Fields
> {
  at(address: string): AddressInfoInstance {
    return new AddressInfoInstance(address);
  }

  tests = {
    setAddress: async (
      params: TestContractParams<
        AddressInfoTypes.Fields,
        { chainId: bigint; address: HexString }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "setAddress", params);
    },
    getAddress: async (
      params: TestContractParams<AddressInfoTypes.Fields, { chainId: bigint }>
    ): Promise<TestContractResult<HexString>> => {
      return testMethod(this, "getAddress", params);
    },
    destroy: async (
      params: TestContractParams<
        AddressInfoTypes.Fields,
        { refundAddress: HexString }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "destroy", params);
    },
  };
}

// Use this object to test and deploy the contract
export const AddressInfo = new Factory(
  Contract.fromJson(
    AddressInfoContractJson,
    "",
    "c19dc7a9fd7e6383f11369febf20e63eb37e14bd2be5b39ee059c5fdb514d1e4"
  )
);

// Use this class to interact with the blockchain
export class AddressInfoInstance extends ContractInstance {
  constructor(address: Address) {
    super(address);
  }

  async fetchState(): Promise<AddressInfoTypes.State> {
    return fetchContractState(AddressInfo, this);
  }

  methods = {
    getAddress: async (
      params: AddressInfoTypes.CallMethodParams<"getAddress">
    ): Promise<AddressInfoTypes.CallMethodResult<"getAddress">> => {
      return callMethod(AddressInfo, this, "getAddress", params);
    },
  };

  async multicall<Calls extends AddressInfoTypes.MultiCallParams>(
    calls: Calls
  ): Promise<AddressInfoTypes.MultiCallResults<Calls>> {
    return (await multicallMethods(
      AddressInfo,
      this,
      calls
    )) as AddressInfoTypes.MultiCallResults<Calls>;
  }
}