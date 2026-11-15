

CREATE   PROC [AST].[SpChangeCategoryUpdate] 
    @ChangeCategoryID int,
    @FinancialPeriodID int,
    @Number int,
    @Date date,
    @Description nvarchar(MAX) = NULL,
    @Description2 nvarchar(MAX) = NULL,
    @AssetCategoryID int,
	@BranchID int,
	@Status tinyint,
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 
	if @Version <> (Select [Version] from [AST].[ChangeCategory] where [ChangeCategoryID] = @ChangeCategoryID)
	begin
		RAISERROR('Version mismatch...', 16 , 10)
		return
	end

	set @Version = @Version +1 
	
		declare @maxDate date,
				@AssetID int
				
		select @maxDate = MAX(h.Date), @AssetID = i.AssetID
		from ast.ChangeCategoryItem i
		join ast.ChangeCategory h on i.ChangeCategoryID = h.ChangeCategoryID
		group by i.AssetID
		
		if exists(select i.AssetID
		from ast.ChangeCategoryItem i
		join ast.ChangeCategory h on i.ChangeCategoryID = h.ChangeCategoryID
		where i.AssetID = @AssetID and @maxDate > @Date)
		begin
			RAISERROR('تاریخ وارد شده کوچکتر از آخرین تاریخ تغییر گروه برای دارایی مورد نظر می باشد.',16,12)
			RETURN;
		end

		UPDATE [AST].[ChangeCategory]
		SET    [FinancialPeriodID] = @FinancialPeriodID,
		       [Number] = @Number, [Date] = @Date,
			   [Description] = @Description,
			   [Description2] = @Description2, 
			   [AssetCategoryID] = @AssetCategoryID, 
			   [BranchID] = @BranchID,
			   [Status] = @Status,
			   [Version] = @Version,
			   [Creator] = @Creator,
			   [CreationDate] = @CreationDate,
			   [LastEditor] = @LastEditor, 
			   [LastEditionDate] = @LastEditionDate
		WHERE  [ChangeCategoryID] = @ChangeCategoryID
	
		-- Begin Return Select <- do not remove
		SELECT  [Version],
		       [Number]
		FROM   [AST].[ChangeCategory]
		WHERE  [ChangeCategoryID] = @ChangeCategoryID	
		-- End Return Select <- do not remove

