CREATE   PROC [AST].[SpStatementUpdate] 
    @StatementID int,
    @FinancialPeriodID int,
    @Number int,
    @Date date,
    @PartyID bigint,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	if @Version <> (Select [Version] from [AST].[Statement]
				where [StatementID] = @StatementID)
	begin
		RAISERROR('Version mismatch...', 16 , 10)
		return
	end

	set @Version = @Version +1 

	UPDATE [AST].[Statement]
	SET    [FinancialPeriodID] = @FinancialPeriodID, [Number] = @Number, [Date] = @Date, [PartyID] = @PartyID, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate
	WHERE  [StatementID] = @StatementID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version], [Number]
	FROM   [AST].[Statement]
	WHERE  [StatementID] = @StatementID	
	-- End Return Select <- do not remove
