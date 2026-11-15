

CREATE   PROC [PRM].[spProductionOrderItemUpdate]
    @ProductionOrderItemID int,  	
	@ProductionOrderID int,
    @RowIndex smallint,
    @BaseType tinyint,
	@QuotationItemID int,
	@SaleContractItemID int,
	@StuffID int,
	@MainQuantity decimal(30, 4),
	@SubQuantity decimal(30, 4),
	@DeliveryDate datetime,
	@Description nvarchar(512),
	@Description2 nvarchar(512),
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
SET NOCOUNT ON

	if @Version=(Select [Version] from PRM.ProductionOrderItem
	where ProductionOrderItemID = @ProductionOrderItemID)
	begin	

		set @Version = @Version + 1 

		UPDATE PRM.ProductionOrderItem
		SET    ProductionOrderID = @ProductionOrderID,
		       RowIndex = @RowIndex, 
			   BaseType = @BaseType, 
			   QuotationItemID = @QuotationItemID,
			   SaleContractItemID = @SaleContractItemID,
			   StuffID = @StuffID,
			   MainQuantity = @MainQuantity,
			   SubQuantity = @SubQuantity,
			   DeliveryDate = @DeliveryDate,
			   Description = @Description,
			   Description2 = @Description2,
			   LastEditor = @LastEditor, 
			   LastEditionDate = @LastEditionDate, 
			   [Version] = @Version
		WHERE  ProductionOrderItemID = @ProductionOrderItemID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   PRM.ProductionOrderItem
		WHERE  ProductionOrderItemID = @ProductionOrderItemID
		-- End Return Select <- do not remove

	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
