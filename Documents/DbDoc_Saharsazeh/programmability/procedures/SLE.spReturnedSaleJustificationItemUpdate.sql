CREATE     PROC [SLE].[spReturnedSaleJustificationItemUpdate]
    @ReturnedSaleJustificationItemID INT ,
    @ReturnedSaleJustificationID INT ,
    @RowIndex SMALLINT ,
    @StuffID INT ,
    @MainQuantity DECIMAL(30, 4) ,
    @SubQuantity DECIMAL(30, 4) ,
    @Description NVARCHAR(250) ,
    @Description2 NVARCHAR(250) ,
    @Version INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME,
	@InvoiceItemID INT,
	@Fee DECIMAL(30, 4),
	@Price DECIMAL(30, 4),
	@Discount DECIMAL(30, 4),
	@Tax DECIMAL(30, 4),
	@Duty DECIMAL(30, 4),
	@NetPrice DECIMAL(30, 4)
   -- WITH ENCRYPTION
AS
    SET NOCOUNT ON; 

        DECLARE @PreviousMainQuantity DECIMAL(30, 4) ,
            @PreviousSubQuantity DECIMAL(30, 4) ,
            @PreVersion INT ,
            @Message NVARCHAR(MAX);
	
        SELECT  @PreVersion = [Version] ,
                @PreviousMainQuantity = [MainQuantity] ,
                @PreviousSubQuantity = [SubQuantity]
        FROM    [SLE].[ReturnedSaleJustificationItem]
        WHERE   [ReturnedSaleJustificationItemID] = @ReturnedSaleJustificationItemID;
				
        IF @Version <> @PreVersion
            RAISERROR('Version mismatch...', 16 , 10);
	
        IF ( @MainQuantity <> @PreviousMainQuantity )
            BEGIN
	
                IF ( SELECT SLE.ReturnedSaleJustificationItemHasFlow(@ReturnedSaleJustificationItemID)
                   ) = 1
                    BEGIN
                        RAISERROR('MainQuantityIsNotEditable',16,12);
                    END;
		   	
                UPDATE  [SLE].[ReturnedSaleJustificationItem]
                SET     [MainQuantity] = @MainQuantity 
                WHERE   [ReturnedSaleJustificationItemID] = @ReturnedSaleJustificationItemID;
            END;
	
        IF ( ISNULL(@SubQuantity, 0) <> ISNULL(@PreviousSubQuantity, 0) )
            BEGIN
	
                IF ( SELECT SLE.ReturnedSaleJustificationItemHasFlow(@ReturnedSaleJustificationItemID)
                   ) = 1
                    BEGIN
                        RAISERROR('SubQuantityIsNotEditable',16,12);
                    END;
		
                UPDATE  [SLE].[ReturnedSaleJustificationItem]
                SET     [SubQuantity] = @SubQuantity 
                WHERE   [ReturnedSaleJustificationItemID] = @ReturnedSaleJustificationItemID;			
            END;
	
        UPDATE  [SLE].[ReturnedSaleJustificationItem]
        SET     [RowIndex] = @RowIndex ,
                [StuffID] = @StuffID ,
                [Description] = @Description ,
                [Description2] = @Description2 ,
                [Version] = @Version + 1 ,
                [LastEditor] = @LastEditor ,
                [LastEditionDate] = @LastEditionDate,
				[InvoiceItemID] =@InvoiceItemID,
				[Fee] = @Fee,
				[Price] =@Price,
				[Discount] =@Discount,
				[Tax] =@Tax,
				[Duty] =@Duty,
				[NetPrice] =@NetPrice
        WHERE   [ReturnedSaleJustificationItemID] = @ReturnedSaleJustificationItemID;
	
		-- Begin Return Select <- do not remove
        SELECT   [Version] 
        FROM    [SLE].[ReturnedSaleJustificationItem]
        WHERE   [ReturnedSaleJustificationItemID] = @ReturnedSaleJustificationItemID;	
		-- End Return Select <- do not remove
