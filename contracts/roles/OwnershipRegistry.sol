// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {GuardianRegistry} from "../roles/GuardianRegistry.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
It allows for social recovery via voting by a preset number of guardians.
It relies on a guardian registry to tell it who the guardians are.
 The API has intentionally been keep simple to aid the UX for users, which
 is why their is only a single voteForNewOwner function.
 If a distinct number of votes are received for a new owner, without any
 intervening votes for some other owner, the ownership is transferred.
 The alternative would be a "propose-and-vote" system, which could either be:
    * only a guardian can propose a new owner - this means the guardians have to
    know whether they are proposing or voting, complicating their UX, for a little
    security benefit (hacker has to achieve slightly different transactions from guardians
    but same number overall)
    * OR anyone can propose a new owner - normally this would be done by the old owner who has
    lost their key, and then there is no security gain from separating the propose and vote actions
 */
contract OwnershipRegistry {
    using EnumerableSet for EnumerableSet.AddressSet;
    event OwnershipTransferProposed(
        address indexed account,
        address indexed firstProposer,
        address indexed proposedOwner
    );
    event OwnershipTransferVoteCasted(
        address indexed account,
        address indexed voter,
        address indexed owner
    );
    event OwnershipTransferred(
        address indexed account,
        address indexed previousOwner,
        address indexed newOwner
    );
    GuardianRegistry public guardianRegistry;
    mapping(address => address) public accountOwner;
    mapping(address => uint16) public accountVotesRequired;
    mapping(address => string) public accountOwnerDisplayName;

    mapping(address => address) public proposedOwner;
    mapping(address => EnumerableSet.AddressSet) private votesForProposedOwner;

    constructor(GuardianRegistry _guardianRegistry) {
        require(
            address(_guardianRegistry) != address(0),
            "Invalid guardian registry address"
        );
        guardianRegistry = _guardianRegistry;
    }

    function setInitialOwner(
        address _account,
        address _owner,
        uint16 _votesRequired, // Number of votes required to transfer ownership,
        string memory _ownerDisplayName
    ) external {
        require(
            address(_account) != address(0) && _account != address(this),
            "Invalid account address"
        );
        require(
            _owner != address(0) && _owner != address(this),
            "Invalid owner address"
        );
        require(
            accountOwner[_account] == address(0),
            "Owner already set for account - needs guardian voting to change it"
        );
        require(
            bytes(_ownerDisplayName).length > 0,
            "Invalid owner display name"
        );
        uint256 numGuardians = guardianRegistry.getGuardianCountFor(_account);
        require(
            _votesRequired <= numGuardians,
            "Votes required exceeds number of guardians"
        );

        accountOwner[_account] = _owner;
        accountVotesRequired[_account] = _votesRequired;
        accountOwnerDisplayName[_account] = _ownerDisplayName;
    }

    modifier onlyGuardian(address _account) {
        require(
            guardianRegistry.isGuardianFor(_account, msg.sender),
            "Only guardian can call this method"
        );
        _;
    }

    function voteForNewOwner(
        address _account,
        address _proposedOwner
    ) external onlyGuardian(_account) {
        require(_proposedOwner != address(0), "Invalid new owner address");
        address owner = accountOwner[_account];
        uint16 votesRequired = accountVotesRequired[_account];
        require(
            _proposedOwner != owner && _proposedOwner != address(this),
            "Proposed owner is already the owner"
        );

        // Check whether this is a new proposition (for logging purposes)
        if (proposedOwner[_account] != _proposedOwner) {
            emit OwnershipTransferProposed(
                _account,
                msg.sender,
                _proposedOwner
            );
            proposedOwner[_account] = _proposedOwner;
            _clearVotes(_account);
        }

        // Add the vote
        votesForProposedOwner[_account].add(msg.sender);
        emit OwnershipTransferVoteCasted(_account, msg.sender, _proposedOwner);

        // If the required number of votes is reached, transfer the ownership
        if (getVotesForProposedOwner(_account) >= votesRequired) {
            address previousOwner = owner;
            accountOwner[_account] = proposedOwner[_account];
            proposedOwner[_account] = address(0);
            _clearVotes(_account);
            emit OwnershipTransferred(_account, previousOwner, owner);
        }
    }

    function getVotesForProposedOwner(
        address _account
    ) public view returns (uint256) {
        return votesForProposedOwner[_account].length();
    }

    function getVoteAtIndex(
        address _account,
        uint256 index
    ) public view returns (address) {
        return votesForProposedOwner[_account].at(index);
    }

    function _clearVotes(address _account) private {
        delete votesForProposedOwner[_account];
    }

    function getOwner() external view returns (address) {
        return accountOwner[msg.sender];
    }

    function getOwnerDisplayName() external view returns (string memory) {
        return accountOwnerDisplayName[msg.sender];
    }
}
