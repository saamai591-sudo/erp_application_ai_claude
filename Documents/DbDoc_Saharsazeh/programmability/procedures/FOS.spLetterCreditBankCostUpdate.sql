CREATE   PROC [FOS].[spLetterCreditBankCostUpdate] 
    @LetterCreditBankCostID int,
    @LetterCreditID int,
    @StuffID int,
    @Amount decimal(30, 4),
    @CostSlID int,
    @Description nvarchar(2048),
    @Description2 nvarchar(2048),
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
AS 
	SET NOCOUNT ON 


	if @Version=(Select [Version] from [FOS].[LetterCreditBankCost]
	where [LetterCreditBankCostID] = @LetterCreditBankCostID)
	begin	

		set @Version = @Version +1 

		UPDATE [FOS].[LetterCreditBankCost]
		SET    [LetterCreditID] = @LetterCreditID,
			   [StuffID] = @StuffID, 
			   [Amount] = @Amount, 
			   [CostSlID] = @CostSlID, 
			   [Description] = @Description, 
			   [Description2] = @Description2, 
			   [LastEditor] = @LastEditor, 
			   [LastEditionDate] = @LastEditionDate, 
			   [Version] = @Version
		WHERE  [LetterCreditBankCostID] = @LetterCreditBankCostID
	
		-- Begin Return Select <- do not remove
		SELECT [Version]
		FROM   [FOS].[LetterCreditBankCost]
		WHERE  [LetterCreditBankCostID] = @LetterCreditBankCostID	
		-- End Return Select <- do not remove

	end 
	ELSE 
		RAISERROR('Version mismatch...', 16 , 10)
