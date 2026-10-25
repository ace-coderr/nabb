// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title NabbMarket
/// @notice A single registry of fixed-price "drops": limited runs of identical units that anyone
///         can claim. Every claim pays the seller and refunds any overpayment inside the same
///         transaction, so the contract never holds ETH between transactions.
contract NabbMarket is ReentrancyGuard {
    /// @dev Field order is chosen for storage packing: seller, maxPerWallet and active share one
    ///      slot, and the four uint64 counters/timestamps share another.
    struct Drop {
        address seller;
        uint32 maxPerWallet;
        bool active;
        string metadataURI;
        uint256 price;
        uint64 totalUnits;
        uint64 claimedUnits;
        uint64 startTime;
        uint64 endTime;
    }

    /// @notice Id assigned to the next drop. Ids start at 1 so that 0 never refers to a drop.
    uint256 public nextDropId = 1;

    mapping(uint256 => Drop) internal drops;

    /// @notice Units claimed so far by a wallet in a drop.
    mapping(uint256 => mapping(address => uint256)) public claimedByWallet;

    event DropCreated(
        uint256 indexed dropId,
        address indexed seller,
        uint256 price,
        uint64 totalUnits,
        uint64 startTime,
        uint64 endTime
    );

    /// @param unitIndex Zero-based position of the claimed unit within the drop.
    event Claimed(
        uint256 indexed dropId,
        address indexed claimer,
        uint64 unitIndex,
        uint256 pricePaid,
        uint64 timestamp
    );

    event DropClosed(uint256 indexed dropId);

    error InvalidUnits();
    error InvalidMaxPerWallet();
    error InvalidWindow();
    error DropNotFound(uint256 dropId);
    error DropInactive(uint256 dropId);
    error SoldOut(uint256 dropId);
    error NotStarted(uint256 dropId);
    error Ended(uint256 dropId);
    error WalletLimitReached(uint256 dropId);
    error InsufficientPayment(uint256 required, uint256 sent);
    error SellerPaymentFailed(uint256 dropId);
    error RefundFailed(uint256 dropId);
    error NotSeller(uint256 dropId);

    /// @notice Open a new drop. The caller becomes the seller and receives every payment.
    /// @param metadataURI Off-chain description of the unit (name, image, ...).
    /// @param price Fixed price per unit in wei. Zero makes a free drop.
    /// @param totalUnits Number of units available. Must be non-zero.
    /// @param startTime First timestamp (inclusive) at which units can be claimed.
    /// @param endTime Last timestamp (inclusive) at which units can be claimed.
    /// @param maxPerWallet Maximum units a single address may claim. Must be non-zero.
    function createDrop(
        string calldata metadataURI,
        uint256 price,
        uint64 totalUnits,
        uint64 startTime,
        uint64 endTime,
        uint32 maxPerWallet
    ) external returns (uint256 dropId) {
        if (totalUnits == 0) revert InvalidUnits();
        if (maxPerWallet == 0) revert InvalidMaxPerWallet();
        if (endTime <= startTime || endTime <= block.timestamp) revert InvalidWindow();

        dropId = nextDropId++;
        drops[dropId] = Drop({
            seller: msg.sender,
            maxPerWallet: maxPerWallet,
            active: true,
            metadataURI: metadataURI,
            price: price,
            totalUnits: totalUnits,
            claimedUnits: 0,
            startTime: startTime,
            endTime: endTime
        });

        emit DropCreated(dropId, msg.sender, price, totalUnits, startTime, endTime);
    }

    /// @notice Claim one unit of a drop. Exactly `price` goes to the seller and any excess
    ///         `msg.value` is returned to the caller; the whole claim reverts if either transfer
    ///         fails.
    /// @return unitIndex Zero-based position of the claimed unit.
    function claim(uint256 dropId) external payable nonReentrant returns (uint64 unitIndex) {
        Drop storage drop = drops[dropId];
        address seller = drop.seller;
        if (seller == address(0)) revert DropNotFound(dropId);
        if (drop.claimedUnits >= drop.totalUnits) revert SoldOut(dropId);
        if (!drop.active) revert DropInactive(dropId);
        if (block.timestamp < drop.startTime) revert NotStarted(dropId);
        if (block.timestamp > drop.endTime) revert Ended(dropId);

        uint256 walletClaims = claimedByWallet[dropId][msg.sender];
        if (walletClaims >= drop.maxPerWallet) revert WalletLimitReached(dropId);

        uint256 price = drop.price;
        if (msg.value < price) revert InsufficientPayment(price, msg.value);

        // Effects
        unitIndex = drop.claimedUnits;
        uint64 claimed = unitIndex + 1;
        drop.claimedUnits = claimed;
        claimedByWallet[dropId][msg.sender] = walletClaims + 1;
        if (claimed == drop.totalUnits) drop.active = false;

        emit Claimed(dropId, msg.sender, unitIndex, price, uint64(block.timestamp));

        // Interactions
        if (price > 0) {
            (bool paid, ) = seller.call{value: price}("");
            if (!paid) revert SellerPaymentFailed(dropId);
        }

        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool refunded, ) = msg.sender.call{value: excess}("");
            if (!refunded) revert RefundFailed(dropId);
        }
    }

    /// @notice Stop a drop early. Only the seller can close it; claimed units are unaffected.
    function closeDrop(uint256 dropId) external {
        Drop storage drop = drops[dropId];
        if (drop.seller == address(0)) revert DropNotFound(dropId);
        if (drop.seller != msg.sender) revert NotSeller(dropId);
        if (!drop.active) revert DropInactive(dropId);

        drop.active = false;
        emit DropClosed(dropId);
    }

    /// @notice Full drop record. Reverts for unknown ids.
    function getDrop(uint256 dropId) external view returns (Drop memory) {
        Drop memory drop = drops[dropId];
        if (drop.seller == address(0)) revert DropNotFound(dropId);
        return drop;
    }

    /// @notice Units still available. Zero for unknown ids.
    function remaining(uint256 dropId) external view returns (uint64) {
        Drop storage drop = drops[dropId];
        return drop.totalUnits - drop.claimedUnits;
    }

    /// @notice Whether a claim submitted now (by a wallet under its limit) would be accepted.
    ///         False for unknown ids.
    function isLive(uint256 dropId) external view returns (bool) {
        Drop storage drop = drops[dropId];
        return
            drop.active &&
            drop.claimedUnits < drop.totalUnits &&
            block.timestamp >= drop.startTime &&
            block.timestamp <= drop.endTime;
    }
}
