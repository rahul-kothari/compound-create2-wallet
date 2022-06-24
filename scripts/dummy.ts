// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { BigNumber, Contract } from "ethers";
import hre from "hardhat";
const fs = require("fs");
const ethers = hre.ethers;
const provider = hre.waffle.provider
const DEFAULT_ARTIFACTS_PATH = "./artifacts/contracts";

const erc20Abi = getAbi("ERC20.sol/ERC20.json")
const cEthAbi = getAbi("DummyCompoundActions.sol/CEth.json")
const cErcAbi = getAbi("DummyCompoundActions.sol/CErc20.json")

let compActionsAddress = "";
let userWalletAddress = "";

const ethWeiToBorrow = BigNumber.from("2000000000000000");

const largeHolderAddress = "0x5D38B4e4783E34e2301A2a36c39a03c45798C4dD"
const daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const comptrollerAddress = '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b';
const cEthAddress = '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5';
const cDaiAddress = '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643'; 
const assetName = 'DAI'; // for the log output lines
const underlyingDecimals = 18; // Number of decimals defined in this ERC20 token's contract

function getAbi(path: string) {
  return JSON.parse(fs.readFileSync(`${DEFAULT_ARTIFACTS_PATH}/${path}`)).abi
};

const logBalances = async (underlying: Contract, cToken: Contract, cEth: Contract, myContractWalletAddress: string, compoundActionsContractAddress: string) => {
  const myWalletUnderlyingBalance = await underlying.callStatic.balanceOf(largeHolderAddress) / Math.pow(10, underlyingDecimals);
  const myContractWalletEthBalance = (await provider.getBalance(myContractWalletAddress)).toNumber() / 1e18;
  const myContractWalletCEthBalance = await cEth.callStatic.balanceOf(myContractWalletAddress) / 1e8;
  const myContractWalletUnderlyingBalance = await underlying.callStatic.balanceOf(myContractWalletAddress) / Math.pow(10, underlyingDecimals);
  const myContractWalletCTokenBalance = await cToken.callStatic.balanceOf(myContractWalletAddress) / 1e8;

  const compoundActionsContractEthBalance = (await provider.getBalance(compoundActionsContractAddress)).toNumber() / 1e18;
  const compoundActionsContractCEthBalance = await cEth.callStatic.balanceOf(compoundActionsContractAddress) / 1e8;
  const compoundActionsContractUnderlyingBalance = await underlying.callStatic.balanceOf(compoundActionsContractAddress) / Math.pow(10, underlyingDecimals);
  const compoundActionsContractCTokenBalance = await cToken.callStatic.balanceOf(compoundActionsContractAddress) / 1e8;

  console.log(`My Wallet's   ${assetName} Balance:`, myWalletUnderlyingBalance);
  console.log(`MyContractWallet's  ETH Balance:`, myContractWalletEthBalance);
  console.log(`MyContractWallet's cETH Balance:`, myContractWalletCEthBalance);
  console.log(`MyContractWallet's  ${assetName} Balance:`, myContractWalletUnderlyingBalance);
  console.log(`MyContractWallet's c${assetName} Balance:`, myContractWalletCTokenBalance);
  console.log(`CompoundAction contract's  ETH Balance:`, compoundActionsContractEthBalance);
  console.log(`CompoundAction contract's cETH Balance:`, compoundActionsContractCEthBalance);
  console.log(`CompoundAction contract's  ${assetName} Balance:`, compoundActionsContractUnderlyingBalance);
  console.log(`CompoundAction contract's c${assetName} Balance:`, compoundActionsContractCTokenBalance);
};

async function main() {
  // impersonate a large holder of DAI
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [largeHolderAddress],
  });

  // get the signer that we require for the token holder
  const largeHolderSigner = await ethers.getSigner(largeHolderAddress)

  // deploy dummy compound actions contract
  const compActions = await (await ethers.getContractFactory("DummyCompoundAction")).deploy(comptrollerAddress, cEthAddress);
  console.log("compActions deployed to:", compActions.address);
  compActionsAddress = compActions.address;

  // deploy user wallet contract
  const userWallet = await (await ethers.getContractFactory("DummyUserWallet")).deploy(compActionsAddress);
  console.log("userWallet deployed to:", userWallet.address);
  userWalletAddress = userWallet.address;
  
  const dai = new ethers.Contract(daiAddress, erc20Abi, largeHolderSigner);
  const cEth = new ethers.Contract(cEthAddress, cEthAbi, largeHolderSigner);
  const cDai = new ethers.Contract(cDaiAddress, cErcAbi, largeHolderSigner);
  await logBalances(dai, cDai, cEth, userWalletAddress, compActionsAddress);

  const underlyingAsCollateral = 25;
  const mantissa = (underlyingAsCollateral * Math.pow(10, underlyingDecimals)).toString();
  console.log(`\nSending ${underlyingAsCollateral} ${assetName} to MyContractWallet so it can provide collateral...\n`);

  // Send underlying to MyContract before attempting the supply
  const transferTx = await dai.transfer(userWalletAddress, mantissa);
  await transferTx.wait(1);
  await logBalances(dai, cDai, cEth, userWalletAddress, compActionsAddress);

  // mint cToken and enter market
  console.log(`\nCalling supplyErc20 with ${underlyingAsCollateral} ${assetName} as collateral...\n`);
  const tx = await userWallet.doSomething(cDaiAddress, daiAddress, mantissa);
  const receipt = await tx.wait(1);
  console.log(receipt.events);
  await logBalances(dai, cDai, cEth, userWalletAddress, compActionsAddress);

  // console.log(`\nCalling MyContract.borrowEthExample with ${underlyingAsCollateral} ${assetName} as collateral...\n`);

  // const borrowTx = await myContract.borrowEth(ethWeiToBorrow);
  // await borrowTx.wait(1);

  // await logBalances(dai, cDai, cEth, userWalletAddress, compActionsAddress);

  // console.log(`\nNow repaying the borrow...\n`);
  // const repayTx = await myContract.repayEthBorrow(
  //   cEthAddress,
  //   ethWeiToBorrow,
  //   300000 // gas for the "cEth.repayBorrow" function
  // );
  // await repayTx.wait(1);
  // await logBalances(dai, cDai, cEth, userWalletAddress, compActionsAddress);
}

// function that prints 3.

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
