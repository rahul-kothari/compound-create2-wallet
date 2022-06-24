//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.6;
import "hardhat/console.sol";
import "./DummyCompoundActions.sol";

contract DummyUserWallet {

    DummyCompoundAction public compoundActions;
    event ProxyRes(bool success, bytes returndata); 

    constructor(address payable _compoundActions) {
        compoundActions = DummyCompoundAction(_compoundActions);
    }

    function doSomething(
        address _cTokenAddress,
        address _underlyingAddress,
        uint256 _underlyingToSupplyAsCollateral
    ) public {
        IErc20 underlying = IErc20(_underlyingAddress);
        // Approve transfer of underlying
        underlying.approve(_cTokenAddress, _underlyingToSupplyAsCollateral);

        bool success = compoundActions.supplyERC20Collateral(_cTokenAddress, _underlyingAddress, _underlyingToSupplyAsCollateral);
        console.log("final res from userwallet: %s", success);
        
        // delegate call to supplyErc20Collateral
        // (bool success, bytes memory returndata) = address(compoundActions).delegatecall(
        //     abi.encodeWithSelector(
        //         compoundActions.supplyERC20Collateral.selector, 
        //         _cTokenAddress,
        //         _underlyingAddress,
        //         _underlyingToSupplyAsCollateral
        //     ));
        // emit ProxyRes(success, returndata); 
    }
}