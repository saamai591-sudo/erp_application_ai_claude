CREATE     PROC [FIN].[spCashTransferInsert]    
    @FinancialPeriodID INT,
    @Type TINYINT,
    @Number INT,
    @Date DATE,
	@BranchID INT,
	@SourceCashID INT,
	@TargetCashID INT,
	@Description nvarchar(256),
	@Description2 nvarchar(256),
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION 
AS 
SET NOCOUNT ON
	
	if (@Number is null or @Number = 0)
		set @Number = isnull((select MAX(Number) from FIN.CashTransfer where FinancialPeriodID = @FinancialPeriodID),0) + 1

	INSERT INTO FIN.CashTransfer (FinancialPeriodID, Type, Number, Date, BranchID, SourceCashID, TargetCashID,
		Description, Description2, Creator, CreationDate, LastEditor, LastEditionDate, [Version])
	SELECT @FinancialPeriodID, @Type, @Number, @Date, @BranchID, @SourceCashID, @TargetCashID,
	       @Description, @Description2, @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT	CashTransferID,
			[Version],
			Number
	FROM   FIN.CashTransfer
	WHERE  CashTransferID = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
