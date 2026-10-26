// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {NabbMarket} from "../NabbMarket.sol";

/// @dev Test-only seller that misbehaves when it is paid, to pin down what a hostile seller can
///      and cannot do to claimers of its own drop.
contract HostileSeller {
    enum Mode {
        Accept,
        BurnGas,
        ReturnBomb,
        CloseSelf
    }

    NabbMarket public immutable market;
    Mode public mode;
    uint256 public burn;
    uint256 public bombSize;
    uint256 public dropId;

    constructor(NabbMarket market_) {
        market = market_;
    }

    function configure(Mode mode_, uint256 burn_, uint256 bombSize_) external {
        mode = mode_;
        burn = burn_;
        bombSize = bombSize_;
    }

    function createDrop(
        string calldata metadataURI,
        uint256 price,
        uint64 totalUnits,
        uint64 startTime,
        uint64 endTime,
        uint32 maxPerWallet
    ) external returns (uint256 id) {
        id = market.createDrop(metadataURI, price, totalUnits, startTime, endTime, maxPerWallet);
        dropId = id;
    }

    receive() external payable {
        if (mode == Mode.BurnGas) {
            uint256 start = gasleft();
            while (start - gasleft() < burn) {}
        } else if (mode == Mode.ReturnBomb) {
            uint256 size = bombSize;
            assembly {
                return(0, size)
            }
        } else if (mode == Mode.CloseSelf) {
            market.closeDrop(dropId);
        }
    }
}

/// @dev Test-only: pushes ETH into a contract that has no payable entry point.
contract ForceSender {
    constructor() payable {}

    function force(address payable to) external {
        selfdestruct(to);
    }
}
