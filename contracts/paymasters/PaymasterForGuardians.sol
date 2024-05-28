// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// solhint-disable-next-line max-line-length
import {IPaymaster, ExecutionResult, PAYMASTER_VALIDATION_SUCCESS_MAGIC} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymaster.sol";
import {IPaymasterFlow} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IPaymasterFlow.sol";
import {Transaction} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";

import {BOOTLOADER_FORMAL_ADDRESS} from "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";

// Credit: initial version of this contract is based on the example code from the ZKSync skeleton
// project (GeneralPaymaster.sol).
// NOTE: This contract has intentionally been left abstract as it is intended to be mixed in to
// other contracts via inheritance. Any contract that inherits from this contract should have
// the ability to receive and withdraw ETH at a minimum, in order to be a useful gas-paying paymaster.

// This contract is for use with guarded accounts, where you want the guardians of
// the account to not need to pay fees when they interact with the account (_guardedAddress).
// Strictly speaking, this contract could be used as a paymaster for fees for a whitelist of
// address to interact with a single contract address.
abstract contract PaymasterForGuardians is IPaymaster {
    modifier onlyBootloader() {
        require(
            msg.sender == BOOTLOADER_FORMAL_ADDRESS,
            "Only bootloader can call this method"
        );
        // Continue execution if called from the bootloader.
        _;
    }

    address public guardedAddress;
    mapping(address => bool) public guardianAddresses;

    constructor(address[] memory _guardianAddresses, address _guardedAddress) {
        guardedAddress = _guardedAddress;
        for (uint256 x = 0; x < _guardianAddresses.length; ++x) {
            guardianAddresses[_guardianAddresses[x]] = true;
        }
    }

    function validateAndPayForPaymasterTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    )
        external
        payable
        onlyBootloader
        returns (bytes4 magic, bytes memory context)
    {
        // By default we consider the transaction as accepted.
        magic = PAYMASTER_VALIDATION_SUCCESS_MAGIC;
        require(
            _transaction.paymasterInput.length >= 4,
            "The standard paymaster input must be at least 4 bytes long"
        );

        bytes4 paymasterInputSelector = bytes4(
            _transaction.paymasterInput[0:4]
        );
        if (paymasterInputSelector == IPaymasterFlow.general.selector) {
            // extract the recipient address from the Transaction object
            address toAddress = address(uint160(_transaction.to));
            require(
                toAddress == guardedAddress,
                "Won't pay fees: Recipient of transaction is not the guarded address"
            );

            // extract the sender address from the Transaction object
            address fromAddress = address(uint160(_transaction.from));

            // only a guardian can have their fees paid for
            require(
                guardianAddresses[fromAddress],
                "Won't pay fees: Sender of transaction is not a guardian"
            );

            // Note, that while the minimal amount of ETH needed is tx.gasPrice * tx.gasLimit,
            // neither paymaster nor account are allowed to access this context variable.
            uint256 requiredETH = _transaction.gasLimit *
                _transaction.maxFeePerGas;

            // The bootloader never returns any data, so it can safely be ignored here.
            (bool success, ) = payable(BOOTLOADER_FORMAL_ADDRESS).call{
                value: requiredETH
            }("");
            require(
                success,
                "Failed to transfer fee to Bootloader. Paymaster balance might not be enough."
            );
        } else {
            revert("Unsupported paymaster flow in paymasterParams.");
        }
    }

    function postTransaction(
        bytes calldata _context,
        Transaction calldata _transaction,
        bytes32,
        bytes32,
        ExecutionResult _txResult,
        uint256 _maxRefundedGas
    )
        external
        payable
        override
        onlyBootloader
    // solhint-disable-next-line no-empty-blocks
    {

    }
}
