CREATE PROC [STC].[spReceiptCostUpdate]
    @ReceiptCostID INT ,
    @StockReceiptID INT ,
    @PurchaseInvoiceItemID INT ,
    @Price DECIMAL(30, 4) ,
    @ShareDividingBase TINYINT ,
    @StuffID INT ,
    @SlID INT ,
    @Version INT ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME ,
    @ProformaDlId BIGINT
--WITH ENCRYPTION 
AS
BEGIN
    SET NOCOUNT ON; 
    DECLARE @PrePrevoucher INT;
	
    SELECT  @PrePrevoucher = sr.PreVoucherID
    FROM    STC.StockReceipt sr
    WHERE   sr.StockReceiptID = @StockReceiptID;

    IF @Version <> ( SELECT [Version]
                     FROM   [STC].[ReceiptCost]
                     WHERE  [ReceiptCostID] = @ReceiptCostID
                   )
        OR @PrePrevoucher IS NOT NULL
        RAISERROR('Version mismatch...', 16 , 10);

    UPDATE  [STC].[ReceiptCost]
    SET     [PurchaseInvoiceItemID] = @PurchaseInvoiceItemID ,
            [Price] = @Price ,
            [ShareDividingBase] = @ShareDividingBase ,
            [Version] = @Version + 1 ,
            [LastEditor] = @LastEditor ,
            [LastEditionDate] = @LastEditionDate ,
            [StuffID] = @StuffID ,
            [SlID] = @SlID ,
            [ProformaDlId] = @ProformaDlId
    WHERE   [ReceiptCostID] = @ReceiptCostID;
	
		-- Begin Return Select <- do not remove
    SELECT   [Version] 
    FROM    [STC].[ReceiptCost]
    WHERE   [ReceiptCostID] = @ReceiptCostID;	
		-- End Return Select <- do not remove
END
