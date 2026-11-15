CREATE     PROC [SLE].[spRemittanceItemUpdate]
    @RemittanceItemID INT ,
    @RemittanceID INT ,
    @RowIndex SMALLINT ,
    @JustificationItemID INT ,
    @QuotationItemID INT ,
    @InvoiceItemID INT ,
    @SaleContractItemID INT ,
    @StuffID INT ,
    @MainQuantity DECIMAL(36, 10) ,
    @SubQuantity DECIMAL(36, 10) ,
    @Description NVARCHAR(250) ,
    @Description2 NVARCHAR(250) ,
    @Version INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS
    SET NOCOUNT ON; 

        DECLARE @PreviousMainQuantity DECIMAL(30, 4) ,
            @PreviousSubQuantity DECIMAL(30, 4) ,
            @PreJustificationItemID INT ,
            @PreQuotationItemID INT ,
            @PreInvoiceItemID INT ,
            @PreVersion INT ,
            @Message NVARCHAR(MAX);
	
        SELECT  @PreviousMainQuantity = [MainQuantity] ,
                @PreviousSubQuantity = [SubQuantity] ,
                @PreVersion = [Version] ,
                @PreJustificationItemID = JustificationItemID ,
                @PreQuotationItemID = QuotationItemID ,
                @PreInvoiceItemID = InvoiceItemID
        FROM    [SLE].[RemittanceItem]
        WHERE   [RemittanceItemID] = @RemittanceItemID;	
	
        IF @Version <> @PreVersion
           BEGIN
               RAISERROR('Version mismatch...', 16, 10);
			   RETURN
           END 
	
    -- Start Update		
        IF ( @MainQuantity <> @PreviousMainQuantity )
            BEGIN
                IF ( SELECT SLE.RemittanceItemHasFlow(@RemittanceItemID)
                   ) = 1
                BEGIN
                    RAISERROR('MainQuantityIsNotEditable', 16, 12);
                END;
	    
                UPDATE  [SLE].[RemittanceItem]
                SET     [MainQuantity] = @MainQuantity
                WHERE   [RemittanceItemID] = @RemittanceItemID;
            END;
	
        IF ISNULL(@SubQuantity, 0) <> ISNULL(@PreviousSubQuantity, 0)
            BEGIN
                IF ( SELECT SLE.RemittanceItemHasFlow(@RemittanceItemID)
                   ) = 1
                    BEGIN
                        RAISERROR('SubQuantityIsNotEditable', 16, 12);
                    END;
	    
                UPDATE  [SLE].[RemittanceItem]
                SET     [SubQuantity] = @SubQuantity
                WHERE   [RemittanceItemID] = @RemittanceItemID;
            END;
	
        UPDATE  [SLE].[RemittanceItem]
        SET     [RowIndex] = @RowIndex ,
                [JustificationItemID] = @JustificationItemID ,
                [QuotationItemID] = @QuotationItemID ,
                [InvoiceItemID] = @InvoiceItemID ,
                [SaleContractItemID] = @SaleContractItemID ,
                [StuffID] = @StuffID ,
                [Description] = @Description ,
                [Description2] = @Description2 ,
                [Version] = @Version + 1 ,
                [LastEditor] = @LastEditor ,
                [LastEditionDate] = @LastEditionDate
        WHERE   [RemittanceItemID] = @RemittanceItemID;
	-- End Update		
	
	-- Begin Return Select <- do not remove
        SELECT   [Version] 
        FROM    [SLE].[RemittanceItem]
        WHERE   [RemittanceItemID] = @RemittanceItemID; 
	       -- End Return Select <- do not remove
