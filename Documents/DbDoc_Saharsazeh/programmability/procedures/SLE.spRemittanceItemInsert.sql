CREATE     PROC [SLE].[spRemittanceItemInsert]
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
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS
BEGIN
    SET NOCOUNT ON; 
        INSERT  INTO [SLE].[RemittanceItem]
                ( [RemittanceID] ,
                  [RowIndex] ,
                  [JustificationItemID] ,
                  [QuotationItemID] ,
                  [InvoiceItemID] ,
                  [SaleContractItemID] ,
                  [StuffID] ,
                  [MainQuantity] ,
                  [SubQuantity] ,
                  [Description] ,
                  [Description2] ,
                  [Version] ,
                  [Creator] ,
                  [CreationDate] ,
                  [LastEditor] ,
                  [LastEditionDate]
	            )
                SELECT  @RemittanceID ,
                        @RowIndex ,
                        @JustificationItemID ,
                        @QuotationItemID ,
                        @InvoiceItemID ,
                        @SaleContractItemID ,
                        @StuffID ,
                        @MainQuantity ,
                        @SubQuantity ,
                        @Description ,
                        @Description2 ,
                        0 ,
                        @Creator ,
                        @CreationDate ,
                        @LastEditor ,
                        @LastEditionDate;

	-- Begin Return Select <- do not remove
        SELECT  [RemittanceItemID] ,
                [Version] 
        FROM    [SLE].[RemittanceItem]
        WHERE   [RemittanceItemID] = SCOPE_IDENTITY();
	       -- End Return Select <- do not remove
END
