CREATE   PROC [REQ].[spReturnRequestItemUpdate]
    @ReturnRequestItemID INT ,
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
    @Version INT ,
    @StockReceiptItemID INT ,
    @TemporaryStockReceiptItemID INT,
	@AcceptRequestSubMeasureQuantity DECIMAL (30,4)
--WITH ENCRYPTION 
AS
BEGIN
    SET NOCOUNT ON; 
	
        DECLARE @PreMainQuantity DECIMAL(30, 4) ,
            @PreSubQuantity DECIMAL(30, 4) ,
            @PreVersion INT ,
            @Message NVARCHAR(MAX);
	
        SELECT  @PreVersion = [Version] ,
                @PreMainQuantity = MainQuantity ,
                @PreSubQuantity = SubQuantity
        FROM    [REQ].[ReturnRequestItem]
        WHERE   [ReturnRequestItemID] = @ReturnRequestItemID;
	
			
        IF @Version <> @PreVersion
            RAISERROR('Version mismatch...', 16 , 10);

        IF ( @MainQuantity <> @PreMainQuantity )
            BEGIN
		
                IF ( SELECT REQ.ReturnRequestItemHasFlow(@ReturnRequestItemID)
                   ) = 1
                    BEGIN
                        SELECT  @Message =  'MainQuantityIsNotEditable'
                        RAISERROR(@Message,16,12);
                    END;
		
            END;
	
        IF ISNULL(@SubQuantity, 0) <> ISNULL(@PreSubQuantity, 0)
            BEGIN
                IF ( SELECT REQ.ReturnRequestItemHasFlow(@ReturnRequestItemID)
                   ) = 1
                    BEGIN
                        SELECT  @Message = 'SubQuantityIsNotEditable'
                        RAISERROR(@Message,16,12);
                    END;
            END;
	
        UPDATE  [REQ].[ReturnRequestItem]
        SET     [ReturnRequestItemIndex] = @ReturnRequestItemIndex ,
                [StuffID] = @StuffID ,
                [Description] = @Description ,
                [Description2] = @Description2 ,
                [AcceptRequestMainMeasureQuantity] = @AcceptRequestMainMeasureQuantity ,
                [LastEditor] = @LastEditor ,
                [LastEditionDate] = @LastEditionDate ,
                [Version] = @Version + 1 ,
                StockReceiptItemID = @StockReceiptItemID ,
                TemporaryStockReceiptItemID = @TemporaryStockReceiptItemID,
				AcceptRequestSubMeasureQuantity = @AcceptRequestSubMeasureQuantity
        WHERE   [ReturnRequestItemID] = @ReturnRequestItemID;
	
		-- Begin Return Select <- do not remove
        SELECT   [Version] 
        FROM    [REQ].[ReturnRequestItem]
        WHERE   [ReturnRequestItemID] = @ReturnRequestItemID;	
		-- End Return Select <- do not remove
END
