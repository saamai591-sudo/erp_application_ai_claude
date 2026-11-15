
CREATE   PROC [SLE].spInvoiceItemInsert
    @InvoiceID INT,
    @RowIndex SMALLINT,
    @SaleModelID SMALLINT,
    @StuffID INT,
    @MainQuantity DECIMAL(36, 10),
    @SubQuantity DECIMAL(36, 10),
    @Fee decimal(36,10),
    @Price decimal(36,10),
    @Discount decimal(36,10),
    @Tax decimal(36,10),
    @Duty decimal(36,10),
    @NetPrice decimal(36,10),
	@BaseCurrencyPrice decimal(36,10),
    @BaseCurrencyDiscount decimal(36,10),
    @BaseCurrencyTax decimal(36,10),
    @BaseCurrencyDuty decimal(36,10),
    @BaseCurrencyNetPrice decimal(36,10),
    @PricedFromBase BIT,
    @Description NVARCHAR(250),
    @Description2 NVARCHAR(250),
    @JustificationItemID INT,
    @QuotationItemID INT,
    @RemittanceItemID INT,
    @OutgoingItemId INT,
	@ContractSubjectID INT,
	@SaleContractItemID INT,
	@SaleItemID INT,
    @Creator INT,
    @CreationDate DATETIME,
	@ReceptionID INT,
	@AllocationSharingAmount DECIMAL(36,10)

--WITH ENCRYPTION 
AS 
BEGIN

	SET NOCOUNT ON 
	DECLARE @InvoiceItemID     INT,
	        @Message           NVARCHAR(MAX)
	
	IF EXISTS (
	       SELECT 1
	       FROM   cfg.InstallmentPayment
	       WHERE  BaseType=2 
	              AND DocumentID     = @InvoiceID
	   )
	BEGIN
	    SET @Message = N'فاکتور مورد نظر قسط بندي شده و امکان افزودن رديف جديد به آن وجود ندارد.'
	    RAISERROR(@Message, 16, 12)
	END
	
    IF EXISTS
    (
        SELECT 1
        FROM STF.[StuffDetail] AS s
        WHERE s.StuffID = @StuffID
              AND s.MeasureSubUnitID IS NULL
    )
        SET @SubQuantity = NULL;
	
	INSERT INTO [SLE].[InvoiceItem]
	  (
	    [InvoiceID],
	    [RowIndex],
	    [SaleModelID],
	    [StuffID],
	    [MainQuantity],
	    [SubQuantity],
	    [Fee],
	    [Price],
	    [Discount],
	    [Tax],
	    [Duty],
	    [BaseCurrencyPrice],
	    [BaseCurrencyDiscount],
	    [BaseCurrencyTax],
	    [BaseCurrencyDuty],
	    [PricedFromBase],
	    [Description],
	    [Description2],
	    [JustificationItemID],
	    [QuotationItemID],
	    [RemittanceItemID],
	    [OutgoingItemId],
	    [ContractSubjectID],
		[SaleContractItemID],
	    [SaleItemID],
	    [Version],
	    [Creator],
	    [CreationDate],
	    [LastEditor],
	    [LastEditionDate],
	    [ReceptionID] ,
		[AllocationSharingAmount]
	  )
	SELECT @InvoiceID,
	       @RowIndex,
	       @SaleModelID,
	       @StuffID,
	       @MainQuantity,
	       @SubQuantity,
	       @Fee,
	       @Price,
	       @Discount,
	       @Tax,
	       @Duty,
	       @BaseCurrencyPrice,
	       @BaseCurrencyDiscount,
	       @BaseCurrencyTax,
	       @BaseCurrencyDuty,
	       @PricedFromBase,
	       @Description,
	       @Description2,
	       @JustificationItemID,
	       @QuotationItemID,
	       @RemittanceItemID,
	       @OutgoingItemId,
	       @ContractSubjectID,
		   @SaleContractItemID,
	       @SaleItemID,
	       0,
	       @Creator,
	       @CreationDate,
	       @Creator,
	       @CreationDate,
	       @ReceptionID,
		   @AllocationSharingAmount
	
	SET @InvoiceItemID = SCOPE_IDENTITY();
	
	if exists (
	select DoMainQuantity from sle.Outgoing_Non_Invoice
	where OutgoingItemID = @OutgoingItemId
	and DoMainQuantity > MainQuantity
	) 
	begin
		raiserror(N'مانده فاکتور نشده حواله نمی تواند منفی باشد',16,12)
	end

	-- Begin Return Select <- do not remove
	SELECT [InvoiceItemID],
	       [Version]
	FROM   [SLE].[InvoiceItem]
	WHERE  [InvoiceItemID] = @InvoiceItemID 
	       -- End Return Select <- do not remove
END 

