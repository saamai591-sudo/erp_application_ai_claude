
CREATE PROC [FIN].[spPettyCashInsert] 
    @FundID INT,
    @PartyID bigint,
    @CurrencyID int,
    @CurrencyRate decimal(20, 10),
    @FirstAmount decimal(30, 4),     
    @MaxAmount decimal(30, 4),
    @IsActive bit,
    @SLID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
	@NegativeInventoryChecking bit
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
		
	INSERT INTO [FIN].[PettyCash] ([FundID], [PartyID], [CurrencyID], [CurrencyRate], [FirstAmount], [MaxAmount], [IsActive], [SLID], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate],[NegativeInventoryChecking])
	SELECT @FundID, @PartyID, @CurrencyID, @CurrencyRate, @FirstAmount, @MaxAmount, @IsActive, @SLID, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate,@NegativeInventoryChecking 
	
	-- Begin Return Select <- do not remove
	SELECT [PettyCashID], [Version]
	FROM   [FIN].[PettyCash]
	WHERE  [PettyCashID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
