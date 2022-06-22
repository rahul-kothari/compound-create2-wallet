//SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

interface ICompoundActions {

    function supplyErc20Collateral(
        address _underlyingAddress, address _cTokenAddress, uint256 _underlyingAmount
    )  external returns (bool);

    function supplyEthAsCollateral(uint256 _underlyingAmount) external returns (bool);
    
    function borrowErc20(
        address _underlying, address _cTokenAddress, uint256 _amountToBorrow
    ) external returns (uint256);
    
    function borrowEth(uint256 _amountToBorrow) external returns (uint256);
    
    function repayEthBorrow(uint256 _amount, uint256 _gas) external ;
    
    function repayErc20Borrow(address _underlying, address _cTokenAddress, uint256 _amount) external;

    // TODO:
    // batchSupplyCollateral() - mint cTokens of all assets and enter into market together.

}