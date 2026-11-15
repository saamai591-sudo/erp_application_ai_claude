CREATE   PROC [FIN].[spPaymentCheqeFlowInsert] 
    @FinancialPeriodID int,
    @Type tinyint,
    @BranchID int,
    @Date date,
    @BankAccountID int,
    @PartyID bigint,
    @PreVoucherID int,
    @InnerNumber int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
   --WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	
	if (@InnerNumber is null) or @InnerNumber = 0
    set @InnerNumber = isnull((select MAX(p.InnerNumber) from FIN.PaymentCheqeFlow p 
    where p.FinancialPeriodID = @FinancialPeriodID and p.[Type] = @Type),0) + 1
	
	INSERT INTO [FIN].[PaymentCheqeFlow] ([FinancialPeriodID], [Type], [BranchID], [Date], [BankAccountID], [PartyID], [PreVoucherID], [InnerNumber], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @FinancialPeriodID, @Type, @BranchID, @Date, @BankAccountID, @PartyID, @PreVoucherID, @InnerNumber, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [PaymentCheqeFlowID], [Version], [InnerNumber]
	FROM   [FIN].[PaymentCheqeFlow]
	WHERE  [PaymentCheqeFlowID] = SCOPE_IDENTITY();
	-- End Return Select <- do not remove
