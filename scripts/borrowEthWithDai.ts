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
const cEthAbi = getAbi("MyContracts.sol/CEth.json")
const cErcAbi = getAbi("MyContracts.sol/CErc20.json")
const myContractAbi = getAbi("MyContracts.sol/MyContract.json")

let myContractAddress = ""
let myContract: Contract;
const ethWeiToBorrow = BigNumber.from("2000000000000000");

const largeHolderAddress = "0x5D38B4e4783E34e2301A2a36c39a03c45798C4dD"
const daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"
const usdcAddress = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
const comptrollerAddress = '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b';
const cEthAddress = '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5';
const cDaiAddress = '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643'; 
const assetName = 'DAI'; // for the log output lines
const underlyingDecimals = 18; // Number of decimals defined in this ERC20 token's contract

function getAbi(path: string) {
  return JSON.parse(fs.readFileSync(`${DEFAULT_ARTIFACTS_PATH}/${path}`)).abi
};

const logBalances = async (underlying: Contract, cToken: Contract, cEth: Contract, myContractAddress: string) => {
  const myWalletUnderlyingBalance = await underlying.callStatic.balanceOf(largeHolderAddress) / Math.pow(10, underlyingDecimals);
  const myContractEthBalance = (await provider.getBalance(myContractAddress)).toNumber() / 1e18;
  const myContractCEthBalance = await cEth.callStatic.balanceOf(myContractAddress) / 1e8;
  const myContractUnderlyingBalance = await underlying.callStatic.balanceOf(myContractAddress) / Math.pow(10, underlyingDecimals);
  const myContractCTokenBalance = await cToken.callStatic.balanceOf(myContractAddress) / 1e8;

  console.log(`My Wallet's   ${assetName} Balance:`, myWalletUnderlyingBalance);
  console.log(`MyContract's  ETH Balance:`, myContractEthBalance);
  console.log(`MyContract's cETH Balance:`, myContractCEthBalance);
  console.log(`MyContract's  ${assetName} Balance:`, myContractUnderlyingBalance);
  console.log(`MyContract's c${assetName} Balance:`, myContractCTokenBalance);
};

async function main() {
  // impersonate a large holder of DAI
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [largeHolderAddress],
  });

  // get the signer that we require for the token holder
  const largeHolderSigner = await ethers.getSigner(largeHolderAddress)

  // Send some ether to the holder so that they can transfer tokens
  // await hre.network.provider.send("hardhat_setBalance", [
  //   largeHolderAddress,
  //   "0x1000000000000000",
  // ]);

  if (myContractAddress == "" || (await provider.getCode(myContractAddress)) == '0x') {
    const MyContract = await ethers.getContractFactory("MyContract");
    myContract = await MyContract.deploy(comptrollerAddress, cEthAddress);
    myContract.deployed();
    console.log("Greeter deployed to:", myContract.address);
    myContractAddress = myContract.address;
  } else {
    myContract = new ethers.Contract(myContractAddress, myContractAbi, largeHolderSigner)
  }

  const dai = new ethers.Contract(daiAddress, erc20Abi, largeHolderSigner);
  const cEth = new ethers.Contract(cEthAddress, cEthAbi, largeHolderSigner);
  const cDai = new ethers.Contract(cDaiAddress, cErcAbi, largeHolderSigner);
  await logBalances(dai, cDai, cEth, myContractAddress);

  const underlyingAsCollateral = 25;
  const mantissa = (underlyingAsCollateral * Math.pow(10, underlyingDecimals)).toString();
  console.log(`\nSending ${underlyingAsCollateral} ${assetName} to MyContract so it can provide collateral...\n`);

  // Send underlying to MyContract before attempting the supply
  const transferTx = await dai.transfer(myContractAddress, mantissa);
  await transferTx.wait(1);
  await logBalances(dai, cDai, cEth, myContractAddress);

  // mint cToken and enter market
  console.log(`\nCalling supplyErc20 with ${underlyingAsCollateral} ${assetName} as collateral...\n`);
  await myContract.supplyERC20Collateral(cDaiAddress, daiAddress, mantissa);
  await logBalances(dai, cDai, cEth, myContractAddress);

  console.log(`\nCalling MyContract.borrowEthExample with ${underlyingAsCollateral} ${assetName} as collateral...\n`);

  const borrowTx = await myContract.borrowEth(ethWeiToBorrow);
  await borrowTx.wait(1);

  await logBalances(dai, cDai, cEth, myContractAddress);

  console.log(`\nNow repaying the borrow...\n`);
  const repayTx = await myContract.repayEthBorrow(
    cEthAddress,
    ethWeiToBorrow,
    300000 // gas for the "cEth.repayBorrow" function
  );
  await repayTx.wait(1);

  await logBalances(dai, cDai, cEth, myContractAddress);

}

// function that prints 3.

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
