import { PRBProxyRegistry, getPRBProxyRegistry, PRBProxyFactory, getPRBProxyFactory, computeProxyAddress, PRBProxy, getPRBProxy } from "@prb/proxy";
import { BigNumber, Contract } from "ethers";
import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseUnits } from "@ethersproject/units";
const fs = require("fs");
const ethers = hre.ethers;
const provider = hre.waffle.provider
const DEFAULT_ARTIFACTS_PATH = "./artifacts/contracts";

const erc20Abi = getAbi("ERC20.sol/ERC20.json")

const largeHolderAddress = "0x5D38B4e4783E34e2301A2a36c39a03c45798C4dD";
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

// async function that deploys prb proxy.
async function deployPrbProxy(signer: SignerWithAddress): Promise<PRBProxy> {
  const registry: PRBProxyRegistry = getPRBProxyRegistry(signer);
  const tx = await registry.connect(signer).deploy();
  await tx.wait(1);
  const prbProxyAddress = await registry.getCurrentProxy(signer.address);
  console.log(`PRBProxy deployed to: ${prbProxyAddress}`);
  const prbProxy: PRBProxy = getPRBProxy(prbProxyAddress, signer);
  return prbProxy;
}

// async function that deploys TargetContract.
async function deployTargetContract(signer: SignerWithAddress): Promise<Contract> {
  const TargetContract = await ethers.getContractFactory("TargetContract");
  const targetContract = await TargetContract.deploy(comptrollerAddress, cEthAddress);
  await targetContract.deployed();
  console.log("targetContract deployed to:", targetContract.address);
  return targetContract;
}

async function main() {
  // impersonate a large holder of DAI
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [largeHolderAddress],
  });
  // get the signer that we require for the token holder
  const largeHolderSigner = await ethers.getSigner(largeHolderAddress);
  // deploy prb proxy
  const prbProxy = await deployPrbProxy(largeHolderSigner);
  // deploy target contract
  const targetContract = await deployTargetContract(largeHolderSigner);
  // dai contract:
  const dai = new ethers.Contract(daiAddress, erc20Abi, largeHolderSigner);

  const underlyingAsCollateral = 25;
  const mantissa = (underlyingAsCollateral * Math.pow(10, underlyingDecimals)).toString();
  console.log(`\nSending ${underlyingAsCollateral} ${assetName} to Proxy Contract so it can provide collateral...\n`);
  // Send underlying to MyContract before attempting the supply
  const transferTx = await dai.transfer(prbProxy.address, mantissa);
  await transferTx.wait(1);

  // mint cToken and enter market
  console.log(`\nCalling supplyErc20 with ${underlyingAsCollateral} ${assetName} as collateral...\n`);
  const data = targetContract.interface.encodeFunctionData("supplyERC20Collateral", [cDaiAddress, daiAddress, mantissa]);
  const receipt = await prbProxy.connect(largeHolderSigner).execute(targetContract.address, data, {gasLimit: 100000});
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
