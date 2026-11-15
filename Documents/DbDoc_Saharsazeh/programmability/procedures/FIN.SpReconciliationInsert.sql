CREATE PROC [FIN].[SpReconciliationInsert] 
    @FinancialPeriodID int,
    @Number int,
    @Date date,
    @BankAccountID int,
    @BankBillID int,
    @DateBased bit,
    @NumberBased bit,
    @AmountBased bit,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime 
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	
	DECLARE @Count int,
			@LatestNumber int	
					
	IF(@Number = 0)
	BEGIN
		select @Count = COUNT(*) from FIN.Reconciliation r
		if (@Count = 0)
		 set @Number = 1
		else 
		begin
			select @LatestNumber = MAX(Number) from FIN.Reconciliation r 
			set @Number = @LatestNumber + 1 
		end
	END
	
	IF EXISTS (SELECT Number FROM FIN.Reconciliation WHERE Number = @Number)	
	BEGIN
		RAISERROR('شماره تکراری می باشد.',16,12)
		RETURN;
	END
	
	INSERT INTO [FIN].[Reconciliation] ([FinancialPeriodID], [Number], [Date], [BankAccountID], [BankBillID], [DateBased], [NumberBased], [AmountBased], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @FinancialPeriodID, @Number, @Date, @BankAccountID, @BankBillID, @DateBased, @NumberBased, @AmountBased, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [ReconciliationID], [Version], [Number]
	FROM   [FIN].[Reconciliation]
	WHERE  [ReconciliationID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
