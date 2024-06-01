// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
Contract that is responsible for saying who are the guardians of which account.
Anybody can set a list of guardians for an address, but after one is set, only
calls from the guarded address are allowed to change the list.
 */
contract GuardianRegistry {
    using EnumerableSet for EnumerableSet.AddressSet;

    // Mapping from address to guardian addresses
    mapping(address => EnumerableSet.AddressSet) private guardiansByAddress;

    function setGuardiansFor(
        address _address,
        address[] memory _guardians
    ) external {
        if (guardiansByAddress[_address].length() != 0) {
            require(
                msg.sender == _address,
                "Only the guarded address can change it's guardians"
            );
            // Reset the list of guardians
            delete guardiansByAddress[_address];
        }

        for (uint256 x = 0; x < _guardians.length; ++x) {
            guardiansByAddress[_address].add(_guardians[x]);
        }
    }

    function getGuardiansFor(
        address _address
    ) external view returns (address[] memory) {
        address[] memory guardians = new address[](
            guardiansByAddress[_address].length()
        );
        for (uint256 x = 0; x < guardians.length; ++x) {
            guardians[x] = guardiansByAddress[_address].at(x);
        }
        return guardians;
    }

    function isGuardianFor(
        address _address,
        address _guardian
    ) external view returns (bool) {
        return guardiansByAddress[_address].contains(_guardian);
    }

    function getGuardianCountFor(
        address _address
    ) external view returns (uint256) {
        return guardiansByAddress[_address].length();
    }
}
