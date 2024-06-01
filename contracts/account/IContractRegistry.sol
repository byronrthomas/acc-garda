// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {GuardianRegistry} from "../roles/GuardianRegistry.sol";
import {OwnershipRegistry} from "../roles/OwnershipRegistry.sol";
import {RiskManager} from "../limits/RiskManager.sol";

interface IContractRegistry {
    function guardianRegistry() external view returns (GuardianRegistry);
    function ownershipRegistry() external view returns (OwnershipRegistry);
    function riskManager() external view returns (RiskManager);
}
