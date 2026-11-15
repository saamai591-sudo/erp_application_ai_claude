CREATE   PROC [FIN].[spReceiptCheqeFlowInsert] 
    @FinancialPeriodID int,
    @Type tinyint,
    @BranchID int,
    @Date date,
    @Number nvarchar(50),
    @BankAccountID int,
    @CashID int,
    @PartyID bigint,
    @Status tinyint,
    @InnerNumber int,
    @PreVoucherID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON  
	
	if (@InnerNumber is null) or @InnerNumber = 0
		set @InnerNumber = isnull((select MAX(f.InnerNumber) from FIN.ReceiptCheqeFlow f 
			where f.FinancialPeriodID = @FinancialPeriodID and f.[Type] = @Type),0) + 1
	
	INSERT INTO [FIN].[ReceiptCheqeFlow] ([FinancialPeriodID], [Type], [BranchID], [Date], [Number], [BankAccountID], [CashID], [PartyID], [Status], [InnerNumber], [PreVoucherID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @FinancialPeriodID, @Type, @BranchID, @Date, @Number, @BankAccountID, @CashID, @PartyID, @Status, @InnerNumber, @PreVoucherID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [ReceiptCheqeFlowID], [Version], [InnerNumber]
	FROM   [FIN].[ReceiptCheqeFlow]
	WHERE  [ReceiptCheqeFlowID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
