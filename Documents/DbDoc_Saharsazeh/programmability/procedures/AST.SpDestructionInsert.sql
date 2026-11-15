
-------------------------------------
CREATE   PROCEDURE [AST].[SpDestructionInsert] 
    @Number int,
    @Date date,
    @DestructionReasonID int,
    @Description nvarchar(1024) = NULL,
    @Description2 nvarchar(1024) = NULL,
    @FinancialPeriodID int,
    @PreVoucherID int = NULL,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
	@BranchID int ,
    @DestructionStatus tinyint
--WITH ENCRYPTION
AS 
    SET NOCOUNT ON 
    
    IF (@Number is null) or @Number = 0
        SET @Number = isnull((SELECT MAX(d.Number) FROM AST.Destruction d WHERE d.FinancialPeriodID = @FinancialPeriodID),0) + 1
    
	INSERT INTO [AST].[Destruction] ([Number], [Date], [DestructionReasonID], [Description], [Description2], [FinancialPeriodID], [PreVoucherID], [DestructionStatus], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate], [BranchID])
	SELECT @Number, @Date, @DestructionReasonID, @Description, @Description2, @FinancialPeriodID, @PreVoucherID, @DestructionStatus, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate, @BranchID
	
	-- Begin Return Select <- do not remove
	SELECT [DestructionID], [Version], [Number]
	FROM   [AST].[Destruction]
	WHERE  [DestructionID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
