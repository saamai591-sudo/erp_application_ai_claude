CREATE   PROC [REQ].[spReturnRequestItemInsert]
    @ReturnRequestID INT ,
    @ReturnRequestItemIndex TINYINT ,
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
    @StockReceiptItemID INT ,
    @TemporaryStockReceiptItemID INT ,
    @AcceptRequestSubMeasureQuantity DECIMAL(30, 4)
 --WITH ENCRYPTION   
AS
BEGIN
    SET NOCOUNT ON; 
	
    INSERT  INTO [REQ].[ReturnRequestItem]
            ( [ReturnRequestID] ,
              [ReturnRequestItemIndex] ,
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
              [Version] ,
              [StockReceiptItemID] ,
              [TemporaryStockReceiptItemID],
			  AcceptRequestSubMeasureQuantity
            )
            SELECT  @ReturnRequestID ,
                    @ReturnRequestItemIndex ,
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
                    0 ,
                    @StockReceiptItemID ,
                    @TemporaryStockReceiptItemID,
					@AcceptRequestSubMeasureQuantity;
	
	-- Begin Return Select <- do not remove
    SELECT  [ReturnRequestItemID] ,
            [Version] 
    FROM    [REQ].[ReturnRequestItem]
    WHERE   [ReturnRequestItemID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
END
