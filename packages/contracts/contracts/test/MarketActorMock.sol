// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {NabbMarket} from "../NabbMarket.sol";

/// @dev Test-only contract that acts as a seller or claimer and can be told to reject incoming
///      ETH or to re-enter the market when it receives ETH.
contract MarketActorMock {
    NabbMarket public immutable market;

    bool public acceptEth = true;
    bool public reenter;
    uint256 public reenterDropId;

    constructor(NabbMarket market_) {
        market = market_;
    }

    function configure(bool acceptEth_, bool reenter_, uint256 reenterDropId_) external {
        acceptEth = acceptEth_;
        reenter = reenter_;
        reenterDropId = reenterDropId_;
    }

    function createDrop(
        string calldata metadataURI,
        uint256 price,
        uint64 totalUnits,
        uint64 startTime,
        uint64 endTime,
        uint32 maxPerWallet
    ) external returns (uint256) {
        return market.createDrop(metadataURI, price, totalUnits, startTime, endTime, maxPerWallet);
    }

    function claim(uint256 dropId) external payable returns (uint64) {
        return market.claim{value: msg.value}(dropId);
    }

    receive() external payable {
        if (reenter) {
            market.claim{value: msg.value}(reenterDropId);
            return;
        }
        require(acceptEth, "MarketActorMock: rejects ETH");
    }
}
