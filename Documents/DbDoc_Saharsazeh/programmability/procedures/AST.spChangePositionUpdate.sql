CREATE    PROC [AST].[spChangePositionUpdate]
    @ChangePositionID int,
    @BranchID int,
    @Number int,
    @Date date,
    @Description nvarchar(250),
    @Description2 nvarchar(250),
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
AS 
SET NOCOUNT ON 
	if @Version <> (Select [Version] from [AST].[ChangePosition]
	where [ChangePositionID] = @ChangePositionID)
	begin
		raiserror('Version mismatch...',16,10)
		return
	end

	set @Version = @Version +1 

	UPDATE [AST].[ChangePosition]
	SET    BranchID = @BranchID, [Number] = @Number, [Date] = @Date, [Description] = @Description, [Description2] = @Description2,  [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate
	WHERE  [ChangePositionID] = @ChangePositionID
	
	-- Begin Return Select <- do not remove
	SELECT	[Version],
			[Number]
	FROM   [AST].[ChangePosition]
	WHERE  [ChangePositionID] = @ChangePositionID	
	-- End Return Select <- do not remove
