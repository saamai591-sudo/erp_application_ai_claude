CREATE     PROC [REQ].[spPurchaseRequestItemInsert]
    @PurchaseRequestID INT ,
    @PurchaseRequestItemIndex INT ,
    @StuffRequestItemID INT ,
    @StuffID INT ,
    @MainQuantity DECIMAL(30, 4) ,
    @SubQuantity DECIMAL(30, 4) ,
    @Description NVARCHAR(256) ,
    @Description2 NVARCHAR(256) ,
    @AcceptRequestMainMeasureQuantity DECIMAL(30, 4) ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @AcceptRequestSubMeasureQuantity DECIMAL(30, 4),
	@OrderItemID INT,
	@JustificationItemID INT,
	@QuotationItemID INT,
	@SaleContractItemID INT,
	@ServiceRequestItemID INT
--WITH ENCRYPTION
AS
BEGIN
    SET NOCOUNT ON; 
		
    INSERT  INTO [REQ].[PurchaseRequestItem]
            ( [PurchaseRequestID] ,
                [PurchaseRequestItemIndex] ,
                [StuffRequestItemID] ,
                [StuffID] ,
                [MainQuantity] ,
                [SubQuantity] ,
                [Description] ,
                [Description2] ,
                [AcceptRequestMainMeasureQuantity] ,
                [Creator] ,
                [CreationDate] ,
                [LastEditor] ,
                [LastEditionDate] ,
                [Version],
				[AcceptRequestSubMeasureQuantity],
				[OrderItemID],
				[JustificationItemID],
				[QuotationItemID],
				[SaleContractItemID],
                ServiceRequestItemID
            )
            SELECT  @PurchaseRequestID ,
                    @PurchaseRequestItemIndex ,
                    @StuffRequestItemID ,
                    @StuffID ,
                    @MainQuantity ,
                    @SubQuantity ,
                    @Description ,
                    @Description2 ,
                    @AcceptRequestMainMeasureQuantity ,
                    @Creator ,
                    @CreationDate ,
                    @LastEditor ,
                    @LastEditionDate ,
                    0,
					@AcceptRequestSubMeasureQuantity,
					@OrderItemID,
					@JustificationItemID,
					@QuotationItemID,
					@SaleContractItemID,
                    @ServiceRequestItemID;
	
	-- Begin Return Select <- do not remove
    SELECT  [PurchaseRequestItemID] ,
            [Version]
    FROM    [REQ].[PurchaseRequestItem]
    WHERE   [PurchaseRequestItemID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
END
