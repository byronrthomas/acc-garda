// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

struct Allowance {
    uint256 amount;
    uint256 validFromTimestamp;
    uint256 remaining;
    uint256 id;
}

struct AllowanceState {
    Allowance[] activeAllowances;
    Allowance[] cancelledAllowances;
    Allowance[] usedAllowances;
    uint256 prevId;
}

library Allowances {
    function addAllowance(
        AllowanceState storage state,
        uint256 amount,
        uint256 validFromTimestamp
    ) internal returns (uint256) {
        // Ensuring ID starts at 1 means than allowance.id will always be > 0
        // for any non-deleted allowances
        uint256 id = ++state.prevId;
        state.activeAllowances.push(
            Allowance(amount, validFromTimestamp, amount, id)
        );
        return id;
    }

    function removeArrayItem(
        Allowance[] storage array,
        uint256 index
    ) internal {
        if (array[index].id != 0) {
            delete array[index];
        }
        // Nothing to do if the item is already deleted (ID == 0)
    }

    function findAllowanceById(
        Allowance[] storage allowances,
        uint256 id
    ) internal view returns (Allowance storage) {
        for (uint256 i = 0; i < allowances.length; i++) {
            if (allowances[i].id == id) {
                return allowances[i];
            }
        }
        revert("Allowance not found by ID");
    }

    function cancelAllowance(
        AllowanceState storage state,
        uint256 id
    ) internal {
        Allowance[] storage activeAllowances = state.activeAllowances;
        for (uint256 i = 0; i < activeAllowances.length; i++) {
            if (activeAllowances[i].id == id) {
                state.cancelledAllowances.push(activeAllowances[i]);
                removeArrayItem(activeAllowances, i);
                return;
            }
        }
        revert("Allowance not found by ID - possibly not active or bad ID");
    }

    function allowanceAvailable(
        AllowanceState storage state
    ) internal view returns (uint256) {
        uint256 available = 0;
        Allowance[] storage activeAllowances = state.activeAllowances;
        for (uint256 i = 0; i < activeAllowances.length; i++) {
            if (block.timestamp >= activeAllowances[i].validFromTimestamp) {
                available += activeAllowances[i].remaining;
            }
        }
        return available;
    }

    function spendFromAllowances(
        AllowanceState storage state,
        uint256 amount
    ) internal {
        Allowance[] storage activeAllowances = state.activeAllowances;
        for (uint256 i = 0; i < activeAllowances.length; i++) {
            if (block.timestamp >= activeAllowances[i].validFromTimestamp) {
                if (activeAllowances[i].remaining >= amount) {
                    activeAllowances[i].remaining -= amount;
                    if (activeAllowances[i].remaining == 0) {
                        state.usedAllowances.push(activeAllowances[i]);
                        removeArrayItem(activeAllowances, i);
                    }
                    return;
                } else if (activeAllowances[i].remaining > 0) {
                    amount -= activeAllowances[i].remaining;
                    activeAllowances[i].remaining = 0;
                    state.usedAllowances.push(activeAllowances[i]);
                    removeArrayItem(activeAllowances, i);
                }
            }
        }
        require(amount == 0, "Insufficient allowance available");
    }
}
