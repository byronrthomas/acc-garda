// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IAccount, ACCOUNT_VALIDATION_SUCCESS_MAGIC} from "@matterlabs/zksync-contracts/l2/system-contracts/interfaces/IAccount.sol";
import {TransactionHelper, Transaction} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/TransactionHelper.sol";
import {EfficientCall} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/EfficientCall.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
// Access zkSync system contracts for nonce validation via NONCE_HOLDER_SYSTEM_CONTRACT
import {NONCE_HOLDER_SYSTEM_CONTRACT, INonceHolder, DEPLOYER_SYSTEM_CONTRACT, BOOTLOADER_FORMAL_ADDRESS, ETH_TOKEN_SYSTEM_CONTRACT} from "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
// to call non-view function of system contracts
import {SystemContractsCaller, Utils} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";

import {GuardedOwnership} from "./GuardedOwnership.sol";
import {PaymasterForGuardians} from "../paymasters/PaymasterForGuardians.sol";
import {GuardedRiskLimits} from "../limits/GuardedRiskLimits.sol";

// Credit: the initial implementation of this takes heavy pointers from the example code in the ZKSync docs:
// https://docs.zksync.io/build/tutorials/smart-contract-development/account-abstraction/daily-spend-limit.html
contract GuardedAccount is
    IAccount,
    IERC1271,
    GuardedOwnership,
    PaymasterForGuardians,
    GuardedRiskLimits
{
    // to get transaction hash
    using TransactionHelper for Transaction;

    bytes4 public constant EIP1271_SUCCESS_RETURN_VALUE = 0x1626ba7e;
    address public constant ETH_TOKEN_ADDRESS =
        address(ETH_TOKEN_SYSTEM_CONTRACT);

    constructor(
        address _owner,
        address[] memory _guardianAddresses,
        uint16 _votesRequired, // Number of votes required to transfer ownership,
        string memory _ownerDisplayName,
        uint256 _riskLimitTimeWindow,
        uint256 _defaultRiskLimit
    )
        GuardedOwnership(
            _owner,
            _guardianAddresses,
            _votesRequired,
            _ownerDisplayName
        )
        // Paymaster will only pay for guardians to interact with this account
        PaymasterForGuardians(_guardianAddresses, address(this))
        GuardedRiskLimits(
            _riskLimitTimeWindow,
            _defaultRiskLimit,
            _guardianAddresses,
            address(this),
            _votesRequired
        )
    {}

    function validateTransaction(
        bytes32,
        bytes32 _suggestedSignedHash,
        Transaction calldata _transaction
    ) external payable override onlyBootloader returns (bytes4 magic) {
        return _validateTransaction(_suggestedSignedHash, _transaction);
    }

    function _validateTransaction(
        bytes32 _suggestedSignedHash,
        Transaction calldata _transaction
    ) internal returns (bytes4 magic) {
        // Incrementing the nonce of the account.
        // Note, that reserved[0] by convention is currently equal to the nonce passed in the transaction
        SystemContractsCaller.systemCallWithPropagatedRevert(
            uint32(gasleft()),
            address(NONCE_HOLDER_SYSTEM_CONTRACT),
            0,
            abi.encodeCall(
                INonceHolder.incrementMinNonceIfEquals,
                (_transaction.nonce)
            )
        );

        bytes32 txHash;
        // While the suggested signed hash is usually provided, it is generally
        // not recommended to rely on it to be present, since in the future
        // there may be tx types with no suggested signed hash.
        if (_suggestedSignedHash == bytes32(0)) {
            txHash = _transaction.encodeHash();
        } else {
            txHash = _suggestedSignedHash;
        }

        // The fact there is are enough balance for the account
        // should be checked explicitly to prevent user paying for fee for a
        // transaction that wouldn't be included on Ethereum.
        uint256 totalRequiredBalance = _transaction.totalRequiredBalance();
        require(
            totalRequiredBalance <= address(this).balance,
            "Not enough balance for fee + value"
        );

        if (
            isValidSignature(txHash, _transaction.signature) ==
            EIP1271_SUCCESS_RETURN_VALUE
        ) {
            magic = ACCOUNT_VALIDATION_SUCCESS_MAGIC;
        } else {
            magic = bytes4(0);
        }
    }

    function executeTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable override onlyBootloader {
        _executeTransaction(_transaction);
    }

    bytes4 public constant ERC_20_TRANSFER_SELECTOR = 0xa9059cbb;
    bytes4 public constant ERC_20_APPROVE_SELECTOR = 0x095ea7b3;
    bytes4 public constant ERC_20_BURN_SELECTOR = 0x42966c68;
    bytes4 public constant ERC_20_INCREASE_ALLOWANCE_SELECTOR = 0x39509351;

    function _decodeDataToERC20Amount(
        bytes calldata data
    ) private returns (bool shouldCheck, uint256 erc20Amount) {
        if (data.length > 4) {
            bytes4 selector = bytes4(data[:4]);
            if (selector == ERC_20_TRANSFER_SELECTOR) {
                // transfer(address,uint256)
                (, uint256 amount) = abi.decode(data[4:], (address, uint256));
                return (true, amount);
            }
            if (selector == ERC_20_APPROVE_SELECTOR) {
                // approve(address,uint256)
                (, uint256 amount) = abi.decode(data[4:], (address, uint256));
                return (true, amount);
            }
            if (selector == ERC_20_BURN_SELECTOR) {
                // burn(uint256)
                uint256 amount = abi.decode(data[4:], (uint256));
                return (true, amount);
            }
            if (selector == ERC_20_INCREASE_ALLOWANCE_SELECTOR) {
                // increaseAllowance(address,uint256)
                (, uint256 amount) = abi.decode(data[4:], (address, uint256));
                return (true, amount);
            }
        }
        return (false, 0);
    }

    function _executeTransaction(Transaction calldata _transaction) internal {
        address to = address(uint160(_transaction.to));
        uint128 value = Utils.safeCastToU128(_transaction.value);
        bytes calldata data = _transaction.data;

        // Call SpendLimit contract to ensure that ETH `value` doesn't exceed the daily spending limit
        if (value > 0) {
            _checkRiskLimit(address(ETH_TOKEN_ADDRESS), value);
        } else {
            (bool shouldCheck, uint256 erc20Amount) = _decodeDataToERC20Amount(
                data
            );
            if (shouldCheck) {
                _checkRiskLimit(address(to), erc20Amount);
            }
        }

        uint32 gas = Utils.safeCastToU32(gasleft());

        if (to == address(DEPLOYER_SYSTEM_CONTRACT)) {
            // Note, that the deployer contract can only be called
            // with a "systemCall" flag.
            SystemContractsCaller.systemCallWithPropagatedRevert(
                gas,
                to,
                value,
                data
            );
        } else {
            // NOTE: unlike the example in the documentation, this version
            // propagates the revert (following the example in DefaultAccount.sol)

            // Version that does this using solidity native features (could be assembly optimised)
            // bool success;
            // bytes memory returnData;
            // uint32 gas = Utils.safeCastToU32(gasleft());

            // (success, returnData) = address(to).call{value: value, gas: gas}(
            //     data
            // );
            // if (!success) {
            //     assembly {
            //         let size := mload(returnData)
            //         revert(add(returnData, 0x20), size)
            //     }
            // }

            // Version taken from DefaultAccount.sol
            bool success = EfficientCall.rawCall(gas, to, value, data, false);
            if (!success) {
                EfficientCall.propagateRevert();
            }
        }
    }

    function executeTransactionFromOutside(
        Transaction calldata _transaction
    ) external payable {
        bytes4 magic = _validateTransaction(bytes32(0), _transaction);
        require(magic == ACCOUNT_VALIDATION_SUCCESS_MAGIC, "NOT VALIDATED");
        _executeTransaction(_transaction);
    }

    function isValidSignature(
        bytes32 _hash,
        bytes memory _signature
    ) public view override returns (bytes4 magic) {
        magic = EIP1271_SUCCESS_RETURN_VALUE;

        if (_signature.length != 65) {
            // Signature is invalid anyway, but we need to proceed with the signature verification as usual
            // in order for the fee estimation to work correctly
            _signature = new bytes(65);

            // Making sure that the signatures look like a valid ECDSA signature and are not rejected rightaway
            // while skipping the main verification process.
            _signature[64] = bytes1(uint8(27));
        }

        // extract ECDSA signature
        uint8 v;
        bytes32 r;
        bytes32 s;
        // Signature loading code
        // we jump 32 (0x20) as the first slot of bytes contains the length
        // we jump 65 (0x41) per signature
        // for v we load 32 bytes ending with v (the first 31 come from s) then apply a mask
        /* solhint-disable no-inline-assembly */
        assembly {
            r := mload(add(_signature, 0x20))
            s := mload(add(_signature, 0x40))
            v := and(mload(add(_signature, 0x41)), 0xff)
        }
        /* solhint-enable no-inline-assembly */

        if (v != 27 && v != 28) {
            magic = bytes4(0);
        }

        // EIP-2 still allows signature malleability for ecrecover(). Remove this possibility and make the signature
        // unique. Appendix F in the Ethereum Yellow paper (https://ethereum.github.io/yellowpaper/paper.pdf), defines
        // the valid range for s in (301): 0 < s < secp256k1n ÷ 2 + 1, and for v in (302): v ∈ {27, 28}. Most
        // signatures from current libraries generate a unique signature with an s-value in the lower half order.
        //
        // If your library generates malleable signatures, such as s-values in the upper range, calculate a new s-value
        // with 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141 - s1 and flip v from 27 to 28 or
        // vice versa. If your library also generates signatures with 0/1 for v instead 27/28, add 27 to v to accept
        // these malleable signatures as well.
        if (
            uint256(s) >
            0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0
        ) {
            magic = bytes4(0);
        }

        address recoveredAddress = ecrecover(_hash, v, r, s);

        // Note, that we should abstain from using the require here in order to allow for fee estimation to work
        if (recoveredAddress != owner && recoveredAddress != address(0)) {
            magic = bytes4(0);
        }
    }

    function payForTransaction(
        bytes32,
        bytes32,
        Transaction calldata _transaction
    ) external payable override onlyBootloader {
        bool success = _transaction.payToTheBootloader();
        require(success, "Failed to pay the fee to the operator");
    }

    function prepareForPaymaster(
        bytes32, // _txHash
        bytes32, // _suggestedSignedHash
        Transaction calldata _transaction
    ) external payable override onlyBootloader {
        _transaction.processPaymasterInput();
    }

    fallback() external {
        // fallback of default account shouldn't be called by bootloader under no circumstances
        assert(msg.sender != BOOTLOADER_FORMAL_ADDRESS);

        // If the contract is called directly, behave like an EOA
    }

    receive() external payable {
        // If the contract is called directly, behave like an EOA.
        // Note, that is okay if the bootloader sends funds with no calldata as it may be
        // used for refunds/operator payments
    }
}
