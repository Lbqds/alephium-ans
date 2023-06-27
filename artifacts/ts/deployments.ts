/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { RunScriptResult, DeployContractExecutionResult } from "@alephium/cli";
import { NetworkId } from "@alephium/web3";
import {
  Record,
  RecordInstance,
  ANSRegistry,
  ANSRegistryInstance,
  Registrar,
  RegistrarInstance,
  AccountInfo,
  AccountInfoInstance,
  AccountResolver,
  AccountResolverInstance,
} from ".";
import { default as devnetDeployments } from "../.deployments.devnet.json";

export type Deployments = {
  deployerAddress: string;
  contracts: {
    Record: DeployContractExecutionResult<RecordInstance>;
    ANSRegistry: DeployContractExecutionResult<ANSRegistryInstance>;
    Registrar: DeployContractExecutionResult<RegistrarInstance>;
    AccountInfo: DeployContractExecutionResult<AccountInfoInstance>;
    AccountResolver: DeployContractExecutionResult<AccountResolverInstance>;
  };
  scripts: { SetupANS: RunScriptResult };
};

function toDeployments(json: any): Deployments {
  const contracts = {
    Record: {
      ...json.contracts.Record,
      contractInstance: Record.at(
        json.contracts.Record.contractInstance.address
      ),
    },
    ANSRegistry: {
      ...json.contracts.ANSRegistry,
      contractInstance: ANSRegistry.at(
        json.contracts.ANSRegistry.contractInstance.address
      ),
    },
    Registrar: {
      ...json.contracts.Registrar,
      contractInstance: Registrar.at(
        json.contracts.Registrar.contractInstance.address
      ),
    },
    AccountInfo: {
      ...json.contracts.AccountInfo,
      contractInstance: AccountInfo.at(
        json.contracts.AccountInfo.contractInstance.address
      ),
    },
    AccountResolver: {
      ...json.contracts.AccountResolver,
      contractInstance: AccountResolver.at(
        json.contracts.AccountResolver.contractInstance.address
      ),
    },
  };
  return {
    ...json,
    contracts: contracts as Deployments["contracts"],
  };
}

export function loadDeployments(
  networkId: NetworkId,
  deployerAddress?: string
): Deployments {
  const deployments = networkId === "devnet" ? devnetDeployments : undefined;
  if (deployments === undefined) {
    throw Error("The contract has not been deployed to the " + networkId);
  }
  const allDeployments = Array.isArray(deployments)
    ? deployments
    : [deployments];
  if (deployerAddress === undefined) {
    if (allDeployments.length > 1) {
      throw Error(
        "The contract has been deployed multiple times on " +
          networkId +
          ", please specify the deployer address"
      );
    } else {
      return toDeployments(allDeployments[0]);
    }
  }
  const result = allDeployments.find(
    (d) => d.deployerAddress === deployerAddress
  );
  if (result === undefined) {
    throw Error("The contract deployment result does not exist");
  }
  return toDeployments(result);
}
