import { PRBProxyRegistry, getPRBProxyRegistry, PRBProxyFactory, getPRBProxyFactory, computeProxyAddress, PRBProxy, getPRBProxy } from "@prb/proxy";
import { BigNumber, Contract } from "ethers";
import hre from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
const fs = require("fs");
const ethers = hre.ethers;
const provider = hre.waffle.provider
const DEFAULT_ARTIFACTS_PATH = "./artifacts/contracts";

const largeHolderAddress = "0x5D38B4e4783E34e2301A2a36c39a03c45798C4dD";

// async function that deploys prb proxy.
async function deployPrbProxy(signer: SignerWithAddress): Promise<PRBProxy> {
  const registry: PRBProxyRegistry = getPRBProxyRegistry(signer);
  const tx = await registry.connect(signer).deploy();
  await tx.wait(1);
  const prbProxyAddress = await registry.getCurrentProxy(signer.address);
  console.log(`PRBProxy deployed to: ${prbProxyAddress} at tx hash: ${tx.hash}`);
  const prbProxy: PRBProxy = getPRBProxy(prbProxyAddress, signer);
  return prbProxy;
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

  // TODO: Deploy target contract and interact.
  




  
  
  console.log(proxyAddress, address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
