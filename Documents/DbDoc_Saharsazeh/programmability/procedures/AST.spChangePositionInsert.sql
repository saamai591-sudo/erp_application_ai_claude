CREATE    PROC [AST].[spChangePositionInsert]
    @BranchID int,
    @Number int,
    @Date date,
    @Description nvarchar(250),
    @Description2 nvarchar(250),
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
AS 
SET NOCOUNT ON 

    IF (@Number is null or @Number = 0)
    SET @Number = isnull((SELECT MAX(t.Number) FROM AST.[ChangePosition] t ),0) + 1

	INSERT INTO [AST].[ChangePosition] ([BranchID], [Number], [Date], [Description], [Description2],  [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @BranchID, @Number, @Date,  @Description, @Description2,  0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [ChangePositionID], [Version], [Number]
	FROM   [AST].[ChangePosition]
	WHERE  [ChangePositionID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
