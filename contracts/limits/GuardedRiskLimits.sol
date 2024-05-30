// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {RiskLimited} from "./RiskLimited.sol";

/**
 * @title GuardedRiskLimits
 * @dev This contract extends RiskLimited and adds guardian-based access control.
 */
contract GuardedRiskLimits is RiskLimited {
    // NOTE: this doesn't need changing from the account level, as it
    // should just be the contract address of the smart account.
    address private ownerAddress;
    uint16 public numVotesRequired;
    mapping(address => bool) private guardianAddresses;

    event DefaultRiskLimitChanged(uint256 oldLimit, uint256 newLimit);
    event SpecificRiskLimitChanged(
        address token,
        uint256 oldLimit,
        uint256 newLimit
    );
    event RiskLimitTimeWindowChanged(
        uint256 oldTimeWindow,
        uint256 newTimeWindow
    );
    event VoteForNewDefaultRiskLimit(address voter, uint256 newLimit);
    event VoteForNewSpecificRiskLimit(
        address voter,
        address token,
        uint256 newLimit
    );
    event VoteForNewRiskLimitTimeWindow(address voter, uint256 newTimeWindow);

    struct Vote {
        uint256 proposedValue;
        address[] voted;
        uint16 count;
    }
    mapping(address => Vote) public votesForSpecificRiskLimit;
    Vote public votesForDefaultRiskLimit;
    Vote public votesForRiskLimitTimeWindow;

    function resetVote(Vote storage _vote) internal {
        _vote.count = 0;
        _vote.voted = new address[](numVotesRequired);
        _vote.proposedValue = 0;
    }

    function processVote(
        Vote storage _vote,
        uint256 _proposedValue,
        address voter
    ) internal {
        if (_vote.proposedValue != _proposedValue) {
            resetVote(_vote);
            _vote.proposedValue = _proposedValue;
            _vote.voted[0] = voter;
            _vote.count++;
            return;
        }
        for (uint16 i = 0; i < numVotesRequired; i++) {
            if (_vote.voted[i] == address(0)) {
                _vote.voted[i] = voter;
                _vote.count++;
                break;
            }
            if (_vote.voted[i] == voter) {
                break;
            }
        }
    }

    constructor(
        uint256 _riskLimitTimeWindow,
        uint256 _defaultRiskLimit,
        address[] memory _guardianAddresses,
        address _owner,
        uint16 _numVotesRequired
    ) RiskLimited(_riskLimitTimeWindow, _defaultRiskLimit) {
        require(
            _numVotesRequired <= _guardianAddresses.length,
            "GuardedRiskLimits: Number of votes required exceeds number of guardians"
        );
        if (_numVotesRequired == 0 && _guardianAddresses.length > 0) {
            revert(
                "GuardedRiskLimits: Guardians should be removed if zero votes required"
            );
        }
        for (uint256 i = 0; i < _guardianAddresses.length; i++) {
            guardianAddresses[_guardianAddresses[i]] = true;
        }
        ownerAddress = _owner;
        numVotesRequired = _numVotesRequired;
    }

    modifier onlyGuardian_() {
        require(
            guardianAddresses[msg.sender],
            "GuardedRiskLimits: caller is not a guardian"
        );
        _;
    }

    modifier onlyOwner_() {
        require(
            msg.sender == ownerAddress,
            "GuardedRiskLimits: caller is not the owner"
        );
        _;
    }

    modifier onlyIfNoApprovalsNeeded() {
        require(
            numVotesRequired == 0,
            "GuardedRiskLimits: This action can only be performed via the guardians voting"
        );
        _;
    }

    /**
    Owner is allowed to immediately decrease the default spending limit, since this
    is a risk reduction operation.
     */
    function decreaseSpecificRiskLimit(
        address _token,
        uint256 _newLimit
    ) public onlyOwner_ {
        uint256 tokenLimit = limitForToken(_token);
        // solhint-disable-next-line reason-string
        require(
            tokenLimit > _newLimit,
            "GuardedRiskLimits: Cannot immediately increase risk limit, need guardians approval"
        );
        _setSpecificRiskLimit(_token, _newLimit);
        emit SpecificRiskLimitChanged(_token, tokenLimit, _newLimit);
    }

    /**
    Owner is allowed to immediately decrease the spending limit for a token, since this
    is a risk reduction operation.
     */
    function decreaseDefaultRiskLimit(uint256 _newLimit) public onlyOwner_ {
        // solhint-disable-next-line reason-string
        require(
            defaultRiskLimit > _newLimit,
            "GuardedRiskLimits: Cannot immediately increase risk limit, need guardians approval"
        );
        uint256 oldLimit = defaultRiskLimit;
        _setDefaultRiskLimit(_newLimit);
        emit DefaultRiskLimitChanged(oldLimit, _newLimit);
    }

    /**
    Owner is allowed to immediately increase the time window for spend measurement, since this
    is a risk reduction operation.
     */
    function increaseRiskLimitTimeWindow(
        uint256 _newTimeWindow
    ) public onlyOwner_ {
        // solhint-disable-next-line reason-string
        require(
            _newTimeWindow > riskLimitTimeWindow,
            "GuardedRiskLimits: Cannot immediately decrease time window, needs guardians approval"
        );
        uint256 oldTimeWindow = riskLimitTimeWindow;
        _setRiskLimitTimeWindow(_newTimeWindow);
        emit RiskLimitTimeWindowChanged(oldTimeWindow, _newTimeWindow);
    }

    /**
    Owner is ONLY allowed to immediately increase the spending limit for a token, if
    no votes are required from guardians.
     */
    function increaseSpecificRiskLimit(
        address _token,
        uint256 _newLimit
    ) public onlyOwner_ onlyIfNoApprovalsNeeded {
        uint256 tokenLimit = limitForToken(_token);
        require(_newLimit > tokenLimit, "Risk limit not increased");
        _setSpecificRiskLimit(_token, _newLimit);
        emit SpecificRiskLimitChanged(_token, tokenLimit, _newLimit);
    }

    /**
    Owner is ONLY allowed to immediately increase the default spending limit, if
    no votes are required from guardians.
     */
    function increaseDefaultRiskLimit(
        uint256 _newLimit
    ) public onlyOwner_ onlyIfNoApprovalsNeeded {
        require(_newLimit > defaultRiskLimit, "Risk limit not increased");
        uint256 oldLimit = defaultRiskLimit;
        _setDefaultRiskLimit(_newLimit);
        emit DefaultRiskLimitChanged(oldLimit, _newLimit);
    }

    /**
    Owner is ONLY allowed to immediately decrease the time window for spend measurement, if
    no votes are required from guardians.
     */
    function decreaseRiskLimitTimeWindow(
        uint256 _newTimeWindow
    ) public onlyOwner_ onlyIfNoApprovalsNeeded {
        require(
            _newTimeWindow < riskLimitTimeWindow,
            "Time window not decreased"
        );
        uint256 oldTimeWindow = riskLimitTimeWindow;
        _setRiskLimitTimeWindow(_newTimeWindow);
        emit RiskLimitTimeWindowChanged(oldTimeWindow, _newTimeWindow);
    }

    function voteForSpecificRiskLimitIncrease(
        address _token,
        uint256 _newLimit
    ) public onlyGuardian_ {
        require(
            _newLimit > limitsPerToken[_token].limit,
            "Specific risk limit not increased"
        );
        processVote(votesForSpecificRiskLimit[_token], _newLimit, msg.sender);
        emit VoteForNewSpecificRiskLimit(msg.sender, _token, _newLimit);

        if (votesForSpecificRiskLimit[_token].count == numVotesRequired) {
            uint256 oldLimit = limitForToken(_token);
            _setSpecificRiskLimit(_token, _newLimit);
            resetVote(votesForSpecificRiskLimit[_token]);
            emit SpecificRiskLimitChanged(_token, oldLimit, _newLimit);
        }
    }

    function voteForDefaultRiskLimitIncrease(
        uint256 _newLimit
    ) public onlyGuardian_ {
        require(
            _newLimit > defaultRiskLimit,
            "Default risk limit not increased"
        );
        processVote(votesForDefaultRiskLimit, _newLimit, msg.sender);
        emit VoteForNewDefaultRiskLimit(msg.sender, _newLimit);

        if (votesForDefaultRiskLimit.count == numVotesRequired) {
            uint256 oldLimit = defaultRiskLimit;
            _setDefaultRiskLimit(_newLimit);
            resetVote(votesForDefaultRiskLimit);
            emit DefaultRiskLimitChanged(oldLimit, _newLimit);
        }
    }

    function voteForRiskLimitTimeWindowDecrease(
        uint256 _newTimeWindow
    ) public onlyGuardian_ {
        require(
            _newTimeWindow < riskLimitTimeWindow,
            "Time window not decreased"
        );
        processVote(votesForRiskLimitTimeWindow, _newTimeWindow, msg.sender);
        emit VoteForNewRiskLimitTimeWindow(msg.sender, _newTimeWindow);

        if (votesForRiskLimitTimeWindow.count == numVotesRequired) {
            uint256 oldTimeWindow = riskLimitTimeWindow;
            _setRiskLimitTimeWindow(_newTimeWindow);
            resetVote(votesForRiskLimitTimeWindow);
            emit RiskLimitTimeWindowChanged(oldTimeWindow, _newTimeWindow);
        }
    }
}
