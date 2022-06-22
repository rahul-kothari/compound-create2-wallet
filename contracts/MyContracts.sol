//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.6;
import "hardhat/console.sol";

interface IErc20 {
    function approve(address, uint256) external returns (bool);

    function transfer(address, uint256) external returns (bool);

    function balanceOf(address) external view returns (uint256);
}


interface CErc20 {
    function mint(uint256) external returns (uint256);

    function borrow(uint256) external returns (uint256);

    function borrowRatePerBlock() external view returns (uint256);

    function borrowBalanceCurrent(address) external returns (uint256);

    function repayBorrow(uint256) external returns (uint256);

    function balanceOf(address) external view returns (uint256);
}


interface CEth {
    function mint() external payable;

    function borrow(uint256) external returns (uint256);

    function repayBorrow() external payable;

    function borrowBalanceCurrent(address) external returns (uint256);

    function balanceOf(address) external view returns (uint256);
}


interface Comptroller {
    function markets(address) external returns (bool, uint256);

    function enterMarkets(address[] calldata)
        external
        returns (uint256[] memory);

    function getAccountLiquidity(address)
        external
        view
        returns (uint256, uint256, uint256);
}


interface PriceFeed {
    function getUnderlyingPrice(address cToken) external view returns (uint);
}


contract MyContract {
    Comptroller public comptroller;
    CEth public cEth;

    constructor(address compAddr, address cEthAddr) {
        cEth = CEth(cEthAddr);
        comptroller = Comptroller(compAddr);
    }

    function repayErc20Borrow( address _erc20Address, address _cErc20Address, uint256 amount) public returns (bool) {
        IErc20 underlying = IErc20(_erc20Address);
        CErc20 cToken = CErc20(_cErc20Address);

        underlying.approve(_cErc20Address, amount);
        uint256 error = cToken.repayBorrow(amount);

        require(error == 0, "CErc20.repayBorrow Error");
        return true;
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


    function borrowEth(uint256 numWeiToBorrow) public returns (uint) {
        // Get my account's total liquidity value in Compound
        (uint256 err, uint256 liquidity, uint256 shortfall) = comptroller
            .getAccountLiquidity(address(this));
        require(err == 0, "Comptroller.getAccountLiquidity failed.");
        require(shortfall == 0, "account underwater");
        require(liquidity > 0, "account has no collateral");

        // Borrowing near the max amount will result
        // in your account being liquidated instantly
        console.log("Maximum ETH Borrow (borrow far less!) %d", liquidity);

        // // Get the amount of ETH added to your borrow each block
        // uint borrowRateMantissa = cEth.borrowRatePerBlock();
        // console.log('Current ETH Borrow Rate %d', borrowRateMantissa);

        // Borrow, then check the underlying balance for this contract's address
        err = cEth.borrow(numWeiToBorrow);
        require(err == 0, "Error borrowing cETH");

        uint256 borrows = cEth.borrowBalanceCurrent(address(this));
        console.log("Current ETH borrow amount %d", borrows);

        return borrows;
    }

    function repayEthBorrow(address _cEtherAddress, uint256 amount, uint256 gas)
        public
        returns (bool)
    {
        CEth cEth = CEth(_cEtherAddress);
        cEth.repayBorrow{ value: amount, gas: gas }();
        return true;
    }

    // Need this to receive ETH when `borrowEthExample` executes
    receive() external payable {}
}