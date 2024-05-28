// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./WithGuardians.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
Contract intended to be used mostly as a mix-in via subclassing.
It allows for social recovery via voting by a preset number of guardians.
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
contract GuardedOwnership is WithGuardians {
    using EnumerableSet for EnumerableSet.AddressSet;
    event OwnershipTransferProposed(
        address indexed firstProposer,
        address indexed proposedOwner
    );
    event OwnershipTransferVoteCasted(
        address indexed voter,
        address indexed owner
    );
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    address public owner;
    uint256 public votesRequired;
    string public ownerDisplayName;

    address public proposedOwner;
    EnumerableSet.AddressSet private votesForProposedOwner;

    constructor(
        address _owner,
        address[] memory _guardianAddresses,
        uint256 _votesRequired, // Number of votes required to transfer ownership,
        string memory _ownerDisplayName
    ) WithGuardians(_guardianAddresses) {
        require(_owner != address(0), "Invalid owner address");
        require(
            _votesRequired <= _guardianAddresses.length,
            "Cannot require more votes from guardians than the number of guardians"
        );
        owner = _owner;
        votesRequired = _votesRequired;
        ownerDisplayName = _ownerDisplayName;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this method");
        _;
    }

    function voteForNewOwner(address _proposedOwner) public onlyGuardian {
        require(_proposedOwner != address(0), "Invalid new owner address");
        require(_proposedOwner != owner, "Proposed owner is already the owner");

        // Check whether this is a new proposition (for logging purposes)
        if (proposedOwner != _proposedOwner) {
            emit OwnershipTransferProposed(msg.sender, _proposedOwner);
            proposedOwner = _proposedOwner;
            clearVotes();
        }

        // Add the vote
        votesForProposedOwner.add(msg.sender);
        emit OwnershipTransferVoteCasted(msg.sender, _proposedOwner);

        // If the required number of votes is reached, transfer the ownership
        if (getVotesForProposedOwner() >= votesRequired) {
            address previousOwner = owner;
            owner = proposedOwner;
            proposedOwner = address(0);
            clearVotes();
            emit OwnershipTransferred(previousOwner, owner);
        }
    }

    function getVotesForProposedOwner() public view returns (uint256) {
        return votesForProposedOwner.length();
    }

    function getVoteAtIndex(uint index) public view returns (address) {
        return votesForProposedOwner.at(index);
    }

    function clearVotes() private {
        while (votesForProposedOwner.length() > 0) {
            votesForProposedOwner.remove(votesForProposedOwner.at(0));
        }
    }
}
