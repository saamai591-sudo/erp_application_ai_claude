CREATE PROC [FIN].[SpReconciliationUpdate] 
    @ReconciliationID int,
    @FinancialPeriodID int,
    @Number int,
    @Date date,
    @BankAccountID int,
    @BankBillID int,
    @DateBased bit,
    @NumberBased bit,
    @AmountBased bit,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	if @Version <> (Select [Version] from [FIN].[Reconciliation]
				where [ReconciliationID] = @ReconciliationID)
	RAISERROR('Version mismatch...', 16 , 10)

	set @Version = @Version +1 

		UPDATE [FIN].[Reconciliation]
		SET    [FinancialPeriodID] = @FinancialPeriodID, [Number] = @Number, [Date] = @Date, [BankAccountID] = @BankAccountID, [BankBillID] = @BankBillID, [DateBased] = @DateBased, [NumberBased] = @NumberBased, [AmountBased] = @AmountBased, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate
		WHERE  [ReconciliationID] = @ReconciliationID
	
		-- Begin Return Select <- do not remove
		SELECT [Version], [Number]
		FROM   [FIN].[Reconciliation]
		WHERE  [ReconciliationID] = @ReconciliationID	
		-- End Return Select <- do not remove
