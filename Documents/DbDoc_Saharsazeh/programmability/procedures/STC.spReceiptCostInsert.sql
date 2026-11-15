CREATE PROC [STC].[spReceiptCostInsert]
    @StockReceiptID INT ,
    @PurchaseInvoiceItemID INT ,
    @Price DECIMAL(30, 4) ,
    @ShareDividingBase TINYINT ,
    @StuffID INT ,
    @SlID INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @ProformaDlId BIGINT
	--WITH ENCRYPTION 
AS
BEGIN
    SET NOCOUNT ON; 
    SET XACT_ABORT ON;  
	
    INSERT  INTO [STC].[ReceiptCost]
            ( [StockReceiptID] ,
              [PurchaseInvoiceItemID] ,
              [Price] ,
              [ShareDividingBase] ,
              [Version] ,
              [Creator] ,
              [CreationDate] ,
              [LastEditor] ,
              [LastEditionDate] ,
              [StuffID] ,
              [SlID],
			  [ProformaDlId]
            )
            SELECT  @StockReceiptID ,
                    @PurchaseInvoiceItemID ,
                    @Price ,
                    @ShareDividingBase ,
                    0 ,
                    @Creator ,
                    @CreationDate ,
                    @LastEditor ,
                    @LastEditionDate ,
                    @StuffID ,
                    @SlID,
					@ProformaDlId;
	
	-- Begin Return Select <- do not remove
    SELECT  [ReceiptCostID] ,
            [Version] 
    FROM    [STC].[ReceiptCost]
    WHERE   [ReceiptCostID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
END
