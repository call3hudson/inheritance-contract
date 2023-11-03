// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Inheritance {
  // Storage for owner and heir
  address public owner;
  address public heir;

  // Expose withdrawal timestamp for log
  uint256 public lastWithdrawalTimestamp;

  // Storage for non-reentrancy
  uint256 private constant NOT_ENTERED = 1;
  uint256 private constant ENTERED = 2;
  uint256 private _status;

  // Event for tracking withdrawal and inheritance
  event Withdrawal(address claimer, uint256 amount, uint256 timestamp);
  event Designated(address owner, address heir, address newHeir);

  // Fallback function to receive ETH
  receive() external payable {}

  constructor(address owner_, address heir_) {
    // Check address validity for owner and heir
    if (owner_ == address(0)) revert('Designate: Owner should be valid account');
    if (heir_ == address(0)) revert('Designate: Heir should be valid account');

    // Owner should not be heir, otherwise revert
    if (owner_ == heir_) revert('Inheritance: Owner should not be a heir');

    owner = owner_;
    heir = heir_;

    // Set initial timestamp
    lastWithdrawalTimestamp = block.timestamp;

    // Set initial reentrancy state
    _status = NOT_ENTERED;
  }

  /**
   * @notice  Modifier for reentrancy.
   * @dev     Store the reentrancy state inside the storage.
   */
  modifier nonReentrant() {
    _nonReentrantBefore();
    _;
    _nonReentrantAfter();
  }

  /**
   * @notice  Modifier for checking owner.
   * @dev     Check the msg.sender equal to owner.
   */
  modifier onlyOwner() {
    if (msg.sender != owner) revert('Access: Only the owner can call this function');
    _;
  }

  /**
   * @notice  Modifier for checking heir.
   * @dev     Check the msg.sender equal to heir.
   */
  modifier onlyHeir() {
    if (msg.sender != heir) revert('Access: Only the heir can call this function');
    _;
  }

  /**
   * @notice  External function for withdrawing locked eth.
   * @dev     Send ether to owner.
   * @param   amount_  Amount to be sent.
   */
  function withdraw(uint256 amount_) external nonReentrant onlyOwner {
    // If the withdraw took after 1 month from the last withdrawal, should revert tx
    if (block.timestamp > lastWithdrawalTimestamp + 30 days)
      revert('Withdraw: Owner cannot withdraw after 1 month');

    // If the withdrawal amount is more than the current balance, should revert tx
    if (amount_ > address(this).balance) revert('Withdraw: Insufficient balance');

    // If the withdrawal is for sending eth, transfer eth to owner
    if (amount_ > 0) {
      (bool success, ) = (msg.sender).call{ value: amount_ }('');
      if (!success) revert('Withdraw: Transfer failed');
    }

    // Update timestamp for further withdrawal
    lastWithdrawalTimestamp = block.timestamp;

    emit Withdrawal(owner, amount_, lastWithdrawalTimestamp);
  }

  /**
   * @notice  If the owner's recent activity is more than 1 month before, heir could be able to take ownership.
   * @dev     Update owner and heir.
   * @param   newHeir_  New heir as owner changes.
   */
  function designateNewHeir(address newHeir_) external onlyHeir {
    // If the designation held in a month from the last withdrawal, should revert tx
    if (block.timestamp <= lastWithdrawalTimestamp + 30 days)
      revert('Designate: Heir cannot designate before 1 month');

    // Check validity of new heir
    if (heir == newHeir_) revert('Designate: New heir should not be current heir');
    if (newHeir_ == address(0)) revert('Designate: Heir should be valid account');

    // Store the former owner for log
    address formerOwner = owner;

    // Update storage data
    owner = heir;
    heir = newHeir_;

    // Reset timestamp for new owner
    lastWithdrawalTimestamp = block.timestamp;

    emit Designated(formerOwner, owner, heir);
  }

  /**
   * @dev     Store the status as ENTERED.
   */
  function _nonReentrantBefore() private {
    // On the first call to nonReentrant, _status will be NOT_ENTERED
    if (_status == ENTERED) {
      revert('Reentrancy: Reentrancy detected');
    }

    // Any calls to nonReentrant after this point will fail
    _status = ENTERED;
  }

  /**
   * @dev     Store the status as NOT_ENTERED.
   */
  function _nonReentrantAfter() private {
    // By storing the original value once again, a refund is triggered
    _status = NOT_ENTERED;
  }
}
