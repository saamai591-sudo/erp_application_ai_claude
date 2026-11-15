
CREATE   PROC [AST].[SpChangeCategoryInsert] 
    @FinancialPeriodID int,
    @Number int,
    @Date date,
    @Description nvarchar(MAX) = NULL,
    @Description2 nvarchar(MAX) = NULL,
    @AssetCategoryID int,
	@BranchID int,
	@Status tinyint,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime 
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	
	declare @Count int,@LatestNumber int
	
	select @Count = COUNT(*) from AST.ChangeCategory c where c.FinancialPeriodID = @FinancialPeriodID
	if (@Count = 0)
	 set @Number = 1
    else 
    begin
        select @LatestNumber = MAX(c.Number) from AST.ChangeCategory c where c.FinancialPeriodID = @FinancialPeriodID
        set @Number = @LatestNumber + 1 
    end 
	
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
	
	INSERT INTO [AST].[ChangeCategory] ([FinancialPeriodID], [Number], [Date], [Description], [Description2], [AssetCategoryID], [BranchID], [Status], [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @FinancialPeriodID, @Number, @Date, @Description, @Description2, @AssetCategoryID, @BranchID, @Status, 0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [ChangeCategoryID], [Version], [Number]
	FROM   [AST].[ChangeCategory]
	WHERE  [ChangeCategoryID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
