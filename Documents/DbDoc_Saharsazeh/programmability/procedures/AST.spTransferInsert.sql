
-------------------------------------
CREATE   PROC [AST].[spTransferInsert] 
    @FinancialPeriodID int,
    @Number int,
    @Date date,
    @SourceBranchID int,
    @DestinationBranchID int,
    @Description nvarchar(250),
    @Description2 nvarchar(250),
    @PreVoucherID int,
    @TransferStatus tinyint,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
AS 
    SET NOCOUNT ON 

    IF (@Number is null or @Number = 0)
    SET @Number = isnull((SELECT MAX(t.Number) FROM AST.[Transfer] t WHERE t.FinancialPeriodID = @FinancialPeriodID),0) + 1
	
	INSERT INTO [AST].[Transfer] ([FinancialPeriodID], [Number], [Date], [SourceBranchID], [DestinationBranchID], [Description], [Description2], [PreVoucherID], [Version], [TransferStatus], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @FinancialPeriodID, @Number, @Date, @SourceBranchID, @DestinationBranchID, @Description, @Description2, @PreVoucherID, 0,@TransferStatus, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT  [TransferID],
            [Version],
            [Number]
	FROM   [AST].[Transfer]
	WHERE  [TransferID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
