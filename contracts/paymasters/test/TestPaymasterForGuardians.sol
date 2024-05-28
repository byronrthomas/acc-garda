// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {PaymasterForGuardians} from "../PaymasterForGuardians.sol";

// Just add a receive function so that the contract can receive ETH for testing purposes.
contract TestPaymasterForGuardians is PaymasterForGuardians {
    constructor(
        address[] memory _guardianAddresses,
        address _guardedAddress
    ) PaymasterForGuardians(_guardianAddresses, _guardedAddress) {}

    receive() external payable {}
}
