CREATE   PROC [FIN].[spPettyCashUpdate]
    @PettyCashID int,
    @FundID INT,
    @PartyID bigint,
    @CurrencyID int,
    @CurrencyRate decimal(20, 10),
    @FirstAmount decimal(30, 4),
    @MaxAmount decimal(30, 4),
    @IsActive bit,
    @SLID int,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
	@NegativeInventoryChecking bit
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	if @Version <> (Select [Version] from [FIN].[PettyCash]
	where [PettyCashID] = @PettyCashID)
	RAISERROR('Version mismatch...', 16 , 10)
		
	DECLARE @Message NVARCHAR(MAX)
		
	UPDATE [FIN].[PettyCash]
	SET     [FundID] = @FundID, 
			[PartyID] = @PartyID, 
			[CurrencyID] = @CurrencyID, 
			[CurrencyRate] = @CurrencyRate, 
			[FirstAmount] = @FirstAmount, 
			[MaxAmount] = @MaxAmount, 
			[IsActive] = @IsActive, 
			[SLID] = @SLID,
			[Version] = @Version + 1, 
			[LastEditor] = @LastEditor, 
			[LastEditionDate] = @LastEditionDate,
			[NegativeInventoryChecking]=@NegativeInventoryChecking 
	WHERE  [PettyCashID] = @PettyCashID
	
	declare @PettyCashTitle nvarchar(250),
			@LastAmount decimal(30, 4),
			@Culture NVARCHAR(5),
			@CultureNo tinyint
	    
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture   	

	select @PettyCashTitle = case @CultureNo when 2 then f.Title2 else f.Title end,
			@LastAmount = la.LastAmount
	from FIN.PettyCash p 
	JOIN FIN.Fund f ON f.FundID = p.FundID
	join FIN.PettyCash_LastAmount la on p.PettyCashID = la.PettyCashID
	where p.PettyCashID = @PettyCashID

	IF (@LastAmount < 0)
	BEGIN
		SET @Message = N'PettyCashNegativeInventory^' + @PettyCashTitle;
        RAISERROR(@Message, 16, 12);
        RETURN;
	END

	-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [FIN].[PettyCash]
	WHERE  [PettyCashID] = @PettyCashID	
	-- End Return Select <- do not remove
