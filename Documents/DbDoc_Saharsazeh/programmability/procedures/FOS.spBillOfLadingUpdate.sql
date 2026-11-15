CREATE   PROC [FOS].[spBillOfLadingUpdate] 
    @BillOfLadingID int,
    @BranchID int,
    @Number int,
    @Date date,
	@PartyID bigint,
    @PurchaseInvoiceItemID int,
    @BillNumber varchar(250),
	@ShareDividingBase TINYINT,
    @IssueDate date,
    @StartDateOfLading date,
    @LadingTypeID int,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int,
	@PurchaseInvoiceItemNon decimal(36,10)
AS 
	SET NOCOUNT ON

	declare @FinancialPeriodID int,
			@PreVersion int

	Select  @PreVersion =  [Version] ,
			@FinancialPeriodID = FinancialPeriodID
	from [FOS].[BillOfLading]
	where [BillOfLadingID] = @BillOfLadingID
	
	if @Version=@PreVersion
	begin	

		set @Version = @Version +1 

		if (@Number is null or @Number = 0)
		set @Number = isnull((select max(Number) + 1 from FOS.BillOfLading where FinancialPeriodID = @FinancialPeriodID),1)

		UPDATE [FOS].[BillOfLading]
		SET     [BranchID] = @BranchID, 
				[Number] = @Number, 
				[Date] = @Date, 
				[PartyID] = @PartyID,
				[PurchaseInvoiceItemID] = @PurchaseInvoiceItemID, 
				[BillNumber] = @BillNumber, 
				[ShareDividingBase] = @ShareDividingBase,
				[IssueDate] = @IssueDate, 
				[StartDateOfLading] = @StartDateOfLading, 
				[LadingTypeID] = @LadingTypeID, 
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate, 
				[Version] = @Version, 
				[PurchaseInvoiceItemNon] = @PurchaseInvoiceItemNon
		WHERE  [BillOfLadingID] = @BillOfLadingID
	
		-- Begin Return Select <- do not remove
		SELECT [Version],[Number]
		FROM   [FOS].[BillOfLading]
		WHERE  [BillOfLadingID] = @BillOfLadingID	
		-- End Return Select <- do not remove

	end
	else 
		RAISERROR('Version mismatch...', 16 , 10)
