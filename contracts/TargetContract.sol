// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4;

import "./MyContracts.sol";
import "hardhat/console.sol";

contract TargetContract {
    Comptroller public comptroller;
    CEth public cEth;

    constructor(address compAddr, address cEthAddr) {
        cEth = CEth(cEthAddr);
        comptroller = Comptroller(compAddr);
    }

    function transferTokens(
    IErc20 token,
    uint256 amount,
    address to,
    address recipient
  ) external {
    // Transfer tokens from user to PRBProxy.
    token.transferFrom(msg.sender, to, amount);

    // Transfer tokens from PRBProxy to specific recipient.
    token.transfer(recipient, amount);
  }

  function supplyERC20Collateral(
        address _cTokenAddress,
        address _underlyingAddress,
        uint256 _underlyingToSupplyAsCollateral
    ) public returns (bool) {
        CErc20 cToken = CErc20(_cTokenAddress);
        IErc20 underlying = IErc20(_underlyingAddress);

        // Approve transfer of underlying
        underlying.approve(_cTokenAddress, _underlyingToSupplyAsCollateral);

        // Supply underlying as collateral, get cToken in return
        uint256 error = cToken.mint(_underlyingToSupplyAsCollateral);
        require(error == 0, "CErc20.mint Error");

        // Enter the market so you can borrow another type of asset
        address[] memory cTokens = new address[](1);
        cTokens[0] = _cTokenAddress;
        uint256[] memory errors = comptroller.enterMarkets(cTokens);
        if (errors[0] != 0) {
            revert("Comptroller.enterMarkets failed.");
        }

        console.log("Minted ctoken %d", cToken.balanceOf(address(this)));

        // Get the collateral factor for our collateral
        (
          bool isListed,
          uint collateralFactorMantissa
        ) = comptroller.markets(_cTokenAddress);
        console.log("Collateral Factor %d", collateralFactorMantissa);

        return true;
    }
}