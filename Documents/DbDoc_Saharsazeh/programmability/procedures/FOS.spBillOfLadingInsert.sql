
CREATE PROC [FOS].[spBillOfLadingInsert] 
    @FinancialPeriodID int,
    @BranchID int,
    @Number int,
    @Date date,
	@PartyID bigint,
    @PurchaseInvoiceItemID int,
	@ShareDividingBase tinyint,
    @BillNumber varchar(250),
    @IssueDate date,
    @StartDateOfLading date,
    @LadingTypeID int,
	@PreVoucherID int,
    @Creator int,
    @CreationDate datetime,
	@PurchaseInvoiceItemNon decimal(36,10)
AS 
	SET NOCOUNT ON 

	if (@Number is null or @Number = 0)
	set @Number = isnull((select max(Number) + 1 from FOS.BillOfLading where FinancialPeriodID = @FinancialPeriodID),1)
	
	INSERT INTO [FOS].[BillOfLading] ([FinancialPeriodID], [BranchID], [Number], [Date], [PartyID], 
				[PurchaseInvoiceItemID],[ShareDividingBase], [BillNumber], [IssueDate], [StartDateOfLading], [LadingTypeID], 
				[Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version], [PurchaseInvoiceItemNon])
	SELECT	@FinancialPeriodID, @BranchID, @Number, @Date, @PartyID, @PurchaseInvoiceItemID,
			@ShareDividingBase, @BillNumber, @IssueDate, 
			@StartDateOfLading, @LadingTypeID,  @Creator, @CreationDate, @Creator, @CreationDate, 0,
			@PurchaseInvoiceItemNon
	
	-- Begin Return Select <- do not remove
	SELECT [BillOfLadingID],[Version],[Number]
	FROM   [FOS].[BillOfLading]
	WHERE  [BillOfLadingID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
