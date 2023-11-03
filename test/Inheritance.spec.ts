import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Inheritance, Inheritance__factory } from '../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { parseUnits } from 'ethers/lib/utils';

const ADDRESS_ZERO: string = '0x0000000000000000000000000000000000000000';

describe('Masterchef', function () {
  let Inheritance: Inheritance__factory;
  let inheritance: Inheritance;

  let owner: SignerWithAddress;
  let heir0: SignerWithAddress;
  let heir1: SignerWithAddress;

  const v100 = parseUnits('100', 18);
  const v10 = parseUnits('10', 18);
  const v5 = parseUnits('5', 18);

  beforeEach(async () => {
    [owner, heir0, heir1] = await ethers.getSigners();

    Inheritance = (await ethers.getContractFactory('Inheritance', owner)) as Inheritance__factory;
    inheritance = await Inheritance.connect(owner).deploy(owner.address, heir0.address);
    await inheritance.deployed();

    await owner.sendTransaction({
      to: inheritance.address,
      value: v100,
    });
  });

  describe('constructor', () => {
    it('should revert if the owner is zero address', async () => {
      await expect(Inheritance.connect(owner).deploy(ADDRESS_ZERO, heir0.address)).to.revertedWith(
        'Designate: Owner should be valid account'
      );
    });

    it('should revert if the heir is zero address', async () => {
      await expect(Inheritance.connect(owner).deploy(owner.address, ADDRESS_ZERO)).to.revertedWith(
        'Designate: Heir should be valid account'
      );
    });

    it('should revert if the owner and heir are identical', async () => {
      await expect(Inheritance.connect(owner).deploy(owner.address, owner.address)).to.revertedWith(
        'Inheritance: Owner should not be a heir'
      );
    });

    it('should check the initial values', async () => {
      expect(await inheritance.owner()).to.equal(owner.address);
      expect(await inheritance.heir()).to.equal(heir0.address);
      expect(await inheritance.lastWithdrawalTimestamp()).to.above(0);
    });

    it('should check the receiver function', async () => {
      expect(await ethers.provider.getBalance(inheritance.address)).to.equal(v100);
    });
  });

  describe('#withdraw', () => {
    it('should check the msg sender', async () => {
      await expect(inheritance.connect(heir0).withdraw(0)).to.revertedWith(
        'Access: Only the owner can call this function'
      );
    });

    it('should check the timestamp', async () => {
      await ethers.provider.send('evm_increaseTime', [3600 * 24 * 30]);
      await ethers.provider.send('evm_mine', []);

      await expect(inheritance.withdraw(0)).to.revertedWith(
        'Withdraw: Owner cannot withdraw after 1 month'
      );
    });

    it('should check the input amount', async () => {
      await expect(inheritance.withdraw(v100.mul(2))).to.revertedWith(
        'Withdraw: Insufficient balance'
      );
    });

    it('should check the zero withdrawal', async () => {
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;
      const nextTimestamp = timestampBefore + 100;
      await ethers.provider.send('evm_setNextBlockTimestamp', [nextTimestamp]);

      await expect(inheritance.withdraw(0))
        .to.emit(inheritance, 'Withdrawal')
        .withArgs(owner.address, 0, nextTimestamp);

      await expect(nextTimestamp).to.equal(await inheritance.lastWithdrawalTimestamp());
    });

    it('should check the non-zero withdrawal', async () => {
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;
      const nextTimestamp = timestampBefore + 100;
      await ethers.provider.send('evm_setNextBlockTimestamp', [nextTimestamp]);

      const currentBalance = await ethers.provider.getBalance(owner.address);
      await expect(inheritance.withdraw(v10, { gasPrice: 0 }))
        .to.emit(inheritance, 'Withdrawal')
        .withArgs(owner.address, v10, nextTimestamp);

      await expect(nextTimestamp).to.equal(await inheritance.lastWithdrawalTimestamp());
      expect(await ethers.provider.getBalance(inheritance.address)).to.equal(v100.sub(v10));
      expect(await ethers.provider.getBalance(owner.address)).to.equal(currentBalance.add(v10));
    });
  });

  describe('#designateNewHeir', () => {
    it('should check the msg sender', async () => {
      await expect(inheritance.connect(heir1).designateNewHeir(heir1.address)).to.revertedWith(
        'Access: Only the heir can call this function'
      );
    });

    it('Should check the timestamp', async () => {
      await expect(inheritance.connect(heir0).designateNewHeir(heir1.address)).to.revertedWith(
        'Designate: Heir cannot designate before 1 month'
      );
    });

    it('Should check the new heir', async () => {
      await ethers.provider.send('evm_increaseTime', [3600 * 24 * 30]);
      await ethers.provider.send('evm_mine', []);

      await expect(inheritance.connect(heir0).designateNewHeir(ADDRESS_ZERO)).to.revertedWith(
        'Designate: Heir should be valid account'
      );

      await expect(inheritance.connect(heir0).designateNewHeir(heir0.address)).to.revertedWith(
        'Designate: New heir should not be current heir'
      );
    });

    it('Should check the valid designate', async () => {
      await ethers.provider.send('evm_increaseTime', [3600 * 24 * 30]);
      await ethers.provider.send('evm_mine', []);

      await expect(inheritance.connect(heir0).designateNewHeir(heir1.address))
        .to.emit(inheritance, 'Designated')
        .withArgs(owner.address, heir0.address, heir1.address);

      expect(await inheritance.owner()).to.equal(heir0.address);
      expect(await inheritance.heir()).to.equal(heir1.address);
    });
  });
});
