CREATE PROC [FOS].[spLetterCreditBankCostInsert] 
    @LetterCreditID int,
    @StuffID int,
    @Amount decimal(30, 4),
    @CostSlID int,
    @Description nvarchar(2048),
    @Description2 nvarchar(2048),
    @Creator int,
    @CreationDate datetime
AS 
	SET NOCOUNT ON 

	
	INSERT INTO [FOS].[LetterCreditBankCost] ([LetterCreditID], [StuffID], [Amount], [CostSlID], [Description], [Description2], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [Version])
	SELECT @LetterCreditID, @StuffID, @Amount, @CostSlID, @Description, @Description2, @Creator, @CreationDate, @Creator, @CreationDate, 0
	
	-- Begin Return Select <- do not remove
	SELECT [LetterCreditBankCostID],[Version]
	FROM   [FOS].[LetterCreditBankCost]
	WHERE  [LetterCreditBankCostID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
               


