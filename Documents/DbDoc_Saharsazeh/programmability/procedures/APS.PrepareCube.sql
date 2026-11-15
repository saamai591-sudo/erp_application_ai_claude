/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.5.444
 * Time: 10/2/2018 4:52:46 PM
 ************************************************************/

CREATE PROCEDURE [APS].[PrepareCube](@CubeName VARCHAR(512),@CurrentFinancialPeriod int)
AS
	IF @CubeName = 'SaleRelationCube'
	    EXEC [APS].[PrepareSaleItemData]
	
	
	
